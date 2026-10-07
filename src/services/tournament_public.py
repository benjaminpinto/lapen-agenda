"""Read side of the tournament module: what the public pages and the tracking screen show.

Privacy by construction: registrations are read with only (id, display_name, seed, status), and every payload is built
field by field. E-mail, phone, notes, the member link and the audit data never reach this module's output.
A draft, a cancelled tournament and a category whose draw is only a preview are not public.
"""
import re

from src.services import tournament_draw as draw
from src.services import tournament_results as results
from src.services.tournament_service import ACTIVE_STATUSES, DRAWN_CATEGORY_STATUSES, TournamentError
from src.utils.time_utils import local_now

PUBLIC_STATUSES = ACTIVE_STATUSES + ('finished',)
GROUP_LABEL = re.compile(r'^\d+º Grupo \w+$')
UPCOMING_LIMIT = 5
RESULTS_LIMIT = 5
LIST_LIMIT = 200


def _iso(value):
    return value.isoformat() if value is not None else None


def format_text(tournament):
    """The match format as a sentence, e.g. '2 sets sem vantagem + super tie-break de 10 pts'."""
    advantage = 'sem vantagem' if tournament['no_ad'] else 'com vantagem'
    if tournament['match_format'] == 'best_of_3_super_tb':
        return f"2 sets {advantage} + super tie-break de {tournament['match_tiebreak_points']} pts"
    if tournament['match_format'] == 'pro_set_8':
        return f'Set pro até 8 games, {advantage}'
    return f'Set único até 6 games, {advantage}'


def _registration_state(tournament, now):
    window = {'opens_at': _iso(tournament['registration_opens_at']), 'closes_at': _iso(tournament['registration_closes_at'])}
    if tournament['status'] != 'registration_open':
        return dict(window, open=False, state='closed')
    opens = tournament['registration_opens_at']
    if opens and now < opens:
        return dict(window, open=False, state='not_started')
    return dict(window, open=True, state='open')


def _tournament(tournament, now):
    return {
        'id': tournament['id'], 'name': tournament['name'], 'slug': tournament['slug'],
        'description': tournament['description'], 'location': tournament['location'],
        'start_date': _iso(tournament['start_date']), 'end_date': _iso(tournament['end_date']),
        'rules_text': tournament['rules_text'], 'contact_info': tournament['contact_info'],
        'match_format': tournament['match_format'], 'no_ad': tournament['no_ad'],
        'match_tiebreak_points': tournament['match_tiebreak_points'], 'format_text': format_text(tournament),
        'status': tournament['status'], 'registration': _registration_state(tournament, now),
        'schedule_published': tournament['schedule_published_at'] is not None,
    }


def _load_tournament(db, slug):
    row = db.execute('SELECT * FROM tournaments WHERE slug = %s AND status = ANY(%s)', (slug, list(PUBLIC_STATUSES))).fetchone()
    if not row:
        raise TournamentError('Torneio não encontrado.', 404)
    return row


# --- people and matches ----------------------------------------------------------------------------------

def _people(db, category_id):
    """{registration id: row} with nothing but what may be shown."""
    return {r['id']: r for r in db.execute(
        'SELECT id, display_name, seed, status FROM tournament_registrations WHERE category_id = %s', (category_id,)).fetchall()}


def _person(people, registration_id):
    row = people.get(registration_id)
    if row is None:
        return None
    return {'id': row['id'], 'display_name': row['display_name'], 'seed': row['seed'], 'withdrawn': row['status'] == 'withdrawn'}


def _matches(db, category_id, published):
    """The category's matches. Until the schedule is published, no date, time or court is shown."""
    rows = db.execute(
        'SELECT m.*, c.name AS court_name FROM tournament_matches m LEFT JOIN courts c ON c.id = m.court_id '
        'WHERE m.category_id = %s ORDER BY m.stage, m.round_number, m.bracket_position', (category_id,)).fetchall()
    if published:
        return rows
    return [dict(row, planned_date=None, planned_time=None, court_id=None, court_name=None) for row in rows]


def _match(match, people, total_rounds, groups):
    sides = []
    for slot in (1, 2):
        sides.append({'entry': _person(people, match[f'entry{slot}_id']), 'source': match[f'entry{slot}_source']})
    winner = match['winner_entry_id']
    data = {
        'id': match['id'], 'stage': match['stage'], 'group': groups.get(match['group_id']),
        'round_number': match['round_number'], 'position': match['bracket_position'], 'sides': sides,
        'status': match['status'], 'outcome': match['outcome'], 'score': match['score'],
        'winner_side': 1 if winner and winner == match['entry1_id'] else (2 if winner and winner == match['entry2_id'] else None),
        'played_at': _iso(match['played_at']),
        'planned_date': _iso(match['planned_date']),
        'planned_time': match['planned_time'].strftime('%H:%M') if match['planned_time'] else None,
        'court': match['court_name'],
    }
    if match['stage'] == 'knockout':
        data['round_name'] = draw.round_name(match['round_number'], total_rounds)
    return data


