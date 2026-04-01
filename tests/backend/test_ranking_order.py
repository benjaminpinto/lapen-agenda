import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.database import get_db
from src.auth import hash_password
from src.services.ranking_config import RankingConfigService
from main import app

@pytest.fixture
def client():
    with app.test_client() as client:
        yield client

@pytest.fixture
def setup_db():
    db = get_db()
    db.execute("DELETE FROM match_statistics_unified WHERE ranking_match_id IN (SELECT id FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027)))")
    db.execute("DELETE FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027))")
    db.execute("DELETE FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027)")
    db.execute("DELETE FROM ranking_participants WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027)")
    db.execute("DELETE FROM ranking_season_config WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027)")
    db.execute("DELETE FROM ranking_seasons WHERE year = 2027")
    db.execute("DELETE FROM users WHERE email LIKE '%@ordertest.com'")
    db.commit()
    db.close()
    yield
    db = get_db()
    db.execute("DELETE FROM match_statistics_unified WHERE ranking_match_id IN (SELECT id FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027)))")
    db.execute("DELETE FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027))")
    db.execute("DELETE FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027)")
    db.execute("DELETE FROM ranking_participants WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027)")
    db.execute("DELETE FROM ranking_season_config WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027)")
    db.execute("DELETE FROM ranking_seasons WHERE year = 2027")
    db.execute("DELETE FROM users WHERE email LIKE '%@ordertest.com'")
    db.commit()
    db.close()

def create_season():
    db = get_db()
    cursor = db.execute(
        'INSERT INTO ranking_seasons (year, start_date, end_date, status) VALUES (%s, %s, %s, %s) RETURNING id',
        (2027, '2027-01-01', '2027-12-31', 'active')
    )
    season_id = cursor.fetchone()['id']
    RankingConfigService.set_config(season_id, RankingConfigService.DEFAULT_CONFIG, db)
    db.commit()
    db.close()
    return season_id

def create_round(season_id):
    db = get_db()
    cursor = db.execute(
        'INSERT INTO ranking_rounds (season_id, round_number, month, year, status) VALUES (%s, %s, %s, %s, %s) RETURNING id',
        (season_id, 1, 1, 2027, 'open')
    )
    round_id = cursor.fetchone()['id']
    db.commit()
    db.close()
    return round_id

def create_users(count):
    db = get_db()
    password_hash = hash_password('test123')
    users = []
    for i in range(count):
        cursor = db.execute(
            'INSERT INTO users (email, password_hash, name, short_name, is_verified) VALUES (%s, %s, %s, %s, %s) RETURNING id',
            (f'player{i}@ordertest.com', password_hash, f'Player {i}', f'P{i}', True)
        )
        users.append(cursor.fetchone()['id'])
    db.commit()
    db.close()
    return users

def create_participants(season_id, user_ids):
    db = get_db()
    for idx, user_id in enumerate(user_ids):
        db.execute(
            'INSERT INTO ranking_participants (season_id, user_id, position) VALUES (%s, %s, %s)',
            (season_id, user_id, idx + 1)
        )
    db.commit()
    db.close()

def create_match(round_id, p1_id, p2_id):
    db = get_db()
    cursor = db.execute(
        'INSERT INTO ranking_matches (round_id, player1_id, player2_id, group_type, status) VALUES (%s, %s, %s, %s, %s) RETURNING id',
        (round_id, p1_id, p2_id, 'elite', 'scheduled')
    )
    match_id = cursor.fetchone()['id']
    db.commit()
    db.close()
    return match_id

def get_admin_token(client):
    db = get_db()
    password_hash = hash_password('admin123')
    db.execute(
        'INSERT INTO users (email, password_hash, name, short_name, is_admin, is_verified) VALUES (%s, %s, %s, %s, %s, %s)',
        ('admin@ordertest.com', password_hash, 'Admin', 'Admin', True, True)
    )
    db.commit()
    db.close()
    response = client.post('/api/auth/login', json={'email': 'admin@ordertest.com', 'password': 'admin123'})
    return response.headers.get('Set-Cookie').split('access_token=')[1].split(';')[0]

def get_positions(season_id):
    db = get_db()
    participants = db.execute(
        'SELECT user_id, position, total_points FROM ranking_participants WHERE season_id = %s ORDER BY position',
        (season_id,)
    ).fetchall()
    db.close()
    return {p['user_id']: {'position': p['position'], 'points': p['total_points']} for p in participants}

