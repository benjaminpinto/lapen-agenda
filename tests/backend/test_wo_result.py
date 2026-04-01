import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.database import get_db
from src.auth import hash_password
from src.services.ranking_config import RankingConfigService

@pytest.fixture
def setup_db():
    db = get_db()
    db.execute("DELETE FROM match_statistics_unified WHERE ranking_match_id IN (SELECT id FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027)))")
    db.execute("DELETE FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027))")
    db.execute("DELETE FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027)")
    db.execute("DELETE FROM ranking_participants WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027)")
    db.execute("DELETE FROM ranking_season_config WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year = 2027)")
    db.execute("DELETE FROM ranking_seasons WHERE year = 2027")
    db.execute("DELETE FROM users WHERE email LIKE '%@wotest.com'")
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
    db.execute("DELETE FROM users WHERE email LIKE '%@wotest.com'")
    db.commit()
    db.close()

def create_test_data():
    db = get_db()
    
    # Create season
    cursor = db.execute(
        'INSERT INTO ranking_seasons (year, start_date, end_date, status) VALUES (%s, %s, %s, %s) RETURNING id',
        (2027, '2027-01-01', '2027-12-31', 'active')
    )
    season_id = cursor.fetchone()['id']
    RankingConfigService.set_config(season_id, RankingConfigService.DEFAULT_CONFIG, db)
    
    # Create users
    password_hash = hash_password('test123')
    cursor = db.execute('''
        INSERT INTO users (email, password_hash, name, short_name, is_admin, is_verified)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
    ''', ('admin@wotest.com', password_hash, 'Admin', 'Admin', True, True))
    admin_id = cursor.fetchone()['id']
    
    cursor = db.execute('''
        INSERT INTO users (email, password_hash, name, short_name, is_verified)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    ''', ('player1@wotest.com', password_hash, 'Player One', 'P1', True))
    player1_id = cursor.fetchone()['id']
    
    cursor = db.execute('''
        INSERT INTO users (email, password_hash, name, short_name, is_verified)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    ''', ('player2@wotest.com', password_hash, 'Player Two', 'P2', True))
    player2_id = cursor.fetchone()['id']
    
    # Create participants
    db.execute('INSERT INTO ranking_participants (season_id, user_id, position) VALUES (%s, %s, %s)',
               (season_id, player1_id, 1))
    db.execute('INSERT INTO ranking_participants (season_id, user_id, position) VALUES (%s, %s, %s)',
               (season_id, player2_id, 2))
    
    # Create round
    cursor = db.execute('''
        INSERT INTO ranking_rounds (season_id, round_number, month, year, status)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    ''', (season_id, 1, 1, 2027, 'open'))
    round_id = cursor.fetchone()['id']
    
    # Create match
    cursor = db.execute('''
        INSERT INTO ranking_matches (round_id, player1_id, player2_id, group_type, status)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    ''', (round_id, player1_id, player2_id, 'elite', 'scheduled'))
    match_id = cursor.fetchone()['id']
    
    db.commit()
    db.close()
    
    return {
        'season_id': season_id,
        'round_id': round_id,
        'match_id': match_id,
        'player1_id': player1_id,
        'player2_id': player2_id,
        'admin_id': admin_id
    }

class TestWOResult:
    def test_wo_with_integer_winner_id(self, setup_db):
        """Test W.O. result with integer winner_id"""
        from main import app
        data = create_test_data()
        
        with app.test_client() as client:
            # Login as admin
            client.post('/api/auth/login', json={
                'email': 'admin@wotest.com',
                'password': 'test123'
            })
            
            # Submit W.O. with integer winner_id
            response = client.post(f'/api/ranking/matches/{data["match_id"]}/wo',
                json={'winner_id': data['player2_id'], 'comment': 'Test WO'})
            
            assert response.status_code == 200
            
            # Verify points
            db = get_db()
            match = db.execute('SELECT points_p1, points_p2, winner_id FROM ranking_matches WHERE id = %s',
                             (data['match_id'],)).fetchone()
            db.close()
            
            assert match['winner_id'] == data['player2_id']
            assert match['points_p1'] == -30  # Loser
            assert match['points_p2'] == 132  # Winner
    
    def test_wo_with_string_winner_id(self, setup_db):
        """Test W.O. result with string winner_id (should be converted to int)"""
        from main import app
        data = create_test_data()
        
        with app.test_client() as client:
            # Login as admin
            client.post('/api/auth/login', json={
                'email': 'admin@wotest.com',
                'password': 'test123'
            })
            
            # Submit W.O. with string winner_id
            response = client.post(f'/api/ranking/matches/{data["match_id"]}/wo',
                json={'winner_id': str(data['player1_id']), 'comment': 'Test WO'})
            
            assert response.status_code == 200
            
            # Verify points
            db = get_db()
            match = db.execute('SELECT points_p1, points_p2, winner_id FROM ranking_matches WHERE id = %s',
                             (data['match_id'],)).fetchone()
            db.close()
            
            assert match['winner_id'] == data['player1_id']
            assert match['points_p1'] == 132  # Winner
            assert match['points_p2'] == -30  # Loser
    
    def test_wo_updates_participant_stats(self, setup_db):
        """Test W.O. result updates participant statistics correctly"""
        from main import app
        data = create_test_data()
        
        with app.test_client() as client:
            # Login as admin
            client.post('/api/auth/login', json={
                'email': 'admin@wotest.com',
                'password': 'test123'
            })
            
            # Submit W.O.
            client.post(f'/api/ranking/matches/{data["match_id"]}/wo',
                json={'winner_id': data['player2_id'], 'comment': ''})
            
            # Verify participant stats
            db = get_db()
            p1_stats = db.execute(
                'SELECT total_points, wo_wins, wo_losses FROM ranking_participants WHERE user_id = %s',
                (data['player1_id'],)).fetchone()
            p2_stats = db.execute(
                'SELECT total_points, wo_wins, wo_losses FROM ranking_participants WHERE user_id = %s',
                (data['player2_id'],)).fetchone()
            db.close()
            
            assert p1_stats['total_points'] == -30
            assert p1_stats['wo_wins'] == 0
            assert p1_stats['wo_losses'] == 1
            
            assert p2_stats['total_points'] == 132
            assert p2_stats['wo_wins'] == 1
            assert p2_stats['wo_losses'] == 0
    
    def test_wo_with_invalid_winner_id(self, setup_db):
        """Test W.O. result with invalid winner_id"""
        from main import app
        data = create_test_data()
        
        with app.test_client() as client:
            # Login as admin
            client.post('/api/auth/login', json={
                'email': 'admin@wotest.com',
                'password': 'test123'
            })
            
            # Submit W.O. with invalid winner_id
            response = client.post(f'/api/ranking/matches/{data["match_id"]}/wo',
                json={'winner_id': 'invalid', 'comment': ''})
            
            assert response.status_code == 400
            data = response.get_json()
            assert 'error' in data
