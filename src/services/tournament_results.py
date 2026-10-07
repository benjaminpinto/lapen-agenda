"""Match results: record, correct, annul, and everything a result sets in motion.

One transaction per call (routes commit). Writes inside a category are serialized by locking the category row,
and a result is only written `WHERE status = 'pending'`, so two requests for the same match cannot both win.

What a result sets in motion:
- knockout: the winner moves to the next match. A double W.O. leaves a void slot, so the opponent there
  advances by a bye; an entrant who withdrew from the tournament loses by W.O. as soon as the opponent is known
- groups: when the last match of every group is in (and no tie is waiting for the organizer) the qualifiers are
  confirmed and enter the knockout phase
- statistics: a row in match_statistics_unified when at least one player is a LAPEN member
- category status: published, group_stage, knockout_stage, finished

Results written by the system (byes, walkovers caused by a withdrawal) have no result_by; those never block a
correction. A result typed by an admin does.
"""
import random
import re
from datetime import datetime

from src.services import tournament_draw as draw
from src.services import tournament_draw_service as draw_svc
from src.services import tournament_standings as standings
from src.services.tournament_schedule import SLOT_MINUTES
from src.services.tournament_service import (
    ACTIVE_STATUSES, DRAWN_CATEGORY_STATUSES, TERMINAL_STATUSES, TournamentError, get_category, get_tournament,
    log_audit,
    parse_id, serialize_category,
)
from src.utils.score_parser import parse_tournament_score, strip_retirement, validate_retired_score, validate_score
from src.utils.time_utils import local_now

OUTCOMES = ('normal', 'wo', 'double_wo', 'retired')
VOID_LABEL = 'Sem adversário (duplo W.O.)'
GROUP_LABEL = re.compile(r'^(\d)º Grupo (\w+)$')


# --- small readers -------------------------------------------------------------------------------

def _fetch(db, match_id, lock=True):
    return db.execute(f"SELECT * FROM tournament_matches WHERE id = %s{' FOR UPDATE' if lock else ''}", (match_id,)).fetchone()


def _withdrawn(db, registration_id):
    row = db.execute('SELECT status FROM tournament_registrations WHERE id = %s', (registration_id,)).fetchone()
    return bool(row) and row['status'] == 'withdrawn'


def _qualifiers(category):
    return category['qualifiers_per_group'] if category['draw_format'] == 'groups_knockout' else 1


def _total_rounds(db, category_id):
    return db.execute("SELECT COALESCE(MAX(round_number), 0) AS n FROM tournament_matches WHERE category_id = %s AND stage = 'knockout'",
                      (category_id,)).fetchone()['n']


def _feeder_label(db, following, slot):
    feeder = db.execute('SELECT round_number, bracket_position FROM tournament_matches WHERE next_match_id = %s AND next_slot = %s',
                        (following['id'], slot)).fetchone()
    return draw.winner_label(feeder['round_number'], feeder['bracket_position'], _total_rounds(db, following['category_id']))


# --- statistics (RF-80..83) ----------------------------------------------------------------------------

def _sync_statistics(db, match_id, actor_id=None):
    """Make match_statistics_unified agree with the match: one row when it is a played result and a member is in it."""
    match = _fetch(db, match_id, lock=False)
    existing = db.execute('SELECT id FROM match_statistics_unified WHERE tournament_match_id = %s', (match_id,)).fetchone()
    wanted = None
    if match['status'] == 'completed' and match['outcome'] in ('normal', 'wo', 'retired'):
        people = {row['id']: row for row in db.execute(
            'SELECT r.id, r.display_name, r.user_id, u.short_name FROM tournament_registrations r '
            'LEFT JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL WHERE r.id = ANY(%s)',
            ([match['entry1_id'], match['entry2_id']],)).fetchall()}
        first, second, winner = people[match['entry1_id']], people[match['entry2_id']], people[match['winner_entry_id']]
        if first['user_id'] or second['user_id']:
            name = lambda person: person['short_name'] or person['display_name']  # noqa: E731
            played = match['played_at'].date() if match['played_at'] else local_now().date()
            wanted = (first['user_id'], second['user_id'], name(first), name(second), winner['user_id'], name(winner),
                      match['score'], played)
    if wanted is None:
        if existing:
            db.execute('DELETE FROM match_statistics_unified WHERE id = %s', (existing['id'],))
    elif existing:
        db.execute(
            'UPDATE match_statistics_unified SET player1_id = %s, player2_id = %s, player1_name = %s, player2_name = %s, '
            'winner_id = %s, winner_name = %s, score = %s, match_date = %s WHERE id = %s', wanted + (existing['id'],))
    else:
        db.execute(
            "INSERT INTO match_statistics_unified (tournament_match_id, player1_id, player2_id, player1_name, player2_name, "
            "winner_id, winner_name, score, match_type, match_date, added_by) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Torneio', %s, %s)", (match_id,) + wanted[:7] + (wanted[7], actor_id))


