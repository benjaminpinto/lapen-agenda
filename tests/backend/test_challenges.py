import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from src.database import get_db
from src.auth import hash_password
from src.routes.challenges import challenges_bp

# Helper to create users
def create_user(email, name, short_name):
    db = get_db()
    cursor = db.execute('''
        INSERT INTO users (email, password_hash, name, short_name, is_verified, is_lapen_member, lapen_approved) 
        VALUES (%s, %s, %s, %s, true, true, true) RETURNING id
    ''', (email, hash_password('password'), name, short_name))
    user_id = cursor.fetchone()['id']
    db.commit()
    db.close()
    return user_id

def get_auth_token(client, email):
    response = client.post('/api/auth/login', json={
        'email': email,
        'password': 'password'
    })
    # Login now returns tokens in cookies, extract from cookie
    return response.headers.get('Set-Cookie', '').split('access_token=')[1].split(';')[0] if 'access_token=' in response.headers.get('Set-Cookie', '') else None

@pytest.fixture
def setup_data():
    db = get_db()
    # Clean up in correct order (child tables first)
    db.execute("DELETE FROM challenges WHERE challenger_id IN (SELECT id FROM users WHERE email LIKE '%@challengetest.com') OR challenged_id IN (SELECT id FROM users WHERE email LIKE '%@challengetest.com')")
    db.execute("DELETE FROM match_statistics_unified WHERE added_by IN (SELECT id FROM users WHERE email LIKE '%@challengetest.com')")
    db.execute("DELETE FROM schedules WHERE player1_name IN ('U1', 'U2') OR player2_name IN ('U1', 'U2')")
    db.execute("DELETE FROM users WHERE email LIKE '%@challengetest.com'")
    db.commit()
    db.close()
    
    # Create users
    u1 = create_user('u1@challengetest.com', 'User One', 'U1')
    u2 = create_user('u2@challengetest.com', 'User Two', 'U2')
    
    yield {'u1': u1, 'u2': u2}
    
    # Cleanup after in correct order
    db = get_db()
    db.execute("DELETE FROM challenges WHERE challenger_id IN (SELECT id FROM users WHERE email LIKE '%@challengetest.com') OR challenged_id IN (SELECT id FROM users WHERE email LIKE '%@challengetest.com')")
    db.execute("DELETE FROM match_statistics_unified WHERE added_by IN (SELECT id FROM users WHERE email LIKE '%@challengetest.com')")
    db.execute("DELETE FROM schedules WHERE player1_name IN ('U1', 'U2') OR player2_name IN ('U1', 'U2')")
    db.execute("DELETE FROM users WHERE email LIKE '%@challengetest.com'")
    db.commit()
    db.close()