def _is_ready(match):
    return match['status'] == 'pending' and match['entry1_id'] is not None and match['entry2_id'] is not None


def _upcoming_key(match):
    return (match['planned_date'] is None, match['planned_date'] or '', str(match['planned_time'] or ''),
            match['stage'] != 'group', match['round_number'], match['bracket_position'])


def _results_key(match):
    return (match['played_at'] or match['result_at'] or match['created_at'], match['id'])


# --- progress, stage, podium ---------------------------------------------------------------------------------

def _progress(matches):
    real = [m for m in matches if m['outcome'] != 'bye']  # a bye is not a match to be played
    out = {'done': sum(1 for m in real if m['status'] == 'completed'), 'total': len(real)}
    for stage in ('group', 'knockout'):
        mine = [m for m in real if m['stage'] == stage]
        out[stage] = {'done': sum(1 for m in mine if m['status'] == 'completed'), 'total': len(mine)}
    return out


STEP_LABELS = {'registration': 'Inscrições', 'groups': 'Grupos', 'knockout': 'Mata-mata', 'final': 'Final', 'champion': 'Campeão'}
STEPS_BY_FORMAT = {
    'knockout': ('registration', 'knockout', 'final', 'champion'),
    'round_robin': ('registration', 'groups', 'champion'),
    'groups_knockout': ('registration', 'groups', 'knockout', 'final', 'champion'),
}


def _stage(category, matches):
    steps = STEPS_BY_FORMAT[category['draw_format']]
    final = next((m for m in matches if m['stage'] == 'knockout' and m['next_match_id'] is None), None)
    final_ready = final is not None and final['entry1_id'] is not None and final['entry2_id'] is not None
    status = category['status']
    if status in ('awaiting_draw', 'drawn'):
        current = 'registration'
    elif status == 'finished':
        current = 'champion'
    elif category['draw_format'] == 'round_robin' or (category['draw_format'] == 'groups_knockout' and status in ('published', 'group_stage')):
        current = 'groups'
    else:
        current = 'final' if final_ready else 'knockout'
    position = steps.index(current)
    return {
        'current': current,
        'steps': [{'key': key, 'label': STEP_LABELS[key],
                   'state': 'done' if index < position or (status == 'finished' and key == 'champion')
                   else ('current' if index == position else 'upcoming')}
                  for index, key in enumerate(steps)],
    }


def _podium(db, tournament, category, people, matches):
    """(champion, runner-up) of a finished category."""
    if category['status'] != 'finished':
        return None, None
    if category['draw_format'] == 'round_robin':
        tables = results.group_tables(db, tournament, category)
        rows = tables[0]['result']['rows'] if tables else []
        first = next((r for r in rows if r['position'] == 1 and not r['tied']), None)
        second = next((r for r in rows if r['position'] == 2 and not r['tied']), None)
        return _person(people, first['entry']) if first else None, _person(people, second['entry']) if second else None
    final = next((m for m in matches if m['stage'] == 'knockout' and m['next_match_id'] is None), None)
    if not final or final['status'] != 'completed' or not final['winner_entry_id']:
        return None, None
    loser = final['entry2_id'] if final['winner_entry_id'] == final['entry1_id'] else final['entry1_id']
    return _person(people, final['winner_entry_id']), (_person(people, loser) if final['outcome'] != 'bye' else None)


def _category_summary(db, tournament, category, people, matches):
    champion, runner_up = _podium(db, tournament, category, people, matches)
    confirmed = sum(1 for p in people.values() if p['status'] == 'confirmed')
    return {
        'id': category['id'], 'name': category['name'], 'draw_format': category['draw_format'],
        'status': 'awaiting_draw' if category['status'] == 'drawn' else category['status'],
        'stage': _stage(category, matches), 'progress': _progress(matches),
        'capacity': {'confirmed': confirmed, 'max_entries': category['max_entries'], 'min_entries': category['min_entries']},
        'group_target_size': category['group_target_size'], 'qualifiers_per_group': category['qualifiers_per_group'],
        'num_seeds': category['num_seeds'], 'wo_tolerance_min': category['wo_tolerance_min'], 'min_rest_min': category['min_rest_min'],
        'draw_published': category['status'] in DRAWN_CATEGORY_STATUSES,
        'champion': champion, 'runner_up': runner_up,
    }


