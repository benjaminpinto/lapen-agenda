"""Tournaments in a known state, for end-to-end tests and visual checks.

Only the test endpoints (src/routes/test.py, closed unless E2E_TEST_SECRET is set) reach this module. It builds everything
through the real services (create, register, draw, publish, record results), so a seeded tournament is exactly what the
application would produce, with a reproducible draw.
"""
import secrets
import unicodedata
from datetime import timedelta

from src.auth import hash_password
from src.services import tournament_draw_service as draw_svc
from src.services import tournament_results as results_svc
from src.services import tournament_schedule_service as schedule_svc
from src.services import tournament_service as svc
from src.utils.time_utils import local_now

STATES = ('registration_open', 'before_draw', 'before_schedule', 'groups_in_progress', 'tie_pending', 'knockout_in_progress', 'finished')
DOMAIN = '@e2e.test'
ACTOR_EMAIL = 'seed-admin' + DOMAIN
SEED_COURT = 'E2E Court'
PRIVATE_NOTE = 'NOTA-PRIVADA'  # planted in every registration so tests can prove it never leaks
NAMES = [
    'Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Rocha', 'Elisa Prado', 'Fábio Costa', 'Gabriela Nunes', 'Hugo Pereira',
    'Iara Mendes', 'João Barros', 'Karina Alves', 'Lucas Ramos', 'Marina Teixeira', 'Nelson Vieira', 'Olívia Castro', 'Paulo Moraes',
]
SCORES = ['6-0, 6-0', '6-1, 6-2', '6-2, 6-3', '7-5, 6-4', '6-4, 3-6, 10-8', '6-3, 7-6']
RNG_SEED = 1


def create_user(db, label, is_admin=False, member=False, approved=False):
    """A verified user with a random password (returned once). For logging in during end-to-end tests."""
    password = secrets.token_urlsafe(12)
    row = db.execute(
        'INSERT INTO users (email, password_hash, name, short_name, is_verified, is_admin, is_lapen_member, lapen_approved) '
        'VALUES (%s, %s, %s, %s, TRUE, %s, %s, %s) RETURNING id',
        (f'{label}{DOMAIN}', hash_password(password), f'E2E {label}', f'E2E {label}', is_admin, member, approved)).fetchone()
    return {'id': row['id'], 'email': f'{label}{DOMAIN}', 'password': password}


def _actor(db):
    row = db.execute('SELECT id FROM users WHERE email = %s', (ACTOR_EMAIL,)).fetchone()
    if row:
        return row['id']
    return db.execute(
        "INSERT INTO users (email, password_hash, name, short_name, is_verified, is_admin) VALUES (%s, 'x', 'E2E seed admin', 'E2E seed admin', TRUE, TRUE) RETURNING id",
        (ACTOR_EMAIL,)).fetchone()['id']


def cleanup(db, prefix='e2e-'):
    removed = db.execute('DELETE FROM tournaments WHERE slug LIKE %s RETURNING id', (prefix + '%',)).fetchall()
    users = db.execute('DELETE FROM users WHERE email LIKE %s RETURNING id', ('%' + DOMAIN,)).fetchall()
    db.execute('DELETE FROM courts WHERE name = %s', (SEED_COURT,))
    return {'tournaments': len(removed), 'users': len(users)}


def seed_courts(db, limit=2):
    """Up to `limit` active courts for the schedule. A database with none gets one of our own (removed by cleanup)."""
    ids = [c['id'] for c in db.execute('SELECT id FROM courts WHERE COALESCE(active, TRUE) ORDER BY id LIMIT %s', (limit,)).fetchall()]
    if not ids:
        ids = [db.execute("INSERT INTO courts (name, type, active) VALUES (%s, 'Saibro', TRUE) "
                          "ON CONFLICT (name) DO UPDATE SET active = TRUE RETURNING id", (SEED_COURT,)).fetchone()['id']]
    return ids


def _register(db, category_id, number, name, status='confirmed', seed=None):
    first = unicodedata.normalize('NFKD', name.split()[0]).encode('ascii', 'ignore').decode().lower()
    db.execute(
        'INSERT INTO tournament_registrations (category_id, full_name, display_name, email, phone, notes, status, seed, '
        'terms_accepted_at, data_consent_at, ip_hash) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, %s)',
        (category_id, name, name, f'{first}.{number}@seed.example.test', f'2499999{number:04d}', PRIVATE_NOTE, status, seed, 'seed-ip-hash'))