class TestChallenges:
    def test_create_challenge(self, setup_data):
        from main import app
        u1_id = setup_data['u1']
        u2_id = setup_data['u2']

        with app.test_client() as client:
            token = get_auth_token(client, 'u1@challengetest.com')
            
            # 1. Create Challenge
            response = client.post('/api/challenges/create', 
                json={
                    'challenged_id': u2_id,
                    'start_date': '2025-01-01',
                    'end_date': '2025-01-31',
                    'target_type': 'victories',
                    'target_amount': 5,
                    'prize_comment': 'Pizza'
                },
                headers={'Authorization': f'Bearer {token}'}
            )
            assert response.status_code == 201
            data = response.get_json()
            assert data['message'] == 'Desafio criado com sucesso'

            # 2. Check Database
            db = get_db()
            challenge = db.execute("SELECT * FROM challenges WHERE challenger_id = %s", (u1_id,)).fetchone()
            assert challenge is not None
            assert challenge['status'] == 'pending'
            assert challenge['target_type'] == 'victories'
            db.close()

    def test_cannot_challenge_self(self, setup_data):
        from main import app
        u1_id = setup_data['u1']
        
        with app.test_client() as client:
            token = get_auth_token(client, 'u1@challengetest.com')
            response = client.post('/api/challenges/create', 
                json={
                    'challenged_id': u1_id, # Self
                    'start_date': '2025-01-01',
                    'end_date': '2025-01-31',
                    'target_type': 'victories'
                },
                headers={'Authorization': f'Bearer {token}'}
            )
            assert response.status_code == 400
            assert 'Não é possível desafiar a si mesmo' in response.get_json()['error']

    def test_get_users(self, setup_data):
        from main import app
        with app.test_client() as client:
            token = get_auth_token(client, 'u1@challengetest.com')
            response = client.get('/api/challenges/users', headers={'Authorization': f'Bearer {token}'})
            assert response.status_code == 200
            users = response.get_json()
            assert any(u['email'] == 'u2@challengetest.com' for u in users if 'email' in u) or \
                   any(u['short_name'] == 'U2' for u in users)

    def test_accept_reject_challenge(self, setup_data):
        from main import app
        u1_id = setup_data['u1']
        u2_id = setup_data['u2']
        
        # Manually create a challenge
        db = get_db()
        cursor = db.execute('''
            INSERT INTO challenges (challenger_id, challenged_id, start_date, end_date, target_type, status)
            VALUES (%s, %s, '2025-01-01', '2025-01-31', 'victories', 'pending') RETURNING id
        ''', (u1_id, u2_id))
        challenge_id = cursor.fetchone()['id']
        db.commit()
        db.close()

        with app.test_client() as client:
            # U2 logs in
            token_u2 = get_auth_token(client, 'u2@challengetest.com')
            
            # Accept
            response = client.post(f'/api/challenges/{challenge_id}/accept', headers={'Authorization': f'Bearer {token_u2}'})
            assert response.status_code == 200
            
            db = get_db()
            status = db.execute("SELECT status FROM challenges WHERE id = %s", (challenge_id,)).fetchone()['status']
            assert status == 'active'
            db.close()

            # Create another one to reject
            db = get_db()
            cursor = db.execute('''
                INSERT INTO challenges (challenger_id, challenged_id, start_date, end_date, target_type, status)
                VALUES (%s, %s, '2025-01-01', '2025-01-31', 'victories', 'pending') RETURNING id
            ''', (u1_id, u2_id))
            c2_id = cursor.fetchone()['id']
            db.commit()
            db.close()

            # Reject
            response = client.post(f'/api/challenges/{c2_id}/reject', headers={'Authorization': f'Bearer {token_u2}'})
            assert response.status_code == 200
            
            db = get_db()
            status = db.execute("SELECT status FROM challenges WHERE id = %s", (c2_id,)).fetchone()['status']
            assert status == 'rejected'
            db.close()

    def test_delete_challenge(self, setup_data):
        from main import app
        u1_id = setup_data['u1']
        u2_id = setup_data['u2']
        
        db = get_db()
        cursor = db.execute('''
            INSERT INTO challenges (challenger_id, challenged_id, start_date, end_date, target_type, status)
            VALUES (%s, %s, '2025-01-01', '2025-01-31', 'victories', 'pending') RETURNING id
        ''', (u1_id, u2_id))
        c_id = cursor.fetchone()['id']
        db.commit()
        db.close()

        with app.test_client() as client:
            token = get_auth_token(client, 'u1@challengetest.com')
            response = client.delete(f'/api/challenges/{c_id}', headers={'Authorization': f'Bearer {token}'})
            assert response.status_code == 200
            
            db = get_db()
            status = db.execute("SELECT status FROM challenges WHERE id = %s", (c_id,)).fetchone()['status']
            assert status == 'cancelled'
            db.close()

    def test_challenge_progress(self, setup_data):
        from main import app
        from src.routes.challenges import get_challenge_progress
        u1_id = setup_data['u1']
        u2_id = setup_data['u2']

        # Create active challenge
        db = get_db()
        cursor = db.execute('''
            INSERT INTO challenges (challenger_id, challenged_id, start_date, end_date, target_type, status)
            VALUES (%s, %s, '2025-01-01', '2025-01-31', 'victories', 'active') RETURNING *
        ''', (u1_id, u2_id))
        challenge = cursor.fetchone() # returns RealDictRow

        # Insert some match stats (simulating match results)
        # Using match_statistics_unified
        # Need to create a schedule_id first to satisfy the constraint
        cursor = db.execute('''
            INSERT INTO schedules (court_id, date, start_time, player1_name, player2_name, match_type)
            VALUES (1, '2025-01-10', '10:00', 'U1', 'U2', 'Amistoso') RETURNING id
        ''')
        schedule_id_1 = cursor.fetchone()['id']
        
        cursor = db.execute('''
            INSERT INTO schedules (court_id, date, start_time, player1_name, player2_name, match_type)
            VALUES (1, '2025-01-15', '10:00', 'U2', 'U1', 'Amistoso') RETURNING id
        ''')
        schedule_id_2 = cursor.fetchone()['id']
        
        cursor = db.execute('''
            INSERT INTO schedules (court_id, date, start_time, player1_name, player2_name, match_type)
            VALUES (1, '2025-01-10', '12:00', 'U1', 'U2', 'Ranking') RETURNING id
        ''')
        schedule_id_3 = cursor.fetchone()['id']
        
        cursor = db.execute('''
            INSERT INTO schedules (court_id, date, start_time, player1_name, player2_name, match_type)
            VALUES (1, '2025-02-01', '10:00', 'U1', 'U2', 'Amistoso') RETURNING id
        ''')
        schedule_id_4 = cursor.fetchone()['id']
        
        # 1. U1 wins - 6/0 6/0 (Amistoso) INSIDE date range
        db.execute('''
            INSERT INTO match_statistics_unified 
            (schedule_id, player1_id, player2_id, player1_name, player2_name, winner_id, winner_name, score, match_type, match_date, season_id, added_by)
            VALUES (%s, %s, %s, 'U1', 'U2', %s, 'U1', '6-0 6-0', 'Amistoso', '2025-01-10', NULL, %s)
        ''', (schedule_id_1, u1_id, u2_id, u1_id, u1_id))

        # 2. U2 wins - 6-4 4-6 10-8 (Amistoso) INSIDE date range
        db.execute('''
            INSERT INTO match_statistics_unified 
            (schedule_id, player1_id, player2_id, player1_name, player2_name, winner_id, winner_name, score, match_type, match_date, season_id, added_by)
            VALUES (%s, %s, %s, 'U2', 'U1', %s, 'U2', '6-4 4-6 10-8', 'Amistoso', '2025-01-15', NULL, %s)
        ''', (schedule_id_2, u2_id, u1_id, u2_id, u1_id))

        # 3. U1 wins - (Ranking) - Should NOT count
        db.execute('''
            INSERT INTO match_statistics_unified 
            (schedule_id, player1_id, player2_id, player1_name, player2_name, winner_id, winner_name, score, match_type, match_date, season_id, added_by)
            VALUES (%s, %s, %s, 'U1', 'U2', %s, 'U1', '6-0 6-0', 'Ranking', '2025-01-10', NULL, %s)
        ''', (schedule_id_3, u1_id, u2_id, u1_id, u1_id))

        # 4. U1 wins - (Amistoso) - OUTSIDE date range
        db.execute('''
            INSERT INTO match_statistics_unified 
            (schedule_id, player1_id, player2_id, player1_name, player2_name, winner_id, winner_name, score, match_type, match_date, season_id, added_by)
            VALUES (%s, %s, %s, 'U1', 'U2', %s, 'U1', '6-0 6-0', 'Amistoso', '2025-02-01', NULL, %s)
        ''', (schedule_id_4, u1_id, u2_id, u1_id, u1_id))

        db.commit()
        
        # Test Calculation
        progress = get_challenge_progress(db, challenge)
        db.close()
        
        # Expected:
        # Match 1: U1 wins (1 victory), 12 games vs 0 games. (Assuming 2 sets won if logic handles 6-0 6-0)
        # Match 2: U2 wins (1 victory), Games: U2 (6+4+10) no, score parsing depends on logic. 
        #           Logic in code uses split() and checks numeric.
        #           "6-4 4-6 10-8": 6-4 (U2=6,U1=4), 4-6 (U2=4,U1=6), 10-8 (U2=10, U1=8).
        #           Total U2 Games: 6+4+10 = 20. Total U1 Games: 4+6+8 = 18.
        # Total Victories: U1=1, U2=1
        # Total Games: U1=12+18=30, U2=0+20=20.
        
        # Assertions
        assert progress['matches_played'] == 2 # Only the 2 Amistoso inside date
        assert progress['challenger']['victories'] == 1
        assert progress['challenged']['victories'] == 1