# --- knockout mechanics ------------------------------------------------------------------------------------

def _set_slot(db, match_id, slot, entry_id, source):
    db.execute(f'UPDATE tournament_matches SET entry{slot}_id = %s, entry{slot}_source = %s WHERE id = %s', (entry_id, source, match_id))


def _complete_auto(db, match, outcome, winner_id, actor_id=None):
    """A result nobody typed: a bye or a walkover. It advances the winner."""
    db.execute(
        "UPDATE tournament_matches SET status = 'completed', outcome = %s, winner_entry_id = %s, score = %s, played_at = NULL, "
        "result_by = NULL, result_at = CURRENT_TIMESTAMP WHERE id = %s",
        (outcome, winner_id, 'W.O.' if outcome == 'wo' else None, match['id']))
    _sync_statistics(db, match['id'], actor_id)
    _propagate(db, match['id'], actor_id)


def _propagate(db, match_id, actor_id=None):
    match = _fetch(db, match_id)
    if match['stage'] != 'knockout' or not match['next_match_id']:
        return
    if match['winner_entry_id']:
        _set_slot(db, match['next_match_id'], match['next_slot'], match['winner_entry_id'], None)
    else:  # double W.O.: nobody comes out of this match
        _set_slot(db, match['next_match_id'], match['next_slot'], None, VOID_LABEL)
    _settle(db, match['next_match_id'], actor_id)


def _settle(db, match_id, actor_id=None):
    """Resolve a knockout match that no longer needs to be played: void feeder, or a withdrawn entrant."""
    match = _fetch(db, match_id)
    if match['status'] == 'completed' or match['stage'] != 'knockout':
        return
    first, second = match['entry1_id'], match['entry2_id']
    void = {row['next_slot']: row['status'] == 'completed' and row['outcome'] == 'double_wo' for row in db.execute(
        'SELECT next_slot, status, outcome FROM tournament_matches WHERE next_match_id = %s', (match_id,)).fetchall()}
    if void.get(1) and void.get(2):
        _complete_auto(db, match, 'double_wo', None, actor_id)
    elif void.get(1) or void.get(2):
        present = second if void.get(1) else first
        if present is not None:
            _complete_auto(db, match, 'bye', present, actor_id)
    elif first is not None and second is not None:
        gone_first, gone_second = _withdrawn(db, first), _withdrawn(db, second)
        if gone_first and gone_second:
            _complete_auto(db, match, 'double_wo', None, actor_id)
        elif gone_first or gone_second:
            _complete_auto(db, match, 'wo', second if gone_first else first, actor_id)


def _clear_result(db, match_id, keep_statistics=False):
    """Back to pending, taking away what the result had set in motion (the downstream results are automatic ones).

    A correction keeps the statistics row of the corrected match: the new result updates it in place.
    """
    match = _fetch(db, match_id)
    db.execute(
        "UPDATE tournament_matches SET status = 'pending', outcome = NULL, winner_entry_id = NULL, score = NULL, played_at = NULL, "
        "result_by = NULL, result_at = NULL WHERE id = %s", (match_id,))
    if not keep_statistics:
        _sync_statistics(db, match_id)
    if match['stage'] == 'knockout' and match['next_match_id']:
        following = _fetch(db, match['next_match_id'])
        if following['status'] == 'completed':
            _clear_result(db, following['id'])
        _set_slot(db, following['id'], match['next_slot'], None, _feeder_label(db, following, match['next_slot']))


def _settle_all(db, category_id, actor_id=None):
    for match in db.execute("SELECT id FROM tournament_matches WHERE category_id = %s AND stage = 'knockout' AND status = 'pending' "
                            'ORDER BY round_number, bracket_position', (category_id,)).fetchall():
        _settle(db, match['id'], actor_id)


# --- groups: tables, qualification, category status ---------------------------------------------------------------