def _fill(db, category, count, pending=0, seeds=0, offset=0):
    number = 0
    for index in range(count):
        number += 1
        _register(db, category['id'], offset + number, NAMES[(offset + index) % len(NAMES)], seed=index + 1 if index < seeds else None)
    for index in range(pending):
        number += 1
        _register(db, category['id'], offset + number, NAMES[(offset + count + index) % len(NAMES)], 'pending')


# --- playing ---------------------------------------------------------------------------------------------

class _Player:
    def __init__(self, db, tournament_id, actor_id):
        self.db, self.tournament_id, self.actor_id, self.count = db, tournament_id, actor_id, 0

    def draw(self, category_id):
        return draw_svc.get_draw(self.db, self.tournament_id, category_id)['draw']

    def play(self, match, side=1, score=None, outcome='normal'):
        """Record a result. Scores are written from the first player's side: pass one when the second player wins."""
        score = score or SCORES[self.count % len(SCORES)]
        self.count += 1
        data = {'outcome': outcome, 'winner_registration_id': match[f'entry{side}']['registration_id'], 'score': score}
        results_svc.record_result(self.db, self.tournament_id, match['id'], data, self.actor_id)

    def ready(self, category_id, stage=None):
        draw = self.draw(category_id)
        matches = [m for g in draw['groups'] for m in g['matches']] + [m for r in (draw['knockout'] or {'rounds': []})['rounds'] for m in r['matches']]
        matches = [m for m in matches if m['status'] == 'pending' and m['entry1'] and m['entry2'] and stage in (None, m['stage'])]
        return sorted(matches, key=lambda m: (m['stage'] != 'group', m['round_number'], m['bracket_position'], m['group_id'] or 0))

    def play_some(self, category_id, limit=None, stage=None):
        """Play ready matches one at a time (new ones become ready as others finish) until `limit` or nothing is left."""
        played = 0
        while limit is None or played < limit:
            ready = self.ready(category_id, stage)
            if not ready:
                break
            self.play(ready[0])
            played += 1
        return played


def _schedule(db, tournament_id, today, actor_id):
    """Two sessions on the last days of the tournament, every pending match distributed over them, schedule published."""
    courts = seed_courts(db)
    for offset in (1, 2):
        schedule_svc.create_session(db, tournament_id, {'date': today + timedelta(days=offset), 'start': '08:00', 'end': '17:00', 'court_ids': courts}, actor_id)
    proposal = schedule_svc.distribute_preview(db, tournament_id, {'rng_seed': RNG_SEED})
    schedule_svc.apply_assignments(db, tournament_id, {'assignments': proposal['assignments'], 'unassign': proposal['unassign']}, actor_id)
    schedule_svc.set_published(db, tournament_id, True, actor_id)


def _cycle(player, category_id, group):
    """Three players beating each other in a circle with the same score: a tie nothing can break."""
    members = [e['registration_id'] for e in group['entries']]
    beats = {members[0]: members[1], members[1]: members[2], members[2]: members[0]}
    for match in group['matches']:
        first_wins = beats[match['entry1']['registration_id']] == match['entry2']['registration_id']
        player.play(match, side=1 if first_wins else 2, score='6-4, 6-4' if first_wins else '4-6, 4-6')


# --- the states -----------------------------------------------------------------------------------------------

