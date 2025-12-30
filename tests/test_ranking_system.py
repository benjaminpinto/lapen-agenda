import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.services.ranking_config import RankingConfigService
from src.services.points_calculator import PointsCalculator
from src.database import get_db
from src.auth import hash_password

@pytest.fixture
def setup_db():
    db = get_db()
    # Delete in correct order to avoid FK violations
    db.execute("DELETE FROM match_statistics_unified WHERE ranking_match_id IN (SELECT id FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)))")
    db.execute("DELETE FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025))")
    db.execute("DELETE FROM ranking_draws WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025))")
    db.execute("DELETE FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_season_config WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_temp_points_rules WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_participants WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_seasons WHERE year >= 2025")
    db.execute("DELETE FROM users WHERE email LIKE '%@ranktest.com'")
    db.commit()
    db.close()
    yield
    db = get_db()
    db.execute("DELETE FROM match_statistics_unified WHERE ranking_match_id IN (SELECT id FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)))")
    db.execute("DELETE FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025))")
    db.execute("DELETE FROM ranking_draws WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025))")
    db.execute("DELETE FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_season_config WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_temp_points_rules WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_participants WHERE season_id IN (SELECT id FROM ranking_seasons WHERE year >= 2025)")
    db.execute("DELETE FROM ranking_seasons WHERE year >= 2025")
    db.execute("DELETE FROM users WHERE email LIKE '%@ranktest.com'")
    db.commit()
    db.close()

def create_test_season():
    db = get_db()
    cursor = db.execute(
        'INSERT INTO ranking_seasons (year, start_date, end_date, description, status) VALUES (%s, %s, %s, %s, %s) RETURNING id',
        (2025, '2025-01-01', '2025-12-31', 'Test Season', 'active')
    )
    season_id = cursor.fetchone()['id']
    RankingConfigService.set_config(season_id, RankingConfigService.DEFAULT_CONFIG, db)
    db.commit()
    db.close()
    return season_id

def create_admin_user(client):
    db = get_db()
    password_hash = hash_password('admin123')
    cursor = db.execute('''
        INSERT INTO users (email, password_hash, name, short_name, is_admin, is_lapen_member, lapen_approved, is_verified)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
    ''', ('admin@ranktest.com', password_hash, 'Admin', 'Admin', True, True, True, True))
    db.commit()
    db.close()
    
    client.post('/api/auth/login', json={
        'email': 'admin@ranktest.com',
        'password': 'admin123'
    })

def create_test_user(client):
    db = get_db()
    password_hash = hash_password('password123')
    cursor = db.execute('''
        INSERT INTO users (email, password_hash, name, short_name, is_verified)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    ''', ('user@ranktest.com', password_hash, 'Test User', 'TestUser', True))
    user_id = cursor.fetchone()['id']
    db.commit()
    db.close()
    return {'id': user_id, 'email': 'user@ranktest.com', 'name': 'Test User'}

class TestRankingConfig:
    def test_get_default_config(self, setup_db):
        """Test getting default configuration"""
        season_id = create_test_season()
        config = RankingConfigService.get_config(season_id)
        assert config['elite_cutoff'] == 8
        assert config['win_points'] == 100
        assert config['loss_points'] == 25
        assert config['wo_win_points'] == 132
        assert config['wo_loss_points'] == -30

    def test_set_custom_config(self, setup_db):
        """Test setting custom configuration"""
        season_id = create_test_season()
        custom_config = {'elite_cutoff': 10, 'win_points': 150}
        RankingConfigService.set_config(season_id, custom_config)
        
        config = RankingConfigService.get_config(season_id)
        assert config['elite_cutoff'] == 10
        assert config['win_points'] == 150
        assert config['loss_points'] == 25

    def test_config_data_types(self, setup_db):
        """Test configuration handles different data types"""
        season_id = create_test_season()
        config = RankingConfigService.get_config(season_id)
        assert isinstance(config['elite_cutoff'], int)
        assert isinstance(config['win_points'], int)

