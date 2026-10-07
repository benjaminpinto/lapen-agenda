"""Draw persistence: generate a preview, swap entries, publish and undo.

The algorithms live in tournament_draw (pure). This module reads the confirmed registrations, turns the
result into groups and matches, and records every step in the audit log. Like tournament_service it never
commits: routes own the transaction.
"""
import random
import secrets

from src.services import tournament_draw as draw
from src.services.tournament_service import (
    DRAWN_CATEGORY_STATUSES, TERMINAL_STATUSES, TournamentError, get_category, get_tournament, log_audit,
    serialize_category,
)

DRAWABLE_TOURNAMENT_STATUSES = ('registration_closed', 'in_progress')


def new_seed():
    """Seed of one draw. It is stored in the audit log so the draw can be replayed and verified."""
    return secrets.randbits(48)


def _lock(db, tournament_id, category_id):
    tournament = get_tournament(db, tournament_id, lock=True)
    if tournament['status'] in TERMINAL_STATUSES:
        raise TournamentError('Torneio finalizado ou cancelado não pode ser sorteado.', 409, code='tournament_locked')
    category = get_category(db, tournament_id, category_id, lock=True)
    return tournament, category


def _require_registrations_closed(tournament):
    if tournament['status'] not in DRAWABLE_TOURNAMENT_STATUSES:
        raise TournamentError('Encerre as inscrições do torneio antes de sortear.', 409, code='registration_not_closed')


# --- writing the structure ---------------------------------------------------------------------

def _insert_match(db, category_id, **values):
    columns = ('category_id',) + tuple(values)
    row = db.execute(
        f"INSERT INTO tournament_matches ({', '.join(columns)}) VALUES ({', '.join(['%s'] * len(columns))}) RETURNING id",
        (category_id,) + tuple(values.values())
    ).fetchone()
    return row['id']


