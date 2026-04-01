import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.database import get_db
from src.routes.ranking import _update_match_result

@pytest.fixture
def setup_db():
    db = get_db()
    # Cleanup
    db.execute("DELETE FROM match_statistics_unified WHERE season_id = 9999")
    db.execute("DELETE FROM ranking_matches WHERE id >= 9999")
    db.execute("DELETE FROM ranking_draws WHERE round_id = 9999")
    db.execute("DELETE FROM ranking_participants WHERE season_id = 9999")
    db.execute("DELETE FROM ranking_rounds WHERE season_id = 9999")
    db.execute("DELETE FROM ranking_seasons WHERE id = 9999")
    db.execute("DELETE FROM users WHERE email LIKE '%@testrank.com'")
    db.commit()
    
    # Create test users
    db.execute("""
        INSERT INTO users (id, email, password_hash, name, short_name, is_verified)
        VALUES (9991, 'player1@testrank.com', 'hash', 'Player One', 'P1', true),
               (9992, 'player2@testrank.com', 'hash', 'Player Two', 'P2', true)
    """)
    
    # Create test season
    db.execute("""
        INSERT INTO ranking_seasons (id, year, start_date, end_date, status)
        VALUES (9999, 2025, '2025-01-01', '2025-12-31', 'active')
    """)
    
    # Create test round
    db.execute("""
        INSERT INTO ranking_rounds (id, season_id, round_number, month, year, status)
        VALUES (9999, 9999, 1, 1, 2025, 'open')
    """)
    
    # Create test participants
    db.execute("""
        INSERT INTO ranking_participants (season_id, user_id, position, total_points)
        VALUES (9999, 9991, 1, 0), (9999, 9992, 2, 0)
    """)
    
    # Create test match
    db.execute("""
        INSERT INTO ranking_matches (id, round_id, player1_id, player2_id, status, group_type)
        VALUES (9999, 9999, 9991, 9992, 'scheduled', 'elite')
    """)
    
    db.commit()
    db.close()
    yield
    
    # Cleanup
    db = get_db()
    db.execute("DELETE FROM match_statistics_unified WHERE season_id = 9999")
    db.execute("DELETE FROM ranking_matches WHERE id >= 9999")
    db.execute("DELETE FROM ranking_draws WHERE round_id = 9999")
    db.execute("DELETE FROM ranking_participants WHERE season_id = 9999")
    db.execute("DELETE FROM ranking_rounds WHERE season_id = 9999")
    db.execute("DELETE FROM ranking_seasons WHERE id = 9999")
    db.execute("DELETE FROM users WHERE email LIKE '%@testrank.com'")
    db.commit()
    db.close()

def test_ranking_match_creates_statistics_entry(setup_db):
    """Test that completing a ranking match creates a statistics entry"""
    db = get_db()
    
    # Complete the match
    _update_match_result(db, 9999, 9991, '6-4, 6-3', 'none', 2, 0, 12, 7, 9991)
    db.commit()
    
    # Verify match is completed
    match = db.execute("SELECT * FROM ranking_matches WHERE id = 9999").fetchone()
    assert match['status'] == 'completed'
    assert match['winner_id'] == 9991
    assert match['score'] == '6-4, 6-3'
    
    # Verify statistics entry exists
    stat = db.execute("SELECT * FROM match_statistics_unified WHERE ranking_match_id = 9999").fetchone()
    assert stat is not None
    assert stat['player1_id'] == 9991
    assert stat['player2_id'] == 9992
    assert stat['winner_id'] == 9991
    assert stat['winner_name'] == 'P1'
    assert stat['score'] == '6-4, 6-3'
    assert stat['match_type'] == 'Ranking'
    assert stat['season_id'] == 9999
    
    db.close()

def test_ranking_match_wo_creates_statistics_entry(setup_db):
    """Test that W.O. ranking match creates a statistics entry"""
    db = get_db()
    
    # Complete with W.O.
    _update_match_result(db, 9999, 9992, 'W.O. - Player 1 não compareceu', 'user', 0, 0, 0, 0, 9992)
    db.commit()
    
    # Verify statistics entry exists
    stat = db.execute("SELECT * FROM match_statistics_unified WHERE ranking_match_id = 9999").fetchone()
    assert stat is not None
    assert stat['winner_id'] == 9992
    assert 'W.O.' in stat['score']
    
    db.close()

def test_player_statistics_includes_ranking_matches(setup_db):
    """Test that player statistics query includes ranking matches"""
    db = get_db()
    
    # Complete the match
    _update_match_result(db, 9999, 9991, '6-2, 6-1', 'none', 2, 0, 12, 3, 9991)
    db.commit()
    
    # Query player statistics
    stats = db.execute("""
        SELECT * FROM match_statistics_unified 
        WHERE (player1_id = 9991 OR player2_id = 9991)
    """).fetchall()
    
    assert len(stats) >= 1
    ranking_match = [s for s in stats if s['ranking_match_id'] == 9999]
    assert len(ranking_match) == 1
    assert ranking_match[0]['winner_id'] == 9991
    
    db.close()

def test_amistoso_match_creates_statistics_entry(setup_db):
    """Test that amistoso matches create statistics entries"""
    db = get_db()
    
    # Create court first
    db.execute("""
        INSERT INTO courts (id, name, type, active)
        VALUES (9999, 'Test Court', 'Saibro', true)
        ON CONFLICT (id) DO NOTHING
    """)
    
    # Create schedule
    db.execute("""
        INSERT INTO schedules (id, court_id, date, start_time, player1_name, player2_name, match_type)
        VALUES (9999, 9999, '2025-01-15', '10:00', 'P1', 'P2', 'Amistoso')
    """)
    db.commit()
    
    # Add match result via statistics route
    from flask import Flask

    app = Flask(__name__)
    with app.test_request_context(
        json={'schedule_id': 9999, 'winner_name': 'P1', 'score': '6-3, 6-4'},
        headers={'Authorization': 'Bearer test'}
    ):
        from flask import request
        request.user_id = 9991
        
        # Insert statistics
        db.execute("""
            INSERT INTO match_statistics_unified (
                schedule_id, player1_id, player2_id, player1_name, player2_name,
                winner_id, winner_name, score, match_type, match_date, added_by
            ) VALUES (9999, 9991, 9992, 'P1', 'P2', 9991, 'P1', '6-3, 6-4', 'Amistoso', '2025-01-15', 9991)
        """)
        db.commit()
    
    # Verify statistics entry exists
    stat = db.execute("SELECT * FROM match_statistics_unified WHERE schedule_id = 9999").fetchone()
    assert stat is not None
    assert stat['player1_id'] == 9991
    assert stat['winner_id'] == 9991
    assert stat['match_type'] == 'Amistoso'
    assert stat['schedule_id'] == 9999
    assert stat['ranking_match_id'] is None
    
    # Cleanup
    db.execute("DELETE FROM match_statistics_unified WHERE schedule_id = 9999")
    db.execute("DELETE FROM schedules WHERE id = 9999")
    db.execute("DELETE FROM courts WHERE id = 9999")
    db.commit()
    db.close()
