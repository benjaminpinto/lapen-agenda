import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.database import get_db
from src.auth import hash_password
from main import app

@pytest.fixture
def client():
    with app.test_client() as client:
        yield client

@pytest.fixture
def setup_db():
    db = get_db()
    db.execute("DELETE FROM match_statistics_unified WHERE schedule_id IN (SELECT id FROM schedules WHERE player1_name LIKE 'TestP%')")
    db.execute("DELETE FROM ranking_matches WHERE player1_id IN (SELECT id FROM users WHERE email LIKE '%@integtest.com')")
    db.execute("DELETE FROM ranking_participants WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integtest.com')")
    db.execute("DELETE FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2025)")
    db.execute("DELETE FROM ranking_seasons WHERE year = 2025")
    db.execute("DELETE FROM schedules WHERE player1_name LIKE 'TestP%'")
    db.execute("DELETE FROM schedules WHERE court_id IN (SELECT id FROM courts WHERE name = 'Test Court')")
    db.execute("DELETE FROM users WHERE email LIKE '%@integtest.com'")
    db.execute("DELETE FROM courts WHERE name = 'Test Court'")
    db.commit()
    db.close()
    yield
    db = get_db()
    db.execute("DELETE FROM match_statistics_unified WHERE schedule_id IN (SELECT id FROM schedules WHERE player1_name LIKE 'TestP%')")
    db.execute("DELETE FROM ranking_matches WHERE player1_id IN (SELECT id FROM users WHERE email LIKE '%@integtest.com')")
    db.execute("DELETE FROM ranking_participants WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integtest.com')")
    db.execute("DELETE FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2025)")
    db.execute("DELETE FROM ranking_seasons WHERE year = 2025")
    db.execute("DELETE FROM schedules WHERE player1_name LIKE 'TestP%'")
    db.execute("DELETE FROM schedules WHERE court_id IN (SELECT id FROM courts WHERE name = 'Test Court')")
    db.execute("DELETE FROM users WHERE email LIKE '%@integtest.com'")
    db.execute("DELETE FROM courts WHERE name = 'Test Court'")
    db.commit()
    db.close()

@pytest.fixture
def auth_user(setup_db):
    db = get_db()
    password_hash = hash_password('password123')
    cursor = db.execute(
        'INSERT INTO users (email, password_hash, name, short_name, is_verified, is_lapen_member, lapen_approved) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id',
        ('testuser@integtest.com', password_hash, 'Test User', 'TestUser', True, True, True)
    )
    user_id = cursor.fetchone()['id']
    db.commit()
    db.close()
    return user_id

@pytest.fixture
def auth_headers(client, auth_user):
    response = client.post('/api/auth/login', json={'email': 'testuser@integtest.com', 'password': 'password123'})
    token = response.headers.get('Set-Cookie').split('access_token=')[1].split(';')[0]
    return {'Authorization': f'Bearer {token}'}


def test_liga_schedule_links_to_ranking_match(client, auth_headers, setup_db):
    """Test that creating a Liga schedule automatically links to pending ranking match"""
    db = get_db()
    
    season_id = db.execute(
        "INSERT INTO ranking_seasons (year, start_date, end_date, status) VALUES (2025, '2025-01-01', '2025-12-31', 'active') RETURNING id"
    ).fetchone()['id']
    
    round_id = db.execute(
        "INSERT INTO ranking_rounds (season_id, round_number, month, year, status) VALUES (%s, 1, 1, 2025, 'open') RETURNING id",
        (season_id,)
    ).fetchone()['id']
    
    user1_id = db.execute(
        "INSERT INTO users (email, password_hash, name, short_name, is_verified, lapen_approved) VALUES ('player1@integtest.com', 'hash', 'Player One', 'TestP1', true, true) RETURNING id"
    ).fetchone()['id']
    
    user2_id = db.execute(
        "INSERT INTO users (email, password_hash, name, short_name, is_verified, lapen_approved) VALUES ('player2@integtest.com', 'hash', 'Player Two', 'TestP2', true, true) RETURNING id"
    ).fetchone()['id']
    
    db.execute(
        "INSERT INTO ranking_participants (season_id, user_id, position) VALUES (%s, %s, 1), (%s, %s, 2)",
        (season_id, user1_id, season_id, user2_id)
    )
    
    ranking_match_id = db.execute(
        "INSERT INTO ranking_matches (round_id, player1_id, player2_id, group_type, status) VALUES (%s, %s, %s, 'elite', 'scheduled') RETURNING id",
        (round_id, user1_id, user2_id)
    ).fetchone()['id']
    
    court_id = db.execute(
        "INSERT INTO courts (name, type, active) VALUES ('Test Court', 'saibro', true) RETURNING id"
    ).fetchone()['id']
    
    db.commit()
    db.close()
    
    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    response = client.post('/api/public/schedules', 
        headers=auth_headers,
        json={
            'court_id': court_id,
            'date': tomorrow,
            'start_time': '09:00',
            'player1_name': 'TestP1',
            'player2_name': 'TestP2',
            'match_type': 'Liga'
        }
    )
    
    assert response.status_code == 200
    
    db = get_db()
    ranking_match = db.execute(
        "SELECT schedule_id FROM ranking_matches WHERE id = %s",
        (ranking_match_id,)
    ).fetchone()
    db.close()
    
    assert ranking_match['schedule_id'] is not None