def group_tables(db, tournament, category):
    qualifiers = _qualifiers(category)
    groups = db.execute('SELECT id, name FROM tournament_groups WHERE category_id = %s ORDER BY name', (category['id'],)).fetchall()
    members = db.execute(
        'SELECT ge.group_id, ge.registration_id, ge.manual_rank FROM tournament_group_entries ge '
        'JOIN tournament_groups g ON g.id = ge.group_id WHERE g.category_id = %s', (category['id'],)).fetchall()
    matches = db.execute(
        "SELECT group_id, entry1_id, entry2_id, status, outcome, winner_entry_id, score FROM tournament_matches "
        "WHERE category_id = %s AND stage = 'group'", (category['id'],)).fetchall()
    tables = []
    for group in groups:
        mine = [m for m in members if m['group_id'] == group['id']]
        result = standings.compute_standings(
            [m['registration_id'] for m in mine],
            [{'entry1': m['entry1_id'], 'entry2': m['entry2_id'], 'status': m['status'], 'outcome': m['outcome'],
              'winner': m['winner_entry_id'], 'score': m['score']} for m in matches if m['group_id'] == group['id']],
            qualifiers, tournament['match_format'], tournament['match_tiebreak_points'],
            {m['registration_id']: m['manual_rank'] for m in mine if m['manual_rank'] is not None})
        tables.append({'group': group, 'result': result})
    return tables


def _sync_knockout(db, category, tables, all_confirmed, actor_id):
    """Put the confirmed qualifiers into the knockout phase (and take them out again if a group is no longer settled)."""
    per_group = category['qualifiers_per_group']
    total = len(tables) * per_group
    qualified = {}
    for table in tables:
        if table['result']['confirmed']:
            for row in table['result']['rows']:
                if row['position'] <= per_group:
                    qualified[(table['group']['name'], row['position'])] = row['entry']

    knockout = db.execute("SELECT * FROM tournament_matches WHERE category_id = %s AND stage = 'knockout' ORDER BY round_number, bracket_position",
                          (category['id'],)).fetchall()

    if total & (total - 1) == 0:  # the bracket exists since the draw, with slots like "1º Grupo A"
        touched = []
        for match in (m for m in knockout if m['round_number'] == 1):
            for slot in (1, 2):
                found = GROUP_LABEL.match(match[f'entry{slot}_source'])
                wanted = qualified.get((found.group(2), int(found.group(1))))
                if wanted != match[f'entry{slot}_id']:
                    if match['status'] == 'completed':
                        _clear_result(db, match['id'])
                    db.execute(f'UPDATE tournament_matches SET entry{slot}_id = %s WHERE id = %s', (wanted, match['id']))
                    touched.append(match['id'])
        for match_id in dict.fromkeys(touched):
            _settle(db, match_id, actor_id)
        return

    # Qualifiers that do not fill a bracket: it is drawn when every group is settled, byes to the best campaigns
    fingerprint = None
    if all_confirmed:
        winners = standings.campaign_order([(t['group']['name'], next(r for r in t['result']['rows'] if r['position'] == 1)) for t in tables])
        runners = [(t['group']['name'], next(r for r in t['result']['rows'] if r['position'] == 2)['entry']) for t in tables] if per_group == 2 else []
        fingerprint = {'winners': [row['entry'] for _, row in winners], 'runners': sorted(entry for _, entry in runners)}
    last = db.execute("SELECT payload FROM tournament_audit_log WHERE category_id = %s AND action = 'knockout_built' ORDER BY id DESC LIMIT 1",
                      (category['id'],)).fetchone()
    if knockout and (last is None or last['payload'].get('fingerprint') != fingerprint):
        db.execute("DELETE FROM tournament_matches WHERE category_id = %s AND stage = 'knockout'", (category['id'],))
        knockout = []
    if all_confirmed and not knockout:
        seed = draw_svc.new_seed()
        lines = draw.knockout_lines_from_groups([(name, row['entry']) for name, row in winners], runners, random.Random(seed))
        draw_svc.create_knockout_matches(db, category['id'], lines)
        log_audit(db, category['tournament_id'], 'knockout_built', {'rng_seed': seed, 'fingerprint': fingerprint, 'lines': lines},
                  category['id'], actor_id)
        _settle_all(db, category['id'], actor_id)