def seed_tournament(db, state, slug=None):
    """(Re)create the tournament `slug` in the given state. Returns what a test needs to find it."""
    if state not in STATES:
        raise svc.TournamentError(f'Estado desconhecido: use um de {", ".join(STATES)}.')
    slug = slug or 'e2e-' + state.replace('_', '-')
    if not slug.startswith('e2e-'):
        raise svc.TournamentError('O slug de um torneio de teste deve começar com "e2e-".')
    db.execute('DELETE FROM tournaments WHERE slug = %s', (slug,))
    if state != 'finished' and svc._other_active_tournament(db):
        raise svc.TournamentError('Já existe outro torneio ativo: finalize ou cancele antes de criar o de teste.', 409, code='active_tournament_exists')

    actor = _actor(db)
    today = local_now().date()
    started = state not in ('registration_open', 'before_draw')
    if state == 'finished':
        start, end = today - timedelta(days=7), today - timedelta(days=5)
    elif started:
        start, end = today - timedelta(days=1), today + timedelta(days=2)
    else:
        start, end = today + timedelta(days=14), today + timedelta(days=16)
    tournament = svc.create_tournament(db, {
        'name': {'registration_open': 'Copa LAPEN — inscrições', 'before_draw': 'Copa LAPEN — antes do sorteio',
                 'before_schedule': 'Copa LAPEN — sem cronograma', 'groups_in_progress': 'Copa LAPEN — fase de grupos', 'tie_pending': 'Copa LAPEN — empate a decidir',
                 'knockout_in_progress': 'Copa LAPEN — mata-mata', 'finished': 'Copa LAPEN — encerrada'}[state],
        'slug': slug, 'location': 'Clube LAPEN, Penedo', 'description': 'Torneio de teste.',
        'start_date': start, 'end_date': end,
        'registration_closes_at': (local_now() + timedelta(days=10)).strftime('%Y-%m-%dT%H:%M') if state == 'registration_open' else None,
        'rules_text': 'Regulamento de teste.\nPartidas em 2 sets, sem vantagem, com super tie-break de 10 pontos.',
        'contact_info': 'organizacao@lapen.example',
    }, actor)
    tid = tournament['id']

    if state == 'tie_pending':
        categories = [svc.create_category(db, tid, {'name': 'Grupos 3x3', 'draw_format': 'groups_knockout', 'group_target_size': 3,
                                                    'qualifiers_per_group': 1, 'min_entries': 6}, actor)]
        _fill(db, categories[0], 6)
    else:
        masculine = svc.create_category(db, tid, {'name': 'Masculino 3ª Classe', 'draw_format': 'groups_knockout', 'group_target_size': 4,
                                                  'qualifiers_per_group': 2, 'num_seeds': 4, 'min_entries': 6, 'max_entries': 12}, actor)
        feminine = svc.create_category(db, tid, {'name': 'Feminino Livre', 'draw_format': 'knockout', 'num_seeds': 2, 'min_entries': 4, 'max_entries': 8}, actor)
        categories = [masculine, feminine]
        if state == 'registration_open':
            _fill(db, masculine, 6, pending=2, seeds=4)
            _fill(db, feminine, 4, offset=8)
        else:
            _fill(db, masculine, 8, seeds=4)
            _fill(db, feminine, 6, seeds=2, offset=8)

    first_registration = db.execute('SELECT id FROM tournament_registrations WHERE category_id = %s ORDER BY id LIMIT 1', (categories[0]['id'],)).fetchone()
    db.execute('INSERT INTO tournament_unavailability (registration_id, play_date, note) VALUES (%s, %s, %s)', (first_registration['id'], end, PRIVATE_NOTE))

    for step in ['registration_open'] + ([] if state == 'registration_open' else ['registration_closed']):
        svc.change_status(db, tid, step, actor)
    if state in ('registration_open', 'before_draw'):
        return _summary(tournament, categories)

    for category in categories:
        draw_svc.generate_draw(db, tid, category['id'], actor, rng_seed=RNG_SEED)
        draw_svc.publish_draw(db, tid, category['id'], actor)
    svc.change_status(db, tid, 'in_progress', actor)

    player = _Player(db, tid, actor)
    first, second = categories[0], categories[-1]
    if state == 'before_schedule':
        seed_courts(db)  # drawn and published, nothing played, no sessions yet: the screen needs a court to build sessions on
    elif state == 'groups_in_progress':
        player.play_some(first['id'], limit=6, stage='group')
        player.play_some(second['id'], limit=1)
        _schedule(db, tid, today, actor)
    elif state == 'tie_pending':
        draw = player.draw(first['id'])
        _cycle(player, first['id'], draw['groups'][0])
        for match in draw['groups'][1]['matches']:
            player.play(match)
    elif state == 'knockout_in_progress':
        player.play_some(first['id'], stage='group')
        player.play_some(first['id'], limit=1)
        player.play_some(second['id'], limit=3)
        _schedule(db, tid, today, actor)
    else:  # finished
        for category in categories:
            player.play_some(category['id'])
        svc.change_status(db, tid, 'finished', actor)
    return _summary(tournament, categories)


def _summary(tournament, categories):
    return {'tournament_id': tournament['id'], 'slug': tournament['slug'],
            'categories': [{'id': c['id'], 'name': c['name']} for c in categories]}
