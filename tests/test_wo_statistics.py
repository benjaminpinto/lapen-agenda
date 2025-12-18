import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.database import get_db
from src.auth import hash_password

@pytest.fixture
def setup_db():
    db = get_db()
    # Cleanup
    db.execute("DELETE FROM match_statistics_unified WHERE ranking_match_id IN (SELECT id FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)))")
    db.execute("DELETE FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025))")
    db.execute("DELETE FROM ranking_draws WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025))")
    db.execute("DELETE FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_season_config WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_temp_points_rules WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_participants WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_seasons WHERE year >= 2025")
    db.execute("DELETE FROM users WHERE email LIKE '%@wotest.com'")
    db.commit()
    db.close()
    yield
    # Cleanup after
    db = get_db()
    db.execute("DELETE FROM match_statistics_unified WHERE ranking_match_id IN (SELECT id FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)))")
    db.execute("DELETE FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025))")
    db.execute("DELETE FROM ranking_draws WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025))")
    db.execute("DELETE FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_season_config WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_temp_points_rules WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_participants WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_seasons WHERE year >= 2025")
    db.execute("DELETE FROM users WHERE email LIKE '%@wotest.com'")
    db.commit()
    db.close()

def create_test_users():
    """Create test users and return their IDs"""
    db = get_db()
    password_hash = hash_password('test123')
    
    cursor = db.execute('''
        INSERT INTO users (email, password_hash, name, short_name, is_verified, is_lapen_member, lapen_approved)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
    ''', ('player1@wotest.com', password_hash, 'Player One', 'P1', True, True, True))
    player1_id = cursor.fetchone()['id']
    
    cursor = db.execute('''
        INSERT INTO users (email, password_hash, name, short_name, is_verified, is_lapen_member, lapen_approved)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
    ''', ('player2@wotest.com', password_hash, 'Player Two', 'P2', True, True, True))
    player2_id = cursor.fetchone()['id']
    
    cursor = db.execute('''
        INSERT INTO users (email, password_hash, name, short_name, is_admin, is_verified)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
    ''', ('admin@wotest.com', password_hash, 'Admin', 'Admin', True, True))
    admin_id = cursor.fetchone()['id']
    
    db.commit()
    db.close()
    return player1_id, player2_id, admin_id

def create_ranking_match(season_id, round_id, player1_id, player2_id):
    """Create a ranking match and return its ID"""
    db = get_db()
    cursor = db.execute('''
        INSERT INTO ranking_matches (round_id, player1_id, player2_id, status, group_type)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    ''', (round_id, player1_id, player2_id, 'scheduled', 'elite'))
    match_id = cursor.fetchone()['id']
    db.commit()
    db.close()
    return match_id

def test_wo_match_appears_in_statistics(setup_db):
    """Test that W.O. matches are recorded in match_statistics_unified"""
    from main import app
    
    # Create test data
    player1_id, player2_id, admin_id = create_test_users()
    
    db = get_db()
    
    # Create season
    cursor = db.execute('''
        INSERT INTO ranking_seasons (year, start_date, end_date, status)
        VALUES (%s, %s, %s, %s) RETURNING id
    ''', (2025, '2025-01-01', '2025-12-31', 'active'))
    season_id = cursor.fetchone()['id']
    
    # Create round
    cursor = db.execute('''
        INSERT INTO ranking_rounds (season_id, round_number, month, year, status)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    ''', (season_id, 1, 1, 2025, 'open'))
    round_id = cursor.fetchone()['id']
    
    # Create participants
    db.execute('''
        INSERT INTO ranking_participants (season_id, user_id, temp_points, total_points)
        VALUES (%s, %s, %s, %s)
    ''', (season_id, player1_id, 0, 0))
    db.execute('''
        INSERT INTO ranking_participants (season_id, user_id, temp_points, total_points)
        VALUES (%s, %s, %s, %s)
    ''', (season_id, player2_id, 0, 0))
    
    db.commit()
    db.close()
    
    # Create match
    match_id = create_ranking_match(season_id, round_id, player1_id, player2_id)
    
    # Login as admin
    with app.test_client() as client:
        login_response = client.post('/api/auth/login', json={
            'email': 'admin@wotest.com',
            'password': 'test123'
        })
        cookies = login_response.headers.getlist('Set-Cookie'); admin_token = [cookie.split('access_token=')[1].split(';')[0] for cookie in cookies if 'access_token=' in cookie][0]
        
        # Set W.O. result
        response = client.post(f'/api/ranking/matches/{match_id}/wo',
            headers={'Authorization': f'Bearer {admin_token}'},
            json={
                'winner_id': player1_id,
                'comment': 'Player 2 did not show up'
            }
        )
        
        assert response.status_code == 200
        
        # Verify match_statistics_unified has the W.O. record
        db = get_db()
        stats = db.execute('''
            SELECT * FROM match_statistics_unified 
            WHERE ranking_match_id = %s
        ''', (match_id,)).fetchone()
        
        assert stats is not None, "W.O. match should be in statistics"
        assert stats['winner_id'] == player1_id
        assert 'W.O.' in stats['score']
        assert stats['match_type'] == 'Ranking'
        assert stats['season_id'] == season_id
        
        db.close()