def _derive_status(db, category, groups_confirmed):
    rows = db.execute('SELECT stage, status, outcome, next_match_id FROM tournament_matches WHERE category_id = %s', (category['id'],)).fetchall()
    knockout = [m for m in rows if m['stage'] == 'knockout']
    final_done = any(m['next_match_id'] is None and m['status'] == 'completed' for m in knockout)
    any_group_result = any(m['stage'] == 'group' and m['status'] == 'completed' for m in rows)
    any_knockout_result = any(m['status'] == 'completed' and m['outcome'] != 'bye' for m in knockout)
    fmt = category['draw_format']
    if fmt == 'knockout':
        return 'finished' if final_done else ('knockout_stage' if any_knockout_result else 'published')
    if fmt == 'round_robin':
        return 'finished' if groups_confirmed else ('group_stage' if any_group_result else 'published')
    if final_done:
        return 'finished'
    return 'knockout_stage' if groups_confirmed else ('group_stage' if any_group_result else 'published')


def _reconcile(db, tournament, category_id, actor_id):
    category = get_category(db, tournament['id'], category_id)
    confirmed = False
    if category['draw_format'] != 'knockout':
        tables = group_tables(db, tournament, category)
        confirmed = bool(tables) and all(t['result']['confirmed'] for t in tables)
        if category['draw_format'] == 'groups_knockout':
            _sync_knockout(db, category, tables, confirmed, actor_id)
    status = _derive_status(db, category, confirmed)
    if status != category['status']:
        db.execute('UPDATE tournament_categories SET status = %s WHERE id = %s', (status, category_id))


def get_standings(db, tournament_id, category_id):
    """Table of every group, ready for the screens (admin now, public later)."""
    tournament = get_tournament(db, tournament_id)
    category = get_category(db, tournament_id, category_id)
    people = {r['id']: r for r in db.execute('SELECT id, display_name, seed FROM tournament_registrations WHERE category_id = %s', (category_id,)).fetchall()}

    def person(registration_id):
        return {'registration_id': registration_id, 'display_name': people[registration_id]['display_name']}

    groups = []
    for table in group_tables(db, tournament, category):
        result = table['result']
        groups.append({
            'id': table['group']['id'], 'name': table['group']['name'], 'complete': result['complete'], 'blocked': result['blocked'],
            'confirmed': result['confirmed'],
            'ties': [{'entries': [person(e) for e in tie['entries']], 'relevant': tie['relevant']} for tie in result['ties']],
            'rows': [dict({key: value for key, value in row.items() if key != 'entry'}, **person(row['entry']),
                          seed=people[row['entry']]['seed']) for row in result['rows']],
        })
    return {'category': serialize_category(category), 'qualifiers_per_group': _qualifiers(category), 'groups': groups}


# --- recording --------------------------------------------------------------------------------------------------

def _prepare(db, tournament_id, match_id):
    tournament = get_tournament(db, tournament_id, lock=True)
    found = db.execute('SELECT m.category_id FROM tournament_matches m JOIN tournament_categories c ON c.id = m.category_id '
                       'WHERE m.id = %s AND c.tournament_id = %s', (match_id, tournament_id)).fetchone()
    if not found:
        raise TournamentError('Partida não encontrada.', 404)
    if tournament['status'] in TERMINAL_STATUSES:
        raise TournamentError('Torneio finalizado ou cancelado: os resultados não podem mais mudar.', 409, code='tournament_locked')
    category = get_category(db, tournament_id, found['category_id'], lock=True)
    match = _fetch(db, match_id)
    if tournament['status'] != 'in_progress':
        raise TournamentError('Inicie o torneio antes de lançar resultados.', 409, code='tournament_not_started')
    if category['status'] not in DRAWN_CATEGORY_STATUSES:
        raise TournamentError('O sorteio desta categoria ainda não foi publicado.', 409, code='draw_not_published')
    if match['outcome'] == 'bye':
        raise TournamentError('Uma partida com bye não tem resultado a lançar.', 409, code='bye_match')
    return tournament, category, match


