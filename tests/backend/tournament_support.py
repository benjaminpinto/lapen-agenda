"""Shared fixtures and helpers for the tournament API tests."""
import itertools
import os
import sys
from types import SimpleNamespace

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, ROOT)

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from main import app
from src.auth import generate_token
from src.database import get_db

SLUG_PREFIX = 'test-tourn-'
EMAIL_DOMAIN = '@ttourn.test'
ACTIVE_STATUSES = ('registration_open', 'registration_closed', 'in_progress')

_ips = itertools.count(1)


def sql(query, params=None):
    """Run a statement on its own connection, commit, and return rows (if any) as dicts."""
    db = get_db()
    try:
        cursor = db.execute(query, params)
        rows = [dict(r) for r in cursor.fetchall()] if cursor.description else []
        db.commit()
        return rows
    finally:
        db.close()


def ensure_court():
    """Scheduled games need a court. Explicit high id: CI seeds court id 1 by hand, which leaves the serial sequence behind."""
    return ensure_courts(1)[0]


def ensure_courts(count):
    """`count` test courts (ids 9998, 9997, ...), returned in that order. cleanup() removes them."""
    ids = []
    for index in range(count):
        court_id = 9998 - index
        sql("INSERT INTO courts (id, name, type) VALUES (%s, %s, 'Saibro') ON CONFLICT DO NOTHING",
            (court_id, 'TTourn Court' if index == 0 else f'TTourn Court {index + 1}'))
        ids.append(court_id)
    return ids


def cleanup():
    sql('DELETE FROM tournaments WHERE slug LIKE %s OR slug LIKE %s', (SLUG_PREFIX + '%', 'e2e-%'))
    sql("DELETE FROM courts WHERE name LIKE 'TTourn Court%'")
    sql('DELETE FROM users WHERE email LIKE %s OR email LIKE %s', ('%' + EMAIL_DOMAIN, '%@e2e.test'))


@pytest.fixture
def clean_db():
    foreign = sql(
        'SELECT slug FROM tournaments WHERE status = ANY(%s) AND slug NOT LIKE %s AND slug NOT LIKE %s',
        (list(ACTIVE_STATUSES), SLUG_PREFIX + '%', 'e2e-%'))
    if foreign:
        pytest.skip(f"database already has an active tournament ({foreign[0]['slug']})")
    cleanup()
    yield
    cleanup()


@pytest.fixture
def client(clean_db):
    with app.test_client() as test_client:
        yield test_client


def make_user(label, admin=False, member=False, approved=False):
    user_id = sql(
        'INSERT INTO users (email, password_hash, name, short_name, is_verified, is_admin, is_lapen_member, lapen_approved) '
        'VALUES (%s, %s, %s, %s, TRUE, %s, %s, %s) RETURNING id',
        (f'{label}{EMAIL_DOMAIN}', 'hash', f'TTourn {label}', f'TTourn {label}', admin, member, approved))[0]['id']
    with app.app_context():
        token = generate_token(user_id)
    return SimpleNamespace(id=user_id, headers={'Authorization': f'Bearer {token}'})


@pytest.fixture
def people(clean_db):
    return SimpleNamespace(
        admin=make_user('admin', admin=True),
        member=make_user('member', member=True, approved=True),
        pending=make_user('pending', member=True, approved=False),
        plain=make_user('plain'),
    )


# --- API shortcuts -----------------------------------------------------------------------

def create_tournament(client, headers, name='Test Tourn Alpha', **extra):
    payload = {'name': name, 'start_date': '2099-02-10', 'end_date': '2099-02-12'}
    payload.update(extra)
    response = client.post('/api/admin/tournaments', json=payload, headers=headers)
    assert response.status_code == 201, response.get_json()
    return response.get_json()['tournament']


def create_category(client, headers, tournament_id, name='Masculino', **extra):
    response = client.post(f'/api/admin/tournaments/{tournament_id}/categories', json={'name': name, **extra}, headers=headers)
    assert response.status_code == 201, response.get_json()
    return response.get_json()['category']


def set_status(client, headers, tournament_id, status):
    return client.put(f'/api/admin/tournaments/{tournament_id}/status', json={'status': status}, headers=headers)