def test_wo_match_counts_in_player_statistics(setup_db):
    """Test that W.O. matches count in player win/loss statistics"""
    from main import app
    
    # Create test data
    player1_id, player2_id, admin_id = create_test_users()
    
    db = get_db()
    
    # Create season
    cursor = db.execute('''
        INSERT INTO ranking_seasons (year, start_date, end_date, status)
        VALUES (%s, %s, %s, %s) RETURNING id
    ''', (2025, '2025-01-01', '2025-12-31', 'active'))
    season_id = cursor.fetchone()['id']
    
    # Create round
    cursor = db.execute('''
        INSERT INTO ranking_rounds (season_id, round_number, month, year, status)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    ''', (season_id, 1, 1, 2025, 'open'))
    round_id = cursor.fetchone()['id']
    
    # Create participants
    db.execute('''
        INSERT INTO ranking_participants (season_id, user_id, temp_points, total_points)
        VALUES (%s, %s, %s, %s)
    ''', (season_id, player1_id, 0, 0))
    db.execute('''
        INSERT INTO ranking_participants (season_id, user_id, temp_points, total_points)
        VALUES (%s, %s, %s, %s)
    ''', (season_id, player2_id, 0, 0))
    
    db.commit()
    db.close()
    
    # Create match
    match_id = create_ranking_match(season_id, round_id, player1_id, player2_id)
    
    # Login as admin and set W.O.
    with app.test_client() as client:
        login_response = client.post('/api/auth/login', json={
            'email': 'admin@wotest.com',
            'password': 'test123'
        })
        cookies = login_response.headers.getlist('Set-Cookie'); admin_token = [cookie.split('access_token=')[1].split(';')[0] for cookie in cookies if 'access_token=' in cookie][0]
        
        client.post(f'/api/ranking/matches/{match_id}/wo',
            headers={'Authorization': f'Bearer {admin_token}'},
            json={'winner_id': player1_id, 'comment': 'No show'}
        )
        
        # Check player1 statistics (winner)
        response = client.get('/api/statistics/player?player1=P1')
        assert response.status_code == 200
        
        stats = response.get_json()
        assert stats['total_matches'] == 1
        assert stats['wins'] == 1
        assert stats['losses'] == 0
        
        # Check player2 statistics (loser)
        response = client.get('/api/statistics/player?player1=P2')
        assert response.status_code == 200
        
        stats = response.get_json()
        assert stats['total_matches'] == 1
        assert stats['wins'] == 0
        assert stats['losses'] == 1

def test_wo_match_in_general_statistics(setup_db):
    """Test that W.O. matches appear in general statistics"""
    from main import app
    
    # Create test data
    player1_id, player2_id, admin_id = create_test_users()
    
    db = get_db()
    
    # Create season
    cursor = db.execute('''
        INSERT INTO ranking_seasons (year, start_date, end_date, status)
        VALUES (%s, %s, %s, %s) RETURNING id
    ''', (2025, '2025-01-01', '2025-12-31', 'active'))
    season_id = cursor.fetchone()['id']
    
    # Create round
    cursor = db.execute('''
        INSERT INTO ranking_rounds (season_id, round_number, month, year, status)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    ''', (season_id, 1, 1, 2025, 'open'))
    round_id = cursor.fetchone()['id']
    
    # Create participants
    db.execute('''
        INSERT INTO ranking_participants (season_id, user_id, temp_points, total_points)
        VALUES (%s, %s, %s, %s)
    ''', (season_id, player1_id, 0, 0))
    db.execute('''
        INSERT INTO ranking_participants (season_id, user_id, temp_points, total_points)
        VALUES (%s, %s, %s, %s)
    ''', (season_id, player2_id, 0, 0))
    
    db.commit()
    db.close()
    
    # Create match
    match_id = create_ranking_match(season_id, round_id, player1_id, player2_id)
    
    # Login as admin and set W.O.
    with app.test_client() as client:
        login_response = client.post('/api/auth/login', json={
            'email': 'admin@wotest.com',
            'password': 'test123'
        })
        cookies = login_response.headers.getlist('Set-Cookie'); admin_token = [cookie.split('access_token=')[1].split(';')[0] for cookie in cookies if 'access_token=' in cookie][0]
        
        client.post(f'/api/ranking/matches/{match_id}/wo',
            headers={'Authorization': f'Bearer {admin_token}'},
            json={'winner_id': player1_id, 'comment': 'No show'}
        )
        
        # Check general statistics
        response = client.get(f'/api/statistics/general?season={season_id}')
        assert response.status_code == 200
        
        stats = response.get_json()
        assert stats['total_matches'] == 1
        assert stats['total_players'] == 2
        assert 'Ranking' in stats['match_types']
        assert stats['match_types']['Ranking'] == 1

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