class TestPointsCalculator:
    def test_calculate_win_points(self, setup_db):
        """Test points calculation for a win"""
        season_id = create_test_season()
        match_result = {
            'wo_type': 'none',
            'sets_winner': 2,
            'sets_loser': 0,
            'games_winner': 12,
            'games_loser': 4
        }
        winner_points, loser_points = PointsCalculator.calculate(match_result, season_id)
        # Base: 100 + Sets: 2*10 + 0*(-10) + Games: 12*1 + 4*(-1) = 128
        assert winner_points == 128
        # Base: 25 + Sets: 0*10 + 2*(-10) + Games: 4*1 + 12*(-1) = -3
        assert loser_points == -3

    def test_calculate_wo_points(self, setup_db):
        """Test points calculation for W.O."""
        season_id = create_test_season()
        match_result = {'wo_type': 'admin'}
        winner_points, loser_points = PointsCalculator.calculate(match_result, season_id)
        assert winner_points == 132
        assert loser_points == -30

    def test_parse_score_two_sets(self, setup_db):
        """Test parsing a two-set score"""
        p1_sets, p2_sets, p1_games, p2_games = PointsCalculator.parse_score("6-4, 6-3")
        assert p1_sets == 2
        assert p2_sets == 0
        assert p1_games == 12
        assert p2_games == 7

    def test_parse_score_three_sets(self, setup_db):
        """Test parsing a three-set score with super tiebreak"""
        p1_sets, p2_sets, p1_games, p2_games = PointsCalculator.parse_score("6-4, 4-6, 10-8")
        # Third set is super tiebreak, doesn't count as a set
        assert p1_sets == 1
        assert p2_sets == 1
        assert p1_games == 20
        assert p2_games == 18

    def test_parse_score_invalid(self, setup_db):
        """Test parsing invalid score returns zeros"""
        p1_sets, p2_sets, p1_games, p2_games = PointsCalculator.parse_score("invalid")
        assert p1_sets == 0
        assert p2_sets == 0
        assert p1_games == 0
        assert p2_games == 0

class TestRankingSeasons:
    def test_create_season(self, setup_db):
        """Test creating a new season"""
        from main import app
        with app.test_client() as client:
            create_admin_user(client)
            response = client.post('/api/ranking/seasons', 
                json={
                    'year': 2026,
                    'start_date': '2026-01-01',
                    'end_date': '2026-12-31',
                    'description': 'Test'
                }
            )
            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True

    def test_get_seasons(self, setup_db):
        """Test getting all seasons"""
        from main import app
        create_test_season()
        with app.test_client() as client:
            response = client.get('/api/ranking/seasons')
            assert response.status_code == 200
            data = response.get_json()
            assert isinstance(data, list)
            assert len(data) > 0

class TestRankingParticipants:
    def test_add_participant(self, setup_db):
        """Test adding a participant to a season"""
        from main import app
        season_id = create_test_season()
        with app.test_client() as client:
            create_admin_user(client)
            test_user = create_test_user(client)
            response = client.post(f'/api/ranking/seasons/{season_id}/participants',
                json={'user_id': test_user['id']}
            )
            assert response.status_code == 200

class TestRankingLeaderboard:
    def test_get_leaderboard(self, setup_db):
        """Test getting leaderboard"""
        from main import app
        season_id = create_test_season()
        with app.test_client() as client:
            response = client.get(f'/api/ranking/leaderboard/{season_id}')
            assert response.status_code == 200
            data = response.get_json()
            assert isinstance(data, list)

    def test_get_leaderboard_by_group(self, setup_db):
        """Test getting leaderboard filtered by group"""
        from main import app
        season_id = create_test_season()
        with app.test_client() as client:
            response = client.get(f'/api/ranking/leaderboard/{season_id}?group=elite')
            assert response.status_code == 200
            data = response.get_json()
            assert isinstance(data, list)

    def test_get_leaderboard_invalid_season(self, setup_db):
        """Test getting leaderboard for non-existent season"""
        from main import app
        with app.test_client() as client:
            response = client.get('/api/ranking/leaderboard/99999')
            assert response.status_code == 404