def open_tournament(client, headers, name='Test Tourn Alpha', **category):
    """A tournament with one category and registrations open. Returns (tournament, category)."""
    tournament = create_tournament(client, headers, name)
    category = create_category(client, headers, tournament['id'], **category)
    response = set_status(client, headers, tournament['id'], 'registration_open')
    assert response.status_code == 200, response.get_json()
    return response.get_json()['tournament'], category


def registration_payload(category_id, email='ana@example.com', **extra):
    payload = {
        'category_id': category_id, 'full_name': 'Ana Maria Souza', 'display_name': 'Ana Souza',
        'email': email, 'phone': '(24) 99999-0000',
        'accepted_terms': True, 'data_consent': True,
    }
    payload.update(extra)
    return payload


def register(client, slug, category_id, email='ana@example.com', ip=None, headers=None, **extra):
    """Public sign-up. Each call comes from a fresh IP unless one is given (the limiter is per IP)."""
    ip = ip or f'192.0.2.{next(_ips) % 250 + 1}'
    return client.post(f'/api/tournaments/{slug}/registrations',
                       json=registration_payload(category_id, email, **extra),
                       headers={'X-Forwarded-For': ip, **(headers or {})})


def signup(client, tournament, category, email):
    """Sign up through the public API and return the registration id."""
    response = register(client, tournament['slug'], category['id'], email, full_name=f'Pessoa {email.split("@")[0]}')
    assert response.status_code == 201, response.get_json()
    return response.get_json()['registration']['id']


def patch_registration(client, headers, tournament_id, registration_id, **changes):
    return client.patch(f'/api/admin/tournaments/{tournament_id}/registrations/{registration_id}', json=changes, headers=headers)


def registration_row(registration_id):
    return sql('SELECT * FROM tournament_registrations WHERE id = %s', (registration_id,))[0]


def audit_actions(tournament_id):
    return [r['action'] for r in sql('SELECT action FROM tournament_audit_log WHERE tournament_id = %s ORDER BY id', (tournament_id,))]


def add_registration(category_id, label, status='confirmed', **columns):
    """Insert a registration straight into the database and return its id."""
    values = {
        'category_id': category_id, 'full_name': f'Jogador {label}', 'display_name': f'Jogador {label}',
        'email': f'{label}{EMAIL_DOMAIN}', 'phone': '24999990000', 'status': status,
    }
    values.update(columns)
    names = ', '.join(values)
    placeholders = ', '.join(['%s'] * len(values))
    return sql(
        f'INSERT INTO tournament_registrations ({names}, terms_accepted_at, data_consent_at) '
        f'VALUES ({placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id', list(values.values()))[0]['id']


def seed_completed_match(category_id):
    """Two confirmed registrations and a completed match, straight into the database."""
    first, second = add_registration(category_id, 'um'), add_registration(category_id, 'dois')
    return sql(
        "INSERT INTO tournament_matches (category_id, stage, round_number, bracket_position, entry1_id, entry2_id, "
        "winner_entry_id, status, outcome, score) VALUES (%s, 'knockout', 1, 1, %s, %s, %s, 'completed', 'normal', '6-4, 6-3') RETURNING id",
        (category_id, first, second, first))[0]['id']


# --- drawing and playing --------------------------------------------------------------------------------

def draw_url(tournament, category, suffix=''):
    return f"/api/admin/tournaments/{tournament['id']}/categories/{category['id']}/draw{suffix}"


def generate_draw(client, headers, tournament, category):
    response = client.post(draw_url(tournament, category), headers=headers)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def closed_tournament(client, headers, n, name='Test Tourn Draw', seeds=0, tournament=None, **category):
    """Registrations closed, n confirmed entries (the first `seeds` are seeded). `tournament` holds extra tournament fields."""
    created = create_tournament(client, headers, name, **(tournament or {}))
    made = create_category(client, headers, created['id'], num_seeds=seeds, **category)
    ids = [add_registration(made['id'], f'p{i:02d}', seed=i + 1 if i < seeds else None, display_name=f'Jogador {i:02d}')
           for i in range(n)]
    assert set_status(client, headers, created['id'], 'registration_open').status_code == 200
    assert set_status(client, headers, created['id'], 'registration_closed').status_code == 200
    return created, made, ids


