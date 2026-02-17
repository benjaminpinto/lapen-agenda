import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.database import get_db
from src.auth import hash_password, generate_token
from main import app

def create_test_user(email="timezone_test@lapen.com"):
    """Helper to create approved LAPEN test user"""
    with app.app_context():
        db = get_db()
        password_hash = hash_password("test123")
        
        cursor = db.execute(
            'INSERT INTO users (email, password_hash, name, is_lapen_member, lapen_approved, is_verified) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id',
            (email, password_hash, "Timezone Test User", True, True, True)
        )
        user_id = cursor.fetchone()['id']
        db.commit()
        token = generate_token(user_id)
        db.close()
        return user_id, token

@pytest.fixture
def setup_db():
    """Setup test database"""
    db = get_db()
    # Clean up test data (schedules first due to foreign key)
    db.execute("DELETE FROM schedules WHERE player1_name LIKE '%timezone_test%' OR player1_name LIKE '%existing_player%' OR player1_name LIKE '%WhatsApp_%' OR player1_name LIKE '%concurrent_test%' OR player1_name LIKE '%player1_%'")
    db.execute("DELETE FROM courts WHERE name LIKE '%timezone_test%'")
    db.execute("DELETE FROM users WHERE email LIKE '%timezone_%'")
    db.commit()
    
    # Create test court
    db.execute("INSERT INTO courts (name, type, active) VALUES ('timezone_test_court', 'Saibro', TRUE)")
    db.commit()
    db.close()
    yield
    
    # Cleanup (schedules first due to foreign key)
    db = get_db()
    db.execute("DELETE FROM schedules WHERE player1_name LIKE '%timezone_test%' OR player1_name LIKE '%existing_player%' OR player1_name LIKE '%WhatsApp_%' OR player1_name LIKE '%concurrent_test%' OR player1_name LIKE '%player1_%'")
    db.execute("DELETE FROM courts WHERE name LIKE '%timezone_test%'")
    db.execute("DELETE FROM users WHERE email LIKE '%timezone_%'")
    db.commit()
    db.close()