def create_knockout_matches(db, category_id, lines):
    """Create every match of a single-elimination bracket from its round-1 lines.

    A line holds a registration id, a label such as "1º Grupo A" (an entry that is not known yet) or None (bye).
    Byes are completed on the spot and their winner already sits in the next round.
    """
    size = len(lines)
    rounds = draw.round_count(size)
    plan = {}
    for round_number in range(1, rounds + 1):
        for position in range(1, (size >> round_number) + 1):
            match = {'entry1_id': None, 'entry2_id': None, 'entry1_source': None, 'entry2_source': None,
                     'winner_entry_id': None, 'status': 'pending', 'outcome': None}
            if round_number > 1:
                for slot, feeder in ((1, 2 * position - 1), (2, 2 * position)):
                    match[f'entry{slot}_source'] = draw.winner_label(round_number - 1, feeder, rounds)
            plan[(round_number, position)] = match

    for position in range(1, size // 2 + 1):
        match, pair = plan[(1, position)], (lines[2 * position - 2], lines[2 * position - 1])
        for slot, line in enumerate(pair, start=1):
            if isinstance(line, int):
                match[f'entry{slot}_id'] = line
            elif isinstance(line, str):
                match[f'entry{slot}_source'] = line
        if None in pair:
            winner = next(line for line in pair if line is not None)
            match.update(status='completed', outcome='bye', winner_entry_id=winner)
            if rounds > 1:
                following = plan[(2, (position + 1) // 2)]
                slot = 1 if position % 2 == 1 else 2
                following[f'entry{slot}_id'], following[f'entry{slot}_source'] = winner, None

    ids = {}
    for round_number in range(rounds, 0, -1):  # last round first, so every match knows where its winner goes
        for position in range(1, (size >> round_number) + 1):
            match = plan[(round_number, position)]
            following = ids.get((round_number + 1, (position + 1) // 2))
            ids[(round_number, position)] = _insert_match(
                db, category_id, stage='knockout', round_number=round_number, bracket_position=position,
                next_match_id=following, next_slot=(1 if position % 2 == 1 else 2) if following else None, **match)
    return ids


def create_group_stage(db, category_id, groups):
    """Create the groups and their round-robin matches. Returns [(group name, group id)]."""
    created = []
    for index, entries in enumerate(groups):
        name = draw.group_name(index)
        group_id = db.execute('INSERT INTO tournament_groups (category_id, name) VALUES (%s, %s) RETURNING id',
                              (category_id, name)).fetchone()['id']
        for registration_id in entries:
            db.execute('INSERT INTO tournament_group_entries (group_id, registration_id) VALUES (%s, %s)',
                       (group_id, registration_id))
        for round_number, pairs in enumerate(draw.round_robin_rounds(entries), start=1):
            for position, (first, second) in enumerate(pairs, start=1):
                _insert_match(db, category_id, stage='group', group_id=group_id, round_number=round_number,
                              bracket_position=position, entry1_id=first, entry2_id=second)
        created.append((name, group_id))
    return created


def _clear_draw(db, category_id):
    db.execute('DELETE FROM tournament_matches WHERE category_id = %s', (category_id,))
    db.execute('DELETE FROM tournament_groups WHERE category_id = %s', (category_id,))


# --- reading ----------------------------------------------------------------------------------------

def get_draw(db, tournament_id, category_id):
    """The category's groups and bracket as the admin sees them (preview or published)."""
    get_tournament(db, tournament_id)
    category = get_category(db, tournament_id, category_id)
    registrations = {r['id']: r for r in db.execute(
        'SELECT id, display_name, seed FROM tournament_registrations WHERE category_id = %s', (category_id,)).fetchall()}
    groups = db.execute('SELECT id, name FROM tournament_groups WHERE category_id = %s ORDER BY name', (category_id,)).fetchall()
    members = db.execute(
        'SELECT ge.group_id, ge.registration_id FROM tournament_group_entries ge '
        'JOIN tournament_groups g ON g.id = ge.group_id WHERE g.category_id = %s', (category_id,)).fetchall()
    matches = db.execute(
        'SELECT * FROM tournament_matches WHERE category_id = %s ORDER BY stage, round_number, bracket_position',
        (category_id,)).fetchall()

    def entry(registration_id):
        registration = registrations.get(registration_id)
        if not registration:
            return None
        return {'registration_id': registration['id'], 'display_name': registration['display_name'], 'seed': registration['seed']}

    knockout = [m for m in matches if m['stage'] == 'knockout']
    total_rounds = max((m['round_number'] for m in knockout), default=0)

    def serialize(match):
        data = {
            'id': match['id'], 'stage': match['stage'], 'group_id': match['group_id'],
            'round_number': match['round_number'], 'bracket_position': match['bracket_position'],
            'entry1': entry(match['entry1_id']), 'entry2': entry(match['entry2_id']),
            'entry1_source': match['entry1_source'], 'entry2_source': match['entry2_source'],
            'status': match['status'], 'outcome': match['outcome'], 'winner_entry_id': match['winner_entry_id'],
            'score': match['score'], 'played_at': match['played_at'].isoformat() if match['played_at'] else None,
            'next_match_id': match['next_match_id'], 'next_slot': match['next_slot'],
        }
        if match['stage'] == 'knockout':
            data['round_name'] = draw.round_name(match['round_number'], total_rounds)
        return data

    groups_data = []
    for group in groups:
        ids = [m['registration_id'] for m in members if m['group_id'] == group['id']]
        ordered = sorted((registrations[i] for i in ids), key=lambda r: (r['seed'] is None, r['seed'] or 0, r['display_name']))
        groups_data.append({
            'id': group['id'], 'name': group['name'], 'entries': [entry(r['id']) for r in ordered],
            'matches': [serialize(m) for m in matches if m['group_id'] == group['id']],
        })

    knockout_data = None
    if knockout:
        knockout_data = {
            'size': 2 * sum(1 for m in knockout if m['round_number'] == 1),
            'rounds': [{'round_number': r, 'name': draw.round_name(r, total_rounds),
                        'matches': [serialize(m) for m in knockout if m['round_number'] == r]}
                       for r in range(1, total_rounds + 1)],
        }
    return {
        'category': serialize_category(category),
        'draw': {
            'format': category['draw_format'], 'groups': groups_data, 'knockout': knockout_data,
            # Groups whose qualifiers do not fill a bracket get their knockout phase when the groups end
            'knockout_pending': category['draw_format'] == 'groups_knockout' and bool(groups_data) and knockout_data is None,
        },
    }


def _snapshot(db, category_id):
    """Who sits where, for the audit log."""
    groups = {}
    for row in db.execute(
            'SELECT g.name, ge.registration_id FROM tournament_group_entries ge JOIN tournament_groups g ON g.id = ge.group_id '
            'WHERE g.category_id = %s ORDER BY g.name, ge.registration_id', (category_id,)).fetchall():
        groups.setdefault(row['name'], []).append(row['registration_id'])
    first_round = [
        [m['entry1_id'] or m['entry1_source'], m['entry2_id'] or m['entry2_source']] for m in db.execute(
            "SELECT entry1_id, entry2_id, entry1_source, entry2_source FROM tournament_matches "
            "WHERE category_id = %s AND stage = 'knockout' AND round_number = 1 ORDER BY bracket_position", (category_id,)).fetchall()]
    return {'groups': groups, 'first_round': first_round}


# --- operations -----------------------------------------------------------------------------------------

def generate_draw(db, tournament_id, category_id, actor_id, rng_seed=None):
    """Draw (or redraw) the preview of a category from its confirmed registrations.

    rng_seed makes the draw reproducible (fixtures); by default a fresh one is generated and stored in the audit log.
    """
    tournament, category = _lock(db, tournament_id, category_id)
    _require_registrations_closed(tournament)
    if category['status'] in DRAWN_CATEGORY_STATUSES:
        raise TournamentError('O sorteio desta categoria já foi publicado: desfaça-o antes de sortear de novo.', 409, code='draw_published')

    rows = db.execute(
        "SELECT id, seed FROM tournament_registrations WHERE category_id = %s AND status = 'confirmed' ORDER BY id",
        (category_id,)).fetchall()
    ids = [row['id'] for row in rows]
    grouped = category['draw_format'] == 'groups_knockout'
    minimum = max(category['min_entries'], 6 if grouped else 2)
    if len(ids) < minimum:
        raise TournamentError(f'São necessários ao menos {minimum} inscritos confirmados (há {len(ids)}).', 400, code='not_enough_entries')
    seeded = sorted((row['seed'], row['id']) for row in rows if row['seed'] is not None)
    if [number for number, _ in seeded] != list(range(1, len(seeded) + 1)):
        raise TournamentError('Os cabeças de chave devem ser numerados em sequência a partir de 1.', 400, code='invalid_seeds')
    seeds = [registration_id for _, registration_id in seeded]

    rng_seed = new_seed() if rng_seed is None else rng_seed
    rng = random.Random(rng_seed)
    _clear_draw(db, category_id)
    try:
        if category['draw_format'] == 'knockout':
            create_knockout_matches(db, category_id, draw.build_knockout(ids, seeds, rng))
        elif category['draw_format'] == 'round_robin':
            others = [i for i in ids if i not in set(seeds)]
            rng.shuffle(others)
            create_group_stage(db, category_id, [seeds + others])
        else:
            groups = draw.build_groups(ids, seeds, category['group_target_size'], rng)
            created = create_group_stage(db, category_id, groups)
            names = [name for name, _ in created]
            qualifiers = len(names) * category['qualifiers_per_group']
            if qualifiers & (qualifiers - 1) == 0:  # fills a bracket: build it now, with "1º Grupo A" style slots
                winners = [(name, draw.qualifier_label(1, name)) for name in names]
                runners = [(name, draw.qualifier_label(2, name)) for name in names] if category['qualifiers_per_group'] == 2 else []
                create_knockout_matches(db, category_id, draw.knockout_lines_from_groups(winners, runners, rng))
    except draw.DrawError as exc:
        raise TournamentError(str(exc), 400, code='draw_failed') from exc

    db.execute("UPDATE tournament_categories SET status = 'drawn' WHERE id = %s", (category_id,))
    log_audit(db, tournament_id, 'draw_generated',
              {'rng_seed': rng_seed, 'format': category['draw_format'], 'entries': len(ids), 'seeds': len(seeds),
               'result': _snapshot(db, category_id)}, category_id, actor_id)

    pending = db.execute("SELECT COUNT(*) AS n FROM tournament_registrations WHERE category_id = %s AND status = 'pending'",
                         (category_id,)).fetchone()['n']
    result = get_draw(db, tournament_id, category_id)
    result['warnings'] = [f'Há {pending} inscrição(ões) pendente(s) que ficaram fora do sorteio.'] if pending else []
    return result


def swap_entries(db, tournament_id, category_id, first_id, second_id, actor_id):
    """Exchange two entries in the preview (positions in the bracket, or groups)."""
    tournament, category = _lock(db, tournament_id, category_id)
    _require_registrations_closed(tournament)
    if category['status'] != 'drawn':
        raise TournamentError('Só é possível trocar posições na pré-visualização do sorteio.', 409, code='not_preview')
    if first_id == second_id:
        raise TournamentError('Escolha dois inscritos diferentes.')
    found = db.execute(
        "SELECT id FROM tournament_registrations WHERE category_id = %s AND status = 'confirmed' AND id = ANY(%s)",
        (category_id, [first_id, second_id])).fetchall()
    if len(found) != 2:
        raise TournamentError('Inscrito não encontrado neste sorteio.', 404)

    if category['draw_format'] == 'knockout':
        _swap_in_bracket(db, category_id, first_id, second_id)
    else:
        _swap_between_groups(db, category_id, first_id, second_id)
    log_audit(db, tournament_id, 'draw_swap', {'registrations': [first_id, second_id]}, category_id, actor_id)
    return get_draw(db, tournament_id, category_id)


def _swap_in_bracket(db, category_id, first_id, second_id):
    swap = {first_id: second_id, second_id: first_id}
    for match in db.execute(
            "SELECT id, entry1_id, entry2_id, outcome, next_match_id, next_slot FROM tournament_matches "
            "WHERE category_id = %s AND stage = 'knockout' AND round_number = 1", (category_id,)).fetchall():
        entry1, entry2 = swap.get(match['entry1_id'], match['entry1_id']), swap.get(match['entry2_id'], match['entry2_id'])
        if (entry1, entry2) == (match['entry1_id'], match['entry2_id']):
            continue
        is_bye = match['outcome'] == 'bye'
        winner = (entry1 or entry2) if is_bye else None
        db.execute('UPDATE tournament_matches SET entry1_id = %s, entry2_id = %s, winner_entry_id = %s WHERE id = %s',
                   (entry1, entry2, winner, match['id']))
        if is_bye:  # the player who advances on a bye changed
            db.execute(f"UPDATE tournament_matches SET entry{match['next_slot']}_id = %s WHERE id = %s", (winner, match['next_match_id']))


def _swap_between_groups(db, category_id, first_id, second_id):
    group_of = {row['registration_id']: row['group_id'] for row in db.execute(
        'SELECT ge.group_id, ge.registration_id FROM tournament_group_entries ge JOIN tournament_groups g ON g.id = ge.group_id '
        'WHERE g.category_id = %s AND ge.registration_id = ANY(%s)', (category_id, [first_id, second_id])).fetchall()}
    if group_of[first_id] == group_of[second_id]:
        raise TournamentError('Os dois inscritos já estão no mesmo grupo: a troca não teria efeito.')
    db.execute('UPDATE tournament_group_entries SET group_id = %s WHERE registration_id = %s', (group_of[second_id], first_id))
    db.execute('UPDATE tournament_group_entries SET group_id = %s WHERE registration_id = %s', (group_of[first_id], second_id))
    db.execute(
        "UPDATE tournament_matches SET "
        "entry1_id = CASE entry1_id WHEN %s THEN %s WHEN %s THEN %s ELSE entry1_id END, "
        "entry2_id = CASE entry2_id WHEN %s THEN %s WHEN %s THEN %s ELSE entry2_id END "
        "WHERE category_id = %s AND stage = 'group'",
        (first_id, second_id, second_id, first_id, first_id, second_id, second_id, first_id, category_id))


def publish_draw(db, tournament_id, category_id, actor_id):
    tournament, category = _lock(db, tournament_id, category_id)
    _require_registrations_closed(tournament)
    if category['status'] != 'drawn':
        raise TournamentError('Gere o sorteio antes de publicá-lo.', 409, code='not_drawn')
    db.execute("UPDATE tournament_categories SET status = 'published' WHERE id = %s", (category_id,))
    log_audit(db, tournament_id, 'draw_published', _snapshot(db, category_id), category_id, actor_id)
    return get_draw(db, tournament_id, category_id)


def undo_draw(db, tournament_id, category_id, actor_id):
    """Back to awaiting_draw. Only while no admin has recorded a result (byes and automatic walkovers do not count)."""
    _, category = _lock(db, tournament_id, category_id)
    if category['status'] == 'awaiting_draw':
        raise TournamentError('Esta categoria não tem sorteio.', 409, code='no_draw')
    played = db.execute(
        "SELECT 1 FROM tournament_matches WHERE category_id = %s AND status = 'completed' AND result_by IS NOT NULL LIMIT 1",
        (category_id,)).fetchone()
    if played:
        raise TournamentError('Já há resultados lançados: o sorteio não pode ser desfeito.', 409, code='results_exist')
    _clear_draw(db, category_id)
    db.execute("UPDATE tournament_categories SET status = 'awaiting_draw' WHERE id = %s", (category_id,))
    log_audit(db, tournament_id, 'draw_undone', {'from': category['status']}, category_id, actor_id)