def started_tournament(client, headers, n, name='Test Tourn Play', seeds=0, tournament=None, **category):
    """Drawn, published and in progress: ready for results."""
    created, made, ids = closed_tournament(client, headers, n, name, seeds, tournament, **category)
    generate_draw(client, headers, created, made)
    assert client.post(draw_url(created, made, '/publish'), headers=headers).status_code == 200
    assert set_status(client, headers, created['id'], 'in_progress').status_code == 200
    return created, made, ids


def result_url(tournament, match):
    return f"/api/admin/tournaments/{tournament['id']}/matches/{match['id'] if isinstance(match, dict) else match}/result"


def draw_of(client, headers, tournament, category):
    return client.get(draw_url(tournament, category), headers=headers).get_json()['draw']


def draw_matches(draw, stage=None):
    found = []
    if stage in (None, 'group'):
        found += [m for group in draw['groups'] for m in group['matches']]
    if stage in (None, 'knockout') and draw['knockout']:
        found += [m for r in draw['knockout']['rounds'] for m in r['matches']]
    return found


def find_match(draw, match_id):
    return next(m for m in draw_matches(draw) if m['id'] == match_id)


def play(client, headers, tournament, match, side=1, score=None, outcome='normal', **extra):
    """Record a result. side is the winner (1 or 2). Scores are written from the first player's side."""
    entry = match['entry1'] if side == 1 else match['entry2']
    default = '6-4, 6-3' if side == 1 else '4-6, 3-6'
    payload = {'outcome': outcome, 'winner_registration_id': entry['registration_id'], 'score': score or default}
    payload.update(extra)
    return client.put(result_url(tournament, match), json=payload, headers=headers)


def play_round(client, headers, tournament, category, round_number, side=1):
    """Play every ready match of a knockout round. Returns how many were played."""
    played = 0
    for match in next(r for r in draw_of(client, headers, tournament, category)['knockout']['rounds'] if r['round_number'] == round_number)['matches']:
        if match['status'] == 'pending' and match['entry1'] and match['entry2']:
            response = play(client, headers, tournament, match, side)
            assert response.status_code == 200, response.get_json()
            played += 1
    return played


SCORES = ['6-0, 6-0', '6-1, 6-1', '6-2, 6-2', '6-3, 6-3', '6-4, 6-4', '7-5, 6-4']


def varied_score(index, side=1):
    """A 2-0 score whose margin changes with the index. With one score for every match, players with the same
    wins would also be level on sets and games, and a group of 4 where the first-listed player always wins ends
    in a three-way cycle nothing can break."""
    score = SCORES[index % len(SCORES)]
    return score if side == 1 else ', '.join('-'.join(reversed(part.strip().split('-'))) for part in score.split(','))


def play_groups(client, headers, tournament, category, side=1):
    count = 0
    for match in draw_matches(draw_of(client, headers, tournament, category), 'group'):
        if match['status'] == 'pending':
            response = play(client, headers, tournament, match, side, score=varied_score(count, side))
            assert response.status_code == 200, response.get_json()
            count += 1
    return count


def stats_rows(match_id=None):
    if match_id is None:
        return sql('SELECT * FROM match_statistics_unified WHERE tournament_match_id IS NOT NULL ORDER BY id')
    return sql('SELECT * FROM match_statistics_unified WHERE tournament_match_id = %s', (match_id,))


# --- fixtures through the test endpoints -----------------------------------------------------------------------

TEST_SECRET = 'secret-for-the-test-endpoints'


@pytest.fixture
def seed(client, monkeypatch):
    """seed(state, slug=None) -> {'tournament_id', 'slug', 'categories': [...]}, built by the test endpoint."""
    monkeypatch.setenv('E2E_TEST_SECRET', TEST_SECRET)

    def make(state, slug=None):
        response = client.post('/api/test/tournaments/seed', json={'state': state, 'slug': slug} if slug else {'state': state},
                               headers={'X-Test-Secret': TEST_SECRET})
        assert response.status_code == 201, response.get_json()
        return response.get_json()
    return make