class TestRankingOrderCalculation:
    def test_position_update_after_single_match(self, client, setup_db):
        """Test that positions update correctly after a single match result"""
        season_id = create_season()
        round_id = create_round(season_id)
        users = create_users(4)
        create_participants(season_id, users)
        match_id = create_match(round_id, users[2], users[3])
        token = get_admin_token(client)
        
        response = client.post(f'/api/ranking/matches/{match_id}/result',
            headers={'Authorization': f'Bearer {token}'},
            json={'winner_id': users[3], 'score': '6-4, 6-3'}
        )
        
        assert response.status_code == 200
        positions = get_positions(season_id)
        assert positions[users[3]]['position'] < positions[users[2]]['position']

    def test_tie_breaking_by_total_points(self, client, setup_db):
        """Test ranking order based on total points"""
        season_id = create_season()
        round_id = create_round(season_id)
        users = create_users(3)
        create_participants(season_id, users)
        
        m1 = create_match(round_id, users[0], users[2])
        m2 = create_match(round_id, users[1], users[2])
        token = get_admin_token(client)
        
        client.post(f'/api/ranking/matches/{m1}/result',
            headers={'Authorization': f'Bearer {token}'},
            json={'winner_id': users[0], 'score': '6-0, 6-0'}
        )
        client.post(f'/api/ranking/matches/{m2}/result',
            headers={'Authorization': f'Bearer {token}'},
            json={'winner_id': users[1], 'score': '6-4, 6-4'}
        )
        
        positions = get_positions(season_id)
        assert positions[users[0]]['points'] > positions[users[1]]['points']
        assert positions[users[0]]['position'] < positions[users[1]]['position']

    def test_tie_breaking_by_wins(self, client, setup_db):
        """Test tie-breaking by number of wins when points are equal"""
        season_id = create_season()
        round_id = create_round(season_id)
        users = create_users(4)
        create_participants(season_id, users)
        
        m1 = create_match(round_id, users[0], users[3])
        m2 = create_match(round_id, users[1], users[3])
        m3 = create_match(round_id, users[2], users[0])
        token = get_admin_token(client)
        
        client.post(f'/api/ranking/matches/{m1}/result',
            headers={'Authorization': f'Bearer {token}'},
            json={'winner_id': users[0], 'score': '6-4, 6-3'}
        )
        client.post(f'/api/ranking/matches/{m2}/result',
            headers={'Authorization': f'Bearer {token}'},
            json={'winner_id': users[1], 'score': '6-4, 6-3'}
        )
        client.post(f'/api/ranking/matches/{m3}/result',
            headers={'Authorization': f'Bearer {token}'},
            json={'winner_id': users[0], 'score': '6-4, 6-3'}
        )
        
        positions = get_positions(season_id)
        db = get_db()
        p0_wins = db.execute('SELECT wins FROM ranking_participants WHERE season_id = %s AND user_id = %s', (season_id, users[0])).fetchone()['wins']
        p1_wins = db.execute('SELECT wins FROM ranking_participants WHERE season_id = %s AND user_id = %s', (season_id, users[1])).fetchone()['wins']
        db.close()
        
        assert p0_wins > p1_wins
        assert positions[users[0]]['position'] < positions[users[1]]['position']

    def test_tie_breaking_by_set_difference(self, client, setup_db):
        """Test tie-breaking by set difference"""
        season_id = create_season()
        round_id = create_round(season_id)
        users = create_users(4)
        create_participants(season_id, users)
        
        m1 = create_match(round_id, users[0], users[3])
        m2 = create_match(round_id, users[1], users[3])
        token = get_admin_token(client)
        
        client.post(f'/api/ranking/matches/{m1}/result',
            headers={'Authorization': f'Bearer {token}'},
            json={'winner_id': users[0], 'score': '6-0, 6-0'}
        )
        client.post(f'/api/ranking/matches/{m2}/result',
            headers={'Authorization': f'Bearer {token}'},
            json={'winner_id': users[1], 'score': '7-5, 4-6, 10-8'}
        )
        
        positions = get_positions(season_id)
        db = get_db()
        p0_stats = db.execute('SELECT sets_won, sets_lost FROM ranking_participants WHERE season_id = %s AND user_id = %s', (season_id, users[0])).fetchone()
        p1_stats = db.execute('SELECT sets_won, sets_lost FROM ranking_participants WHERE season_id = %s AND user_id = %s', (season_id, users[1])).fetchone()
        db.close()
        
        p0_diff = p0_stats['sets_won'] - p0_stats['sets_lost']
        p1_diff = p1_stats['sets_won'] - p1_stats['sets_lost']
        assert p0_diff > p1_diff
        assert positions[users[0]]['position'] < positions[users[1]]['position']

    def test_tie_breaking_by_game_difference(self, client, setup_db):
        """Test tie-breaking by game difference"""
        season_id = create_season()
        round_id = create_round(season_id)
        users = create_users(4)
        create_participants(season_id, users)
        
        m1 = create_match(round_id, users[0], users[3])
        m2 = create_match(round_id, users[1], users[3])
        token = get_admin_token(client)
        
        client.post(f'/api/ranking/matches/{m1}/result',
            headers={'Authorization': f'Bearer {token}'},
            json={'winner_id': users[0], 'score': '6-0, 6-1'}
        )
        client.post(f'/api/ranking/matches/{m2}/result',
            headers={'Authorization': f'Bearer {token}'},
            json={'winner_id': users[1], 'score': '6-3, 6-4'}
        )
        
        positions = get_positions(season_id)
        db = get_db()
        p0_stats = db.execute('SELECT games_won, games_lost FROM ranking_participants WHERE season_id = %s AND user_id = %s', (season_id, users[0])).fetchone()
        p1_stats = db.execute('SELECT games_won, games_lost FROM ranking_participants WHERE season_id = %s AND user_id = %s', (season_id, users[1])).fetchone()
        db.close()
        
        p0_diff = p0_stats['games_won'] - p0_stats['games_lost']
        p1_diff = p1_stats['games_won'] - p1_stats['games_lost']
        assert p0_diff > p1_diff
        assert positions[users[0]]['position'] < positions[users[1]]['position']

    def test_head_to_head_tie_breaker(self, client, setup_db):
        """Test head-to-head tie-breaking when all stats are equal"""
        season_id = create_season()
        round_id = create_round(season_id)
        users = create_users(2)
        create_participants(season_id, users)
        
        match_id = create_match(round_id, users[0], users[1])
        token = get_admin_token(client)
        
        client.post(f'/api/ranking/matches/{match_id}/result',
            headers={'Authorization': f'Bearer {token}'},
            json={'winner_id': users[1], 'score': '6-4, 6-3'}
        )
        
        positions = get_positions(season_id)
        assert positions[users[1]]['position'] < positions[users[0]]['position']

    def test_multiple_matches_position_cascade(self, client, setup_db):
        """Test position updates cascade correctly through multiple matches"""
        season_id = create_season()
        round_id = create_round(season_id)
        users = create_users(5)
        create_participants(season_id, users)
        
        matches = [
            (users[4], users[0]),
            (users[3], users[1]),
            (users[2], users[4])
        ]
        token = get_admin_token(client)
        
        for p1, p2 in matches:
            match_id = create_match(round_id, p1, p2)
            client.post(f'/api/ranking/matches/{match_id}/result',
                headers={'Authorization': f'Bearer {token}'},
                json={'winner_id': p1, 'score': '6-4, 6-3'}
            )
        
        positions = get_positions(season_id)
        assert positions[users[4]]['position'] < 5
        assert positions[users[3]]['position'] < 5
        assert positions[users[2]]['position'] < 5

    def test_wo_result_affects_position(self, client, setup_db):
        """Test W.O. results affect position correctly"""
        season_id = create_season()
        round_id = create_round(season_id)
        users = create_users(3)
        create_participants(season_id, users)
        
        match_id = create_match(round_id, users[1], users[2])
        token = get_admin_token(client)
        
        response = client.post(f'/api/ranking/matches/{match_id}/wo',
            headers={'Authorization': f'Bearer {token}'},
            json={'winner_id': users[2], 'comment': 'No show'}
        )
        
        assert response.status_code == 200
        positions = get_positions(season_id)
        assert positions[users[2]]['position'] < positions[users[1]]['position']
        assert positions[users[2]]['points'] == 132

    def test_position_stability_with_no_change(self, client, setup_db):
        """Test positions update correctly when lower-ranked players play"""
        season_id = create_season()
        round_id = create_round(season_id)
        users = create_users(4)
        create_participants(season_id, users)
        
        # Give initial points to establish proper ranking
        db = get_db()
        db.execute('UPDATE ranking_participants SET total_points = 400 WHERE season_id = %s AND user_id = %s', (season_id, users[0]))
        db.execute('UPDATE ranking_participants SET total_points = 300 WHERE season_id = %s AND user_id = %s', (season_id, users[1]))
        db.execute('UPDATE ranking_participants SET total_points = 200 WHERE season_id = %s AND user_id = %s', (season_id, users[2]))
        db.execute('UPDATE ranking_participants SET total_points = 100 WHERE season_id = %s AND user_id = %s', (season_id, users[3]))
        db.commit()
        db.close()
        
        match_id = create_match(round_id, users[2], users[3])
        token = get_admin_token(client)
        
        initial_positions = get_positions(season_id)
        
        client.post(f'/api/ranking/matches/{match_id}/result',
            headers={'Authorization': f'Bearer {token}'},
            json={'winner_id': users[2], 'score': '6-4, 6-3'}
        )
        
        final_positions = get_positions(season_id)
        # users[0] should stay at position 1 (400 points, highest)
        assert final_positions[users[0]]['position'] == 1
        # users[2] should move to position 2 (200 + 125 = 325 points)
        assert final_positions[users[2]]['position'] == 2
        # users[1] should move to position 3 (300 points, less than users[2])
        assert final_positions[users[1]]['position'] == 3
        # users[3] should stay at position 4 (100 + 0 = 100 points, lowest)
        assert final_positions[users[3]]['position'] == 4