def _parse_result(db, tournament, match, data):
    outcome = data.get('outcome', 'normal')
    if outcome not in OUTCOMES:
        raise TournamentError('Desfecho inválido: use normal, wo, double_wo ou retired.')
    if match['entry1_id'] is None or match['entry2_id'] is None:
        raise TournamentError('A partida ainda não tem os dois jogadores definidos.', 409, code='match_not_ready')

    winner = None
    if outcome != 'double_wo':
        winner = parse_id(data.get('winner_registration_id'), 'Vencedor')
        if winner not in (match['entry1_id'], match['entry2_id']):
            raise TournamentError('O vencedor deve ser um dos dois jogadores da partida.')

    fmt, points = tournament['match_format'], tournament['match_tiebreak_points']
    score = None
    if outcome == 'wo':
        score = 'W.O.'
    elif outcome in ('normal', 'retired'):
        text = data.get('score')
        if not isinstance(text, str) or not text.strip():
            raise TournamentError('Informe o placar.')
        if outcome == 'retired':
            text, _ = strip_retirement(text)
        text = ', '.join(part.strip() for part in text.split(',') if part.strip())
        if outcome == 'normal':
            valid, error = validate_score(text, fmt, points, strict=True)
            if valid:
                parsed = parse_tournament_score(text, fmt, points)
                side = match['entry1_id'] if parsed['p1_sets'] > parsed['p2_sets'] else match['entry2_id']
                if side != winner:
                    raise TournamentError('O vencedor não corresponde ao placar. Escreva o placar do ponto de vista do primeiro jogador da partida.', 400, code='winner_mismatch')
            score = text
        else:
            valid, error = validate_retired_score(text, fmt, points)
            score = text + ' ret.'
        if not valid:
            raise TournamentError(f'Placar inválido: {error}', 400, code='invalid_score')

    played_at = data.get('played_at')
    if played_at in (None, ''):
        played_at = datetime.combine(match['planned_date'], match['planned_time']) if match['planned_date'] else local_now()
    elif isinstance(played_at, str):
        try:
            played_at = datetime.fromisoformat(played_at)
        except ValueError:
            raise TournamentError('Data da partida inválida (use AAAA-MM-DD).')
        if played_at.tzinfo is not None:
            raise TournamentError('A data da partida deve ser em horário local, sem fuso.')
    else:
        raise TournamentError('Data da partida inválida (use AAAA-MM-DD).')
    return {'outcome': outcome, 'winner': winner, 'score': score, 'played_at': played_at}


def _apply(db, match, parsed, actor_id):
    row = db.execute(
        "UPDATE tournament_matches SET status = 'completed', outcome = %s, winner_entry_id = %s, score = %s, played_at = %s, "
        "result_by = %s, result_at = CURRENT_TIMESTAMP WHERE id = %s AND status = 'pending' RETURNING id",
        (parsed['outcome'], parsed['winner'], parsed['score'], parsed['played_at'], actor_id, match['id'])).fetchone()
    if not row:  # somebody else got there first
        raise TournamentError('Esta partida já tem resultado.', 409, code='result_exists')
    if match['stage'] == 'group':  # a decision about a tie is only valid for the results it was taken on
        db.execute('UPDATE tournament_group_entries SET manual_rank = NULL WHERE group_id = %s', (match['group_id'],))
    else:
        _propagate(db, match['id'], actor_id)
    _sync_statistics(db, match['id'], actor_id)


def _played_downstream(db, match):
    """True when a result typed by an admin depends on this one (RF-64)."""
    if match['stage'] == 'group':
        return db.execute("SELECT 1 FROM tournament_matches WHERE category_id = %s AND stage = 'knockout' AND status = 'completed' "
                          'AND result_by IS NOT NULL LIMIT 1', (match['category_id'],)).fetchone() is not None
    current = match
    while current['next_match_id']:
        following = _fetch(db, current['next_match_id'], lock=False)
        if following['status'] != 'completed':
            return False
        if following['result_by'] is not None:
            return True
        current = following
    return False


def _summary(db, tournament, category_id, match_id):
    category = get_category(db, tournament['id'], category_id)
    result = {'match_id': match_id, 'category': serialize_category(category),
              'draw': draw_svc.get_draw(db, tournament['id'], category_id)['draw']}
    if category['draw_format'] != 'knockout':
        result['standings'] = get_standings(db, tournament['id'], category_id)['groups']
    return result


def _audit_payload(parsed, match):
    return {'match_id': match['id'], 'outcome': parsed['outcome'], 'winner': parsed['winner'], 'score': parsed['score']}


def record_result(db, tournament_id, match_id, data, actor_id):
    tournament, category, match = _prepare(db, tournament_id, match_id)
    if match['status'] != 'pending':
        raise TournamentError('Esta partida já tem resultado. Para mudá-lo, corrija o resultado.', 409, code='result_exists')
    parsed = _parse_result(db, tournament, match, data)
    _apply(db, match, parsed, actor_id)
    log_audit(db, tournament_id, 'result_recorded', _audit_payload(parsed, match), category['id'], actor_id)
    _reconcile(db, tournament, category['id'], actor_id)
    return _summary(db, tournament, category['id'], match_id)


