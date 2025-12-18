import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.database import get_db

@pytest.fixture
def setup_db():
    db = get_db()
    db.execute("DELETE FROM users WHERE email LIKE '%@example.com' OR email LIKE '%@test.com'")
    db.commit()
    db.close()
    yield
    db = get_db()
    db.execute("DELETE FROM users WHERE email LIKE '%@example.com' OR email LIKE '%@test.com'")
    db.commit()
    db.close()

def create_test_user(client, email='test@example.com', password='password123', short_name='Test User'):
    response = client.post('/api/auth/register', json={
        'email': email,
        'password': password,
        'name': 'Test User Full Name',
        'short_name': short_name,
        'phone': '11999999999',
        'pix_key': 'test@pix.com'
    })
    return response.get_json()

def test_update_profile(setup_db):
    from main import app
    
    with app.test_client() as client:
        create_test_user(client)
        
        # Update profile
        response = client.put('/api/auth/profile', 
        json={
            'name': 'Updated Name',
            'short_name': 'Updated Short',
            'email': 'updated@example.com',
            'phone': '11988888888',
            'pix_key': 'updated@pix.com'
        }
    )
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['user']['name'] == 'Updated Name'
    assert data['user']['short_name'] == 'Updated Short'
    assert data['user']['email'] == 'updated@example.com'
    assert data['user']['phone'] == '11988888888'
    assert data['user']['pix_key'] == 'updated@pix.com'

def test_update_profile_without_auth(setup_db):
    from main import app
    
    with app.test_client() as client:
        response = client.put('/api/auth/profile', json={
        'name': 'Test',
        'short_name': 'Test',
        'email': 'test@example.com'
    })
    
    assert response.status_code == 401

def test_change_password(setup_db):
    from main import app
    
    with app.test_client() as client:
        create_test_user(client, password='oldpass123')
        
        # Change password
        response = client.post('/api/auth/change-password',
        json={
            'current_password': 'oldpass123',
            'new_password': 'newpass123'
        }
    )
    
    assert response.status_code == 200
    assert 'Senha alterada com sucesso' in response.get_json()['message']
    
    # Try login with new password
    login_response = client.post('/api/auth/login', json={
        'email': 'test@example.com',
        'password': 'newpass123'
    })
    assert login_response.status_code == 200

def test_change_password_wrong_current(setup_db):
    from main import app
    
    with app.test_client() as client:
        create_test_user(client, password='correctpass')
        
        response = client.post('/api/auth/change-password',
        json={
            'current_password': 'wrongpass',
            'new_password': 'newpass123'
        }
    )
    
    assert response.status_code == 400
    assert 'Senha atual incorreta' in response.get_json()['error']

def test_change_password_too_short(setup_db):
    from main import app
    
    with app.test_client() as client:
        create_test_user(client)
        
        response = client.post('/api/auth/change-password',
        json={
            'current_password': 'password123',
            'new_password': '123'
        }
    )
    
    assert response.status_code == 400
    assert 'pelo menos 6 caracteres' in response.get_json()['error']

def test_get_users_short_names(setup_db):
    from main import app
    
    with app.test_client() as client:
        create_test_user(client, email='user1@test.com', short_name='John Doe')
        create_test_user(client, email='user2@test.com', short_name='Jane Smith')
    
    response = client.get('/api/public/users/short-names')
    
    assert response.status_code == 200
    data = response.get_json()
    assert 'John Doe' in data
    assert 'Jane Smith' in data

def test_register_with_short_name(setup_db):
    from main import app
    
    with app.test_client() as client:
        response = client.post('/api/auth/register', json={
        'email': 'newuser@test.com',
        'password': 'password123',
        'name': 'New User Full Name',
        'short_name': 'New User',
        'phone': '11999999999',
        'pix_key': 'newuser@pix.com'
    })
    
    assert response.status_code == 201
    data = response.get_json()
    assert data['user']['short_name'] == 'New User'

def test_register_without_short_name_auto_generates(setup_db):
    from main import app
    
    with app.test_client() as client:
        response = client.post('/api/auth/register', json={
        'email': 'autouser@test.com',
        'password': 'password123',
        'name': 'First Second Third',
        'pix_key': 'auto@pix.com'
    })
    
    assert response.status_code == 201
    data = response.get_json()
    assert data['user']['short_name'] == 'First Second'

def test_phone_stored_as_numbers(setup_db):
    from main import app
    
    with app.test_client() as client:
        response = client.post('/api/auth/register', json={
        'email': 'phone@test.com',
        'password': 'password123',
        'name': 'Phone Test',
        'short_name': 'Phone',
        'phone': '11999999999',
        'pix_key': 'phone@pix.com'
    })
    
    assert response.status_code == 201
    data = response.get_json()
    # Phone should be stored as numbers only
    assert data['user']['phone'] == '11999999999'
