import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Set required env vars for tests
os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.database import get_db
from src.auth import hash_password, generate_token

@pytest.fixture
def setup_db():
    """Setup test database"""
    db = get_db()
    # Clean up test users
    db.execute("DELETE FROM users WHERE email LIKE 'test%@lapen.com' OR email LIKE 'admin%@lapen.com'")
    db.execute("DELETE FROM schedules WHERE player1_name LIKE 'EditLiga%' OR player2_name LIKE 'EditLiga%'")
    db.execute("DELETE FROM courts WHERE name = 'EditLiga Court'")
    db.commit()
    db.close()
    yield
    # Cleanup after test
    db = get_db()
    db.execute("DELETE FROM users WHERE email LIKE 'test%@lapen.com' OR email LIKE 'admin%@lapen.com'")
    db.execute("DELETE FROM schedules WHERE player1_name LIKE 'EditLiga%' OR player2_name LIKE 'EditLiga%'")
    db.execute("DELETE FROM courts WHERE name = 'EditLiga Court'")
    db.commit()
    db.close()

def create_test_user(email, is_lapen=False, approved=False, is_admin=False):
    """Helper to create test user"""
    from main import app
    
    with app.app_context():
        db = get_db()
        password_hash = hash_password("test123")
        
        cursor = db.execute(
            'INSERT INTO users (email, password_hash, name, is_lapen_member, lapen_approved, is_admin, is_verified) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id',
            (email, password_hash, "Test User", is_lapen, approved, is_admin, True)
        )
        user_id = cursor.fetchone()['id']
        db.commit()
        token = generate_token(user_id)
        db.close()
        return user_id, token

def test_register_with_lapen_request(setup_db):
    """Test user registration with LAPEN member request"""
    from main import app
    
    with app.test_client() as client:
        response = client.post('/api/auth/register', json={
            'email': 'test1@lapen.com',
            'password': 'test123',
            'name': 'Test User',
            'is_lapen_member': True
        })
        
        assert response.status_code == 201
        data = response.get_json()
        assert 'pendente de aprovação' in data['message']
        assert data['user']['is_lapen_member'] == True
        assert data['user']['lapen_approved'] == False

def test_register_without_lapen_request(setup_db):
    """Test user registration without LAPEN member request"""
    from main import app
    
    with app.test_client() as client:
        response = client.post('/api/auth/register', json={
            'email': 'test2@lapen.com',
            'password': 'test123',
            'name': 'Test User',
            'is_lapen_member': False
        })
        
        assert response.status_code == 201
        data = response.get_json()
        assert 'pendente de aprovação' not in data['message']
        assert data['user']['is_lapen_member'] == False

def test_schedule_booking_requires_auth(setup_db):
    """Test that schedule booking requires authentication"""
    from main import app
    
    with app.test_client() as client:
        response = client.post('/api/public/schedules', json={
            'court_id': 1,
            'date': '2025-12-31',
            'start_time': '10:00',
            'player1_name': 'Player 1',
            'player2_name': 'Player 2',
            'match_type': 'Amistoso'
        })
        
        assert response.status_code == 401

def test_schedule_edit_cannot_change_match_to_liga(setup_db):
    """Generic schedule edits must not create Liga matches without ranking linkage."""
    user_id, token = create_test_user('test_edit_liga@lapen.com', is_lapen=True, approved=True)
    from main import app

    db = get_db()
    court_id = db.execute(
        "INSERT INTO courts (name, type, active) VALUES ('EditLiga Court', 'saibro', true) RETURNING id"
    ).fetchone()['id']
    schedule_id = db.execute(
        "INSERT INTO schedules (court_id, date, start_time, player1_name, player2_name, match_type) "
        "VALUES (%s, '2026-06-10', '10:00', 'EditLiga A', 'EditLiga B', 'Amistoso') RETURNING id",
        (court_id,)
    ).fetchone()['id']
    db.commit()
    db.close()

    with app.test_client() as client:
        response = client.put(
            f'/api/public/schedules/{schedule_id}',
            headers={'Authorization': f'Bearer {token}'},
            json={
                'player1_name': 'EditLiga A',
                'player2_name': 'EditLiga B',
                'match_type': 'Liga'
            }
        )

        assert response.status_code == 400
        assert 'Liga' in response.get_json()['error']

    db = get_db()
    schedule = db.execute('SELECT match_type FROM schedules WHERE id = %s', (schedule_id,)).fetchone()
    db.close()
    assert schedule['match_type'] == 'Amistoso'