# --- endpoints --------------------------------------------------------------------------------------------------------

def get_overview(db):
    """The active tournament (if any) and the finished ones."""
    now = local_now()
    current = db.execute('SELECT * FROM tournaments WHERE status = ANY(%s) ORDER BY id LIMIT 1', (list(ACTIVE_STATUSES),)).fetchone()
    finished = db.execute("SELECT * FROM tournaments WHERE status = 'finished' ORDER BY end_date DESC, id DESC LIMIT 50").fetchall()
    history = []
    for tournament in finished:
        categories = []
        for category in db.execute('SELECT * FROM tournament_categories WHERE tournament_id = %s ORDER BY sort_order, id', (tournament['id'],)).fetchall():
            people = _people(db, category['id'])
            champion, _ = _podium(db, tournament, category, people, _matches(db, category['id'], True))
            categories.append({'name': category['name'], 'champion': champion['display_name'] if champion else None})
        history.append(dict(_tournament(tournament, now), categories=categories))
    return {'current': _tournament(current, now) if current else None, 'history': history}


def get_tournament(db, slug):
    now = local_now()
    tournament = _load_tournament(db, slug)
    categories, done, total = [], 0, 0
    for category in db.execute('SELECT * FROM tournament_categories WHERE tournament_id = %s ORDER BY sort_order, id', (tournament['id'],)).fetchall():
        summary = _category_summary(db, tournament, category, _people(db, category['id']), _matches(db, category['id'], True))
        done += summary['progress']['done']
        total += summary['progress']['total']
        categories.append(summary)
    return {'tournament': _tournament(tournament, now), 'categories': categories, 'progress': {'done': done, 'total': total}}


def _entries(people):
    confirmed = [p for p in people.values() if p['status'] == 'confirmed']
    confirmed.sort(key=lambda p: (p['seed'] is None, p['seed'] or 0, p['display_name']))
    return [{'id': p['id'], 'display_name': p['display_name'], 'seed': p['seed']} for p in confirmed]


def _destinations(matches, total_rounds):
    """Where each qualifier goes next: by entry once placed, by "1º Grupo A" label while the slot is still open."""
    first_round = [m for m in matches if m['stage'] == 'knockout' and m['round_number'] == 1]

    def name(match):
        count = sum(1 for m in matches if m['stage'] == 'knockout' and m['round_number'] == match['round_number'])
        round_name = draw.round_name(match['round_number'], total_rounds)
        return round_name if count == 1 else f"{round_name} {match['bracket_position']}"

    by_entry, by_label = {}, {}
    for match in sorted((m for m in matches if m['stage'] == 'knockout'), key=lambda m: (m['round_number'], m['bracket_position'])):
        if match['outcome'] == 'bye':
            continue
        for slot in (1, 2):
            entry = match[f'entry{slot}_id']
            if entry is not None:
                by_entry.setdefault(entry, name(match))
    for match in first_round:
        for slot in (1, 2):
            label = match[f'entry{slot}_source']
            if label and GROUP_LABEL.match(label):
                by_label[label] = name(match)
    return by_entry, by_label


