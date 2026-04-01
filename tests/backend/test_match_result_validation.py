"""
Integration tests for POST /api/statistics/match-result score validation.
Confirms the endpoint rejects bad scores before touching the database.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.database import get_db
from src.auth import hash_password

EMAIL_SUFFIX = '@scoreval.com'
TEST_COURT_NAME = 'TEST_SCOREVAL_COURT'


@pytest.fixture(autouse=True)
def setup_db():
    db = get_db()
    _cleanup(db)

    db.execute(
        "INSERT INTO courts (id, name, type, active) VALUES (9998, %s, 'Saibro', true) ON CONFLICT (id) DO NOTHING",
        (TEST_COURT_NAME,)
    )
    court_id = 9998

    pw = hash_password('test123')
    db.execute(
        "DELETE FROM users WHERE email = %s", (f'tester{EMAIL_SUFFIX}',)
    )
    user = db.execute(
        "INSERT INTO users (email, password_hash, name, short_name, is_verified, lapen_approved) "
        "VALUES (%s, %s, 'Tester', 'Tester', true, true) RETURNING id",
        (f'tester{EMAIL_SUFFIX}', pw)
    ).fetchone()

    db.execute("DELETE FROM schedules WHERE court_id = 9998")
    sched = db.execute(
        "INSERT INTO schedules (court_id, date, start_time, player1_name, player2_name, match_type) "
        "VALUES (%s, '2026-01-01', '08:00', 'A', 'B', 'Amistoso') RETURNING id",
        (court_id,)
    ).fetchone()

    db.commit()
    db.close()

    yield {'schedule_id': sched['id'], 'user_id': user['id']}

    db = get_db()
    _cleanup(db)
    db.commit()
    db.close()


def _cleanup(db):
    db.execute("DELETE FROM match_statistics_unified WHERE player1_name IN ('A', 'B')"
               " AND schedule_id IN (SELECT id FROM schedules WHERE court_id = 9998)")
    db.execute("DELETE FROM schedules WHERE court_id = 9998")
    db.execute("DELETE FROM users WHERE email LIKE %s", (f'%{EMAIL_SUFFIX}',))
    db.execute("DELETE FROM courts WHERE id = 9998")


def _post(client, token, schedule_id, score):
    return client.post(
        '/api/statistics/match-result',
        json={'schedule_id': schedule_id, 'winner_name': 'A', 'score': score},
        headers={'Authorization': f'Bearer {token}'}
    )


def _login(client):
    resp = client.post('/api/auth/login', json={
        'email': f'tester{EMAIL_SUFFIX}', 'password': 'test123'
    })
    cookies = resp.headers.getlist('Set-Cookie')
    return next(c.split('access_token=')[1].split(';')[0] for c in cookies if 'access_token=' in c)


class TestMatchResultScoreValidation:
    def test_valid_score_accepted(self, setup_db):
        from main import app
        with app.test_client() as client:
            token = _login(client)
            resp = _post(client, token, setup_db['schedule_id'], '6-4, 6-3')
            assert resp.status_code == 201

    def test_zero_zero_rejected(self, setup_db):
        from main import app
        with app.test_client() as client:
            token = _login(client)
            resp = _post(client, token, setup_db['schedule_id'], '6-4, 0-0')
            assert resp.status_code == 400
            assert 'inválido' in resp.get_json()['error'].lower() or '0-0' in resp.get_json()['error']

    def test_typo_games_rejected(self, setup_db):
        """Reproduces production bad record id=110: 6-7, 55-7, 0-0"""
        from main import app
        with app.test_client() as client:
            token = _login(client)
            resp = _post(client, token, setup_db['schedule_id'], '6-7, 55-7, 0-0')
            assert resp.status_code == 400

    def test_spurious_third_set_rejected(self, setup_db):
        """Reproduces production bad record id=111: 6-2, 6-4, 0-0"""
        from main import app
        with app.test_client() as client:
            token = _login(client)
            resp = _post(client, token, setup_db['schedule_id'], '6-2, 6-4, 0-0')
            assert resp.status_code == 400

    def test_missing_third_set_rejected(self, setup_db):
        from main import app
        with app.test_client() as client:
            token = _login(client)
            resp = _post(client, token, setup_db['schedule_id'], '6-4, 4-6')
            assert resp.status_code == 400

    def test_super_tiebreak_below_10_rejected(self, setup_db):
        from main import app
        with app.test_client() as client:
            token = _login(client)
            resp = _post(client, token, setup_db['schedule_id'], '6-4, 4-6, 9-7')
            assert resp.status_code == 400

    def test_wo_score_accepted(self, setup_db):
        from main import app
        with app.test_client() as client:
            token = _login(client)
            resp = _post(client, token, setup_db['schedule_id'], 'W.O. - motivo')
            assert resp.status_code == 201
