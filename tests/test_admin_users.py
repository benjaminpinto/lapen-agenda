import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.database import get_db
from src.auth import hash_password

@pytest.fixture
def setup_db():
    db = get_db()
    db.execute("DELETE FROM users WHERE email LIKE '%@test.com'")
    db.commit()
    db.close()
    yield
    db = get_db()
    db.execute("DELETE FROM users WHERE email LIKE '%@test.com'")
    db.commit()
    db.close()

def create_admin_user(client):
    db = get_db()
    password_hash = hash_password('admin123')
    cursor = db.execute('''
        INSERT INTO users (email, password_hash, name, short_name, is_admin, is_lapen_member, lapen_approved)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', ('admin@test.com', password_hash, 'Admin User', 'Admin', True, True, True))
    db.commit()
    user_id = cursor.lastrowid
    db.close()
    
    # Login to get token
    response = client.post('/api/auth/login', json={
        'email': 'admin@test.com',
        'password': 'admin123'
    })
    return response.get_json()['token']

def create_regular_user(client, email='user@test.com'):
    """Helper to create a regular user"""
    response = client.post('/api/auth/register', json={
        'email': email,
        'password': 'password123',
        'name': 'Regular User',
        'short_name': 'Regular',
        'phone': '11999999999',
        'pix_key': 'user@pix.com'
    })
    return response.get_json()

def test_admin_get_users(setup_db):
    from main import app
    
    with app.test_client() as client:
        admin_token = create_admin_user(client)
        create_regular_user(client)
    
    response = client.get('/api/admin/users',
        headers={'Authorization': f'Bearer {admin_token}'}
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) >= 2  # At least admin and regular user

def test_admin_update_user(setup_db):
    from main import app
    
    with app.test_client() as client:
        admin_token = create_admin_user(client)
        user_data = create_regular_user(client)
        user_id = user_data['user']['id']
    
    response = client.put(f'/api/admin/users/{user_id}',
        headers={'Authorization': f'Bearer {admin_token}'},
        json={
            'name': 'Updated Name',
            'short_name': 'Updated',
            'email': 'updated@test.com',
            'phone': '11988888888',
            'pix_key': 'updated@pix.com',
            'is_admin': False,
            'lapen_approved': True
        }
    )
    
    assert response.status_code == 200

def test_admin_update_user_password(setup_db):
    from main import app
    
    with app.test_client() as client:
        admin_token = create_admin_user(client)
        user_data = create_regular_user(client)
        user_id = user_data['user']['id']
    
    response = client.put(f'/api/admin/users/{user_id}/password',
        headers={'Authorization': f'Bearer {admin_token}'},
        json={'password': 'newpassword123'}
    )
    
    assert response.status_code == 200
    
    # Verify new password works
    login_response = client.post('/api/auth/login', json={
        'email': 'user@test.com',
        'password': 'newpassword123'
    })
    assert login_response.status_code == 200

def test_admin_delete_user(setup_db):
    from main import app
    
    with app.test_client() as client:
        admin_token = create_admin_user(client)
        user_data = create_regular_user(client, email='delete@test.com')
        user_id = user_data['user']['id']
    
    response = client.delete(f'/api/admin/users/{user_id}',
        headers={'Authorization': f'Bearer {admin_token}'}
    )
    
    assert response.status_code == 200

def test_non_admin_cannot_access_users(setup_db):
    from main import app
    
    with app.test_client() as client:
        user_data = create_regular_user(client)
        token = user_data['token']
    
    response = client.get('/api/admin/users',
        headers={'Authorization': f'Bearer {token}'}
    )
    
    assert response.status_code == 403

def test_admin_update_lapen_status(setup_db):
    from main import app
    
    with app.test_client() as client:
        admin_token = create_admin_user(client)
        user_data = create_regular_user(client)
        user_id = user_data['user']['id']
    
    response = client.put(f'/api/admin/users/{user_id}',
        headers={'Authorization': f'Bearer {admin_token}'},
        json={
            'name': 'Regular User',
            'short_name': 'Regular',
            'email': 'user@test.com',
            'phone': '11999999999',
            'pix_key': 'user@pix.com',
            'is_admin': False,
            'lapen_approved': True
        }
    )
    
    assert response.status_code == 200