def _require_correctable(db, match):
    if match['status'] != 'completed':
        raise TournamentError('Esta partida não tem resultado.', 409, code='no_result')
    if match['result_by'] is None:
        raise TournamentError('Resultado automático (W.O. por desistência ou bye): não pode ser corrigido por aqui.', 409, code='automatic_result')
    if _played_downstream(db, match):
        raise TournamentError('A partida seguinte já tem resultado: a correção não é mais possível.' if match['stage'] == 'knockout'
                              else 'O mata-mata já tem resultados: os jogos dos grupos não podem mais mudar.', 409, code='next_match_played')


def correct_result(db, tournament_id, match_id, data, actor_id):
    tournament, category, match = _prepare(db, tournament_id, match_id)
    _require_correctable(db, match)
    parsed = _parse_result(db, tournament, match, data)
    before = _audit_payload({'outcome': match['outcome'], 'winner': match['winner_entry_id'], 'score': match['score']}, match)
    _clear_result(db, match_id, keep_statistics=True)
    _apply(db, _fetch(db, match_id), parsed, actor_id)
    log_audit(db, tournament_id, 'result_corrected', dict(_audit_payload(parsed, match), before=before), category['id'], actor_id)
    _reconcile(db, tournament, category['id'], actor_id)
    return _summary(db, tournament, category['id'], match_id)


def annul_result(db, tournament_id, match_id, actor_id):
    tournament, category, match = _prepare(db, tournament_id, match_id)
    _require_correctable(db, match)
    before = _audit_payload({'outcome': match['outcome'], 'winner': match['winner_entry_id'], 'score': match['score']}, match)
    _clear_result(db, match_id)
    if match['stage'] == 'group':
        db.execute('UPDATE tournament_group_entries SET manual_rank = NULL WHERE group_id = %s', (match['group_id'],))
    log_audit(db, tournament_id, 'result_annulled', before, category['id'], actor_id)
    _reconcile(db, tournament, category['id'], actor_id)
    return _summary(db, tournament, category['id'], match_id)


# --- withdrawal ----------------------------------------------------------------------------------------------------

def apply_withdrawal(db, tournament_id, registration_id, actor_id):
    """A confirmed entrant leaves after the draw: what he already played stays, the rest becomes walkovers."""
    tournament = get_tournament(db, tournament_id, lock=True)
    category_id = db.execute('SELECT category_id FROM tournament_registrations WHERE id = %s', (registration_id,)).fetchone()['category_id']
    category = get_category(db, tournament_id, category_id, lock=True)
    pending = db.execute(
        "SELECT * FROM tournament_matches WHERE category_id = %s AND status = 'pending' AND (entry1_id = %s OR entry2_id = %s) "
        'ORDER BY stage, round_number, bracket_position', (category_id, registration_id, registration_id)).fetchall()
    for match in pending:
        if match['stage'] == 'knockout':
            _settle(db, match['id'], actor_id)
            continue
        opponent = match['entry2_id'] if match['entry1_id'] == registration_id else match['entry1_id']
        if _withdrawn(db, opponent):
            _complete_auto(db, match, 'double_wo', None, actor_id)
        else:
            _complete_auto(db, match, 'wo', opponent, actor_id)
        db.execute('UPDATE tournament_group_entries SET manual_rank = NULL WHERE group_id = %s', (match['group_id'],))
    log_audit(db, tournament_id, 'withdrawal_applied', {'registration_id': registration_id, 'matches': [m['id'] for m in pending]},
              category['id'], actor_id)
    _reconcile(db, tournament, category['id'], actor_id)


# --- ties ---------------------------------------------------------------------------------------------------------------