def test_schedule_booking_requires_lapen_member(setup_db):
    """Test that non-LAPEN users cannot book"""
    user_id, token = create_test_user('test3@lapen.com', is_lapen=False)
    from main import app
    
    with app.test_client() as client:
        response = client.post('/api/public/schedules', 
            headers={'Authorization': f'Bearer {token}'},
            json={
                'court_id': 1,
                'date': '2025-12-31',
                'start_time': '10:00',
                'player1_name': 'Player 1',
                'player2_name': 'Player 2',
                'match_type': 'Amistoso'
            })
        
        assert response.status_code == 403
        assert 'LAPEN' in response.get_json()['error']

def test_schedule_booking_requires_approval(setup_db):
    """Test that pending LAPEN users cannot book"""
    user_id, token = create_test_user('test4@lapen.com', is_lapen=True, approved=False)
    from main import app
    
    with app.test_client() as client:
        response = client.post('/api/public/schedules',
            headers={'Authorization': f'Bearer {token}'},
            json={
                'court_id': 1,
                'date': '2025-12-31',
                'start_time': '10:00',
                'player1_name': 'Player 1',
                'player2_name': 'Player 2',
                'match_type': 'Amistoso'
            })
        
        assert response.status_code == 403
        assert 'pendente' in response.get_json()['error']

def test_approved_lapen_can_book(setup_db):
    """Test that approved LAPEN members can book"""
    user_id, token = create_test_user('test5@lapen.com', is_lapen=True, approved=True)
    from main import app
    
    with app.test_client() as client:
        # First ensure court exists and time is available
        response = client.post('/api/public/schedules',
            headers={'Authorization': f'Bearer {token}'},
            json={
                'court_id': 1,
                'date': '2025-12-31',
                'start_time': '10:00',
                'player1_name': 'Player 1',
                'player2_name': 'Player 2',
                'match_type': 'Amistoso'
            })
        
        # Should succeed or fail with business logic error (not auth error)
        assert response.status_code in [200, 400]  # 400 if court doesn't exist

def test_admin_approve_lapen_member(setup_db):
    """Test admin can approve LAPEN member"""
    user_id, _ = create_test_user('test6@lapen.com', is_lapen=True, approved=False)
    _, admin_token = create_test_user('admin@lapen.com', is_admin=True)
    from main import app
    
    with app.test_client() as client:
        response = client.post(f'/api/admin/lapen-approve/{user_id}',
            headers={'Authorization': f'Bearer {admin_token}'})
        
        assert response.status_code == 200
        assert response.get_json()['success'] == True
        
        # Verify in database
        db = get_db()
        user = db.execute('SELECT lapen_approved FROM users WHERE id = %s', (user_id,)).fetchone()
        assert user['lapen_approved'] == True
        db.close()

def test_admin_reject_lapen_member(setup_db):
    """Test admin can reject LAPEN member"""
    user_id, _ = create_test_user('test7@lapen.com', is_lapen=True, approved=False)
    _, admin_token = create_test_user('admin2@lapen.com', is_admin=True)
    from main import app
    
    with app.test_client() as client:
        response = client.post(f'/api/admin/lapen-reject/{user_id}',
            headers={'Authorization': f'Bearer {admin_token}'})
        
        assert response.status_code == 200
        assert response.get_json()['success'] == True
        
        # Verify in database - rejected users keep is_lapen_member=True but lapen_approved=False with timestamp
        db = get_db()
        user = db.execute('SELECT is_lapen_member, lapen_approved, lapen_approved_at FROM users WHERE id = %s', (user_id,)).fetchone()
        assert user['is_lapen_member'] == True
        assert user['lapen_approved'] == False
        assert user['lapen_approved_at'] is not None
        db.close()

def test_admin_list_pending_requests(setup_db):
    """Test admin can list pending LAPEN requests"""
    create_test_user('test8@lapen.com', is_lapen=True, approved=False)
    _, admin_token = create_test_user('admin3@lapen.com', is_admin=True)
    from main import app
    
    with app.test_client() as client:
        response = client.get('/api/admin/lapen-requests?status=pending',
            headers={'Authorization': f'Bearer {admin_token}'})
        
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)
        assert any(u['email'] == 'test8@lapen.com' for u in data)

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