class TestTimezoneBoundaries:
    """Test timezone boundary cases for schedule creation"""
    
    def test_schedule_creation_with_local_dates(self, setup_db):
        """Test that schedules can be created with local dates regardless of server timezone"""
        user_id, token = create_test_user()
        
        with app.test_client() as client:
            # Get test court
            db = get_db()
            court = db.execute("SELECT id FROM courts WHERE name = 'timezone_test_court'").fetchone()
            court_id = court['id']
            db.close()
            
            # Test data - simulating frontend sending local date
            schedule_data = {
                'court_id': court_id,
                'date': '2026-02-16',  # Local date from frontend
                'start_time': '15:00',  # 3 PM
                'player1_name': 'timezone_test_player1',
                'player2_name': 'timezone_test_player2',
                'match_type': 'Amistoso'
            }
            
            response = client.post('/api/public/schedules', 
                                 headers={'Authorization': f'Bearer {token}'},
                                 json=schedule_data)
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True
            
            # Verify schedule was created with correct date
            db = get_db()
            schedule = db.execute("""
                SELECT date, start_time FROM schedules 
                WHERE player1_name = 'timezone_test_player1'
            """).fetchone()
            
            assert schedule is not None
            # Date should be stored exactly as sent (no timezone conversion)
            if isinstance(schedule['date'], str):
                assert schedule['date'] == '2026-02-16'
            else:
                assert schedule['date'] == date(2026, 2, 16)
            db.close()
    
    def test_available_times_with_local_dates(self, setup_db):
        """Test that available times work correctly with local dates"""
        with app.test_client() as client:
            db = get_db()
            court = db.execute("SELECT id FROM courts WHERE name = 'timezone_test_court'").fetchone()
            court_id = court['id']
            
            # Create a test schedule for the date
            db.execute("""
                INSERT INTO schedules (court_id, date, start_time, player1_name, player2_name, match_type)
                VALUES (%s, %s, %s, 'existing_player1', 'existing_player2', 'Amistoso')
            """, (court_id, '2026-02-16', '15:00'))
            db.commit()
            db.close()
            
            # Request available times for the same date
            response = client.get(f'/api/public/available-times?court_id={court_id}&date=2026-02-16')
            
            assert response.status_code == 200
            available_times = response.get_json()
            
            # 15:00 should not be available (already booked)
            assert '15:00' not in available_times
            # Other times should be available
            assert '07:30' in available_times
            assert '16:30' in available_times
    
    def test_date_validation_edge_cases(self, setup_db):
        """Test date validation at timezone boundaries"""
        user_id, token = create_test_user('timezone_edge_validation@lapen.com')
        
        with app.test_client() as client:
            db = get_db()
            court = db.execute("SELECT id FROM courts WHERE name = 'timezone_test_court'").fetchone()
            court_id = court['id']
            db.close()
            
            test_cases = [
                {
                    'name': 'valid_today_date',
                    'date': '2026-02-16',
                    'should_succeed': True
                },
                {
                    'name': 'valid_future_date',
                    'date': '2026-02-17',
                    'should_succeed': True
                },
                {
                    'name': 'valid_far_future_date',
                    'date': '2026-03-01',
                    'should_succeed': True
                }
            ]
            
            for case in test_cases:
                schedule_data = {
                    'court_id': court_id,
                    'date': case['date'],
                    'start_time': '15:00',
                    'player1_name': f'timezone_test_{case["name"]}_p1',
                    'player2_name': f'timezone_test_{case["name"]}_p2',
                    'match_type': 'Amistoso'
                }
                
                response = client.post('/api/public/schedules',
                                     headers={'Authorization': f'Bearer {token}'},
                                     json=schedule_data)
                
                if case['should_succeed']:
                    assert response.status_code == 200, f"Failed for case: {case['name']}"
                    data = response.get_json()
                    assert data['success'] is True
                else:
                    assert response.status_code == 400, f"Should have failed for case: {case['name']}"
    
    def test_month_schedules_with_timezone_dates(self, setup_db):
        """Test that month schedule retrieval works with timezone-aware dates"""
        with app.test_client() as client:
            db = get_db()
            court = db.execute("SELECT id FROM courts WHERE name = 'timezone_test_court'").fetchone()
            court_id = court['id']
            
            # Create schedules for different dates in February 2026
            test_schedules = [
                ('2026-02-16', '15:00', 'player1_16', 'player2_16'),
                ('2026-02-17', '16:30', 'player1_17', 'player2_17'),
                ('2026-02-28', '18:00', 'player1_28', 'player2_28')
            ]
            
            for date_str, time_str, p1, p2 in test_schedules:
                db.execute("""
                    INSERT INTO schedules (court_id, date, start_time, player1_name, player2_name, match_type)
                    VALUES (%s, %s, %s, %s, %s, 'Amistoso')
                """, (court_id, date_str, time_str, p1, p2))
            
            db.commit()
            db.close()
            
            # Request February 2026 schedules
            response = client.get('/api/public/schedules/month?year=2026&month=2')
            
            assert response.status_code == 200
            schedules = response.get_json()
            
            # Should find all test schedules
            test_player_schedules = [s for s in schedules if 'player1_' in s['player1_name']]
            assert len(test_player_schedules) == 3
            
            # Verify dates are returned correctly
            dates = [s['date'] for s in test_player_schedules]
            assert '2026-02-16' in dates
            assert '2026-02-17' in dates
            assert '2026-02-28' in dates
    
    def test_whatsapp_message_generation_with_timezone_dates(self, setup_db):
        """Test WhatsApp message generation with timezone-aware dates"""
        with app.test_client() as client:
            # Generate WhatsApp message for February 2026
            response = client.get('/api/public/whatsapp-message?year=2026&month=2')
            
            assert response.status_code == 200
            data = response.get_json()
            message = data['message']
            
            # Should contain basic message structure
            assert 'Fevereiro 2026' in message
            assert 'LAPEN' in message
            assert isinstance(message, str)
            assert len(message) > 0
    
    def test_concurrent_schedule_creation_same_date(self, setup_db):
        """Test that concurrent schedule creation for same date/time fails appropriately"""
        user_id, token = create_test_user('timezone_concurrent_unique@lapen.com')
        
        with app.test_client() as client:
            db = get_db()
            court = db.execute("SELECT id FROM courts WHERE name = 'timezone_test_court'").fetchone()
            court_id = court['id']
            db.close()
            
            schedule_data = {
                'court_id': court_id,
                'date': '2026-02-16',
                'start_time': '15:00',
                'player1_name': 'concurrent_test_p1',
                'player2_name': 'concurrent_test_p2',
                'match_type': 'Amistoso'
            }
            
            # First request should succeed
            response1 = client.post('/api/public/schedules',
                                  headers={'Authorization': f'Bearer {token}'},
                                  json=schedule_data)
            assert response1.status_code == 200
            
            # Second request for same slot should fail
            schedule_data['player1_name'] = 'concurrent_test_p3'
            schedule_data['player2_name'] = 'concurrent_test_p4'
            
            response2 = client.post('/api/public/schedules',
                                  headers={'Authorization': f'Bearer {token}'},
                                  json=schedule_data)
            assert response2.status_code == 400
            data = response2.get_json()
            assert 'não está mais disponível' in data['error']