def set_group_tiebreak(db, tournament_id, group_id, order, actor_id):
    """The organizer ranks players the criteria could not separate. `order` lists exactly one tied set, best first."""
    tournament = get_tournament(db, tournament_id, lock=True)
    found = db.execute('SELECT g.category_id FROM tournament_groups g JOIN tournament_categories c ON c.id = g.category_id '
                       'WHERE g.id = %s AND c.tournament_id = %s', (group_id, tournament_id)).fetchone()
    if not found:
        raise TournamentError('Grupo não encontrado.', 404)
    if tournament['status'] in TERMINAL_STATUSES:
        raise TournamentError('Torneio finalizado ou cancelado: os resultados não podem mais mudar.', 409, code='tournament_locked')
    category = get_category(db, tournament_id, found['category_id'], lock=True)
    if not isinstance(order, list) or len(order) < 2 or len(set(order)) != len(order):
        raise TournamentError('Informe, em "order", os inscritos empatados do melhor para o pior.')
    order = [parse_id(value, 'Inscrito') for value in order]

    group = next(t for t in group_tables(db, tournament, category) if t['group']['id'] == group_id)
    if not group['result']['complete']:
        raise TournamentError('O grupo ainda tem jogos a disputar: o empate só vale depois que ele terminar.', 409, code='group_not_complete')
    members = [row['registration_id'] for row in db.execute('SELECT registration_id FROM tournament_group_entries WHERE group_id = %s', (group_id,)).fetchall()]
    undecided = standings.compute_standings(
        members, [dict(entry1=m['entry1_id'], entry2=m['entry2_id'], status=m['status'], outcome=m['outcome'], winner=m['winner_entry_id'], score=m['score'])
                  for m in db.execute("SELECT * FROM tournament_matches WHERE group_id = %s", (group_id,)).fetchall()],
        _qualifiers(category), tournament['match_format'], tournament['match_tiebreak_points'])
    if set(order) not in [set(tie['entries']) for tie in undecided['ties']]:
        raise TournamentError('Esses inscritos não estão empatados: o empate é decidido só entre quem os critérios não separam.', 409, code='not_a_tie')
    if _played_downstream(db, {'stage': 'group', 'category_id': category['id']}):
        raise TournamentError('O mata-mata já tem resultados: o desempate não pode mais mudar.', 409, code='next_match_played')

    for rank, registration_id in enumerate(order, start=1):
        db.execute('UPDATE tournament_group_entries SET manual_rank = %s WHERE group_id = %s AND registration_id = %s', (rank, group_id, registration_id))
    log_audit(db, tournament_id, 'tiebreak_decided', {'group_id': group_id, 'order': order}, category['id'], actor_id)
    _reconcile(db, tournament, category['id'], actor_id)
    return get_standings(db, tournament_id, category['id'])


# --- what needs the organizer ---------------------------------------------------------------------------------------

def pending_summary(db):
    """What waits for the admin in the active tournament (or the draft being prepared when none is active)."""
    tournament = db.execute('SELECT * FROM tournaments WHERE status = ANY(%s) ORDER BY id LIMIT 1', (list(ACTIVE_STATUSES),)).fetchone()
    if not tournament:
        tournament = db.execute("SELECT * FROM tournaments WHERE status = 'draft' ORDER BY id DESC LIMIT 1").fetchone()
    if not tournament:
        return {'tournament': None, 'pending_registrations': 0, 'overdue_results': 0, 'ties_to_decide': 0}

    pending = db.execute(
        "SELECT COUNT(*) AS n FROM tournament_registrations r JOIN tournament_categories c ON c.id = r.category_id "
        "WHERE c.tournament_id = %s AND r.status = 'pending'", (tournament['id'],)).fetchone()['n']
    overdue = db.execute(
        "SELECT COUNT(*) AS n FROM tournament_matches m JOIN tournament_categories c ON c.id = m.category_id "
        "WHERE c.tournament_id = %s AND m.status = 'pending' AND m.planned_date IS NOT NULL "
        "AND m.planned_date + m.planned_time + make_interval(mins => %s) < %s "
        "AND m.entry1_id IS NOT NULL AND m.entry2_id IS NOT NULL", (tournament['id'], SLOT_MINUTES, local_now())).fetchone()['n']
    ties = 0
    for category in db.execute("SELECT * FROM tournament_categories WHERE tournament_id = %s AND draw_format <> 'knockout' AND status = ANY(%s)",
                               (tournament['id'], ['published', 'group_stage', 'knockout_stage'])).fetchall():
        ties += sum(1 for table in group_tables(db, tournament, category) if table['result']['blocked'])
    return {
        'tournament': {'id': tournament['id'], 'name': tournament['name'], 'slug': tournament['slug'], 'status': tournament['status']},
        'pending_registrations': pending, 'overdue_results': overdue, 'ties_to_decide': ties,
    }