def get_category(db, slug, category_id):
    """Everything the tracking screen needs for one category, in a single request."""
    now = local_now()
    tournament = _load_tournament(db, slug)
    category = db.execute('SELECT * FROM tournament_categories WHERE id = %s AND tournament_id = %s', (category_id, tournament['id'])).fetchone()
    if not category:
        raise TournamentError('Categoria não encontrada.', 404)
    people = _people(db, category_id)
    matches = _matches(db, category_id, tournament['schedule_published_at'] is not None)
    published = category['status'] in DRAWN_CATEGORY_STATUSES  # a preview of the draw is for the organizer only
    visible = matches if published else []
    knockout = [m for m in visible if m['stage'] == 'knockout']
    total_rounds = max((m['round_number'] for m in knockout), default=0)

    groups_data = []
    group_names = {}
    if published and category['draw_format'] != 'knockout':
        by_entry, by_label = _destinations(visible, total_rounds)
        qualifiers = category['qualifiers_per_group'] if category['draw_format'] == 'groups_knockout' else 1
        for table in results.group_tables(db, tournament, category):
            group_names[table['group']['id']] = table['group']['name']
            result = table['result']
            rows = []
            for row in result['rows']:
                destination = None
                if row['state'] == 'qualified' and category['draw_format'] == 'groups_knockout' and row['position'] <= qualifiers:
                    destination = by_entry.get(row['entry']) or by_label.get(f"{row['position']}º Grupo {table['group']['name']}")
                rows.append({
                    'entry': _person(people, row['entry']), 'position': row['position'], 'tied': row['tied'], 'state': row['state'],
                    'played': row['played'], 'wins': row['wins'], 'losses': row['losses'],
                    'sets_won': row['sets_won'], 'sets_lost': row['sets_lost'], 'sets_diff': row['sets_won'] - row['sets_lost'],
                    'games_won': row['games_won'], 'games_lost': row['games_lost'], 'games_diff': row['games_won'] - row['games_lost'],
                    'destination': destination,
                })
            groups_data.append({
                'id': table['group']['id'], 'name': table['group']['name'], 'complete': result['complete'], 'blocked': result['blocked'],
                'confirmed': result['confirmed'], 'qualifiers': qualifiers, 'rows': rows,
                'ties': [{'entries': [_person(people, e) for e in tie['entries']], 'relevant': tie['relevant']} for tie in result['ties']],
            })
    elif published:
        group_names = {g['id']: g['name'] for g in db.execute('SELECT id, name FROM tournament_groups WHERE category_id = %s', (category_id,)).fetchall()}

    def serialize(match):
        return _match(match, people, total_rounds, group_names)

    for group in groups_data:
        group['matches'] = [serialize(m) for m in visible if m['stage'] == 'group' and group_names.get(m['group_id']) == group['name']]
    bracket = None
    if knockout:
        bracket = {'size': 2 * sum(1 for m in knockout if m['round_number'] == 1),
                   'rounds': [{'round_number': r, 'name': draw.round_name(r, total_rounds),
                               'matches': [serialize(m) for m in knockout if m['round_number'] == r]} for r in range(1, total_rounds + 1)]}

    upcoming = sorted((m for m in visible if _is_ready(m)), key=_upcoming_key)[:UPCOMING_LIMIT]
    recent = sorted((m for m in visible if m['status'] == 'completed' and m['outcome'] != 'bye'), key=_results_key, reverse=True)[:RESULTS_LIMIT]
    return {
        'tournament': _tournament(tournament, now),
        'category': _category_summary(db, tournament, category, people, matches),
        'entries': _entries(people),
        'groups': groups_data,
        'bracket': bracket,
        'knockout_pending': category['draw_format'] == 'groups_knockout' and published and bracket is None,
        'upcoming': [serialize(m) for m in upcoming],
        'results': [serialize(m) for m in recent],
    }


def list_matches(db, slug, view, category_id=None, stage=None):
    """Upcoming games or results across the tournament (or one category), for the Jogos and Resultados tabs."""
    if view not in ('upcoming', 'results'):
        raise TournamentError('Use view=upcoming ou view=results.')
    if stage not in (None, 'group', 'knockout'):
        raise TournamentError('Fase inválida: use group ou knockout.')
    tournament = _load_tournament(db, slug)
    categories = db.execute(
        'SELECT * FROM tournament_categories WHERE tournament_id = %s AND status = ANY(%s) ORDER BY sort_order, id',
        (tournament['id'], list(DRAWN_CATEGORY_STATUSES))).fetchall()
    if category_id is not None:
        categories = [c for c in categories if c['id'] == category_id]
    found = []
    for category in categories:
        people = _people(db, category['id'])
        matches = [m for m in _matches(db, category['id'], tournament['schedule_published_at'] is not None) if stage in (None, m['stage'])]
        total_rounds = _total_rounds(db, category['id'])
        names = {g['id']: g['name'] for g in db.execute('SELECT id, name FROM tournament_groups WHERE category_id = %s', (category['id'],)).fetchall()}
        chosen = [m for m in matches if _is_ready(m)] if view == 'upcoming' else [m for m in matches if m['status'] == 'completed' and m['outcome'] != 'bye']
        found += [(m, dict(_match(m, people, total_rounds, names), category={'id': category['id'], 'name': category['name']})) for m in chosen]
    if view == 'upcoming':
        found.sort(key=lambda pair: _upcoming_key(pair[0]))
    else:
        found.sort(key=lambda pair: _results_key(pair[0]), reverse=True)
    return {'view': view, 'matches': [data for _, data in found[:LIST_LIMIT]]}


def _total_rounds(db, category_id):
    return db.execute("SELECT COALESCE(MAX(round_number), 0) AS n FROM tournament_matches WHERE category_id = %s AND stage = 'knockout'",
                      (category_id,)).fetchone()['n']
