#!/usr/bin/env python3
"""
Test script for LAPEN Ranking System
Creates sample data to verify the ranking implementation works correctly.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.database import get_db
from src.services.ranking_config import RankingConfigService
from datetime import datetime, date

def create_test_season():
    """Create a test season for 2026"""
    db = get_db()
    
    # Create season
    cursor = db.execute('''
        INSERT INTO ranking_seasons (year, start_date, end_date, status)
        VALUES (?, ?, ?, ?)
    ''', (2026, '2026-01-01', '2026-12-31', 'active'))
    season_id = cursor.lastrowid
    
    # Set default configuration
    RankingConfigService.set_config(season_id, RankingConfigService.DEFAULT_CONFIG)
    
    # Create temp points rules
    temp_rules = [
        (1, 1, 200, "1º lugar anterior"),
        (2, 2, 180, "2º lugar anterior"),
        (3, 3, 160, "3º lugar anterior"),
        (4, 5, 140, "4º-5º lugar anterior"),
        (6, 8, 120, "6º-8º lugar anterior"),
        (9, 12, 100, "9º-12º lugar anterior"),
        (13, 16, 80, "13º-16º lugar anterior")
    ]
    
    for pos_min, pos_max, points, label in temp_rules:
        db.execute('''
            INSERT INTO ranking_temp_points_rules (season_id, position_min, position_max, points, label)
            VALUES (?, ?, ?, ?, ?)
        ''', (season_id, pos_min, pos_max, points, label))
    
    db.commit()
    print(f"✅ Created test season {2026} with ID {season_id}")
    return season_id

def create_test_participants(season_id):
    """Create test participants"""
    db = get_db()
    
    # Get some existing users (LAPEN members)
    users = db.execute('''
        SELECT id, name FROM users 
        WHERE is_lapen_member = ? AND lapen_approved = ?
        LIMIT 16
    ''', (True, True)).fetchall()
    
    if len(users) < 4:
        print("❌ Need at least 4 LAPEN members to test ranking system")
        return []
    
    participants = []
    for i, user in enumerate(users):
        # Assign temp points based on position
        temp_points = RankingConfigService.get_temp_points_for_position(season_id, i + 1)
        
        db.execute('''
            INSERT INTO ranking_participants (season_id, user_id, temp_points, position)
            VALUES (?, ?, ?, ?)
        ''', (season_id, user['id'], temp_points, i + 1))
        
        participants.append({
            'user_id': user['id'],
            'name': user['name'],
            'position': i + 1,
            'temp_points': temp_points
        })
    
    db.commit()
    print(f"✅ Created {len(participants)} test participants")
    return participants

def create_test_round(season_id):
    """Create a test round"""
    db = get_db()
    
    cursor = db.execute('''
        INSERT INTO ranking_rounds (season_id, round_number, month, year, status)
        VALUES (?, ?, ?, ?, ?)
    ''', (season_id, 1, 1, 2026, 'pending'))
    round_id = cursor.lastrowid
    
    db.commit()
    print(f"✅ Created test round with ID {round_id}")
    return round_id

def test_draw_generation(round_id):
    """Test the draw generation"""
    from src.services.draw_engine import DrawEngine
    
    try:
        matches = DrawEngine.generate_draw(round_id)
        print(f"✅ Generated {len(matches)} matches for round {round_id}")
        
        # Display matches
        db = get_db()
        for match in matches:
            p1 = db.execute('SELECT name FROM users WHERE id = ?', (match['player1_id'],)).fetchone()
            p2 = db.execute('SELECT name FROM users WHERE id = ?', (match['player2_id'],)).fetchone()
            print(f"  {match['group_type']}: {p1['name']} vs {p2['name']}")
        
        return matches
    except Exception as e:
        print(f"❌ Error generating draw: {e}")
        return []

def test_match_result():
    """Test match result submission"""
    from src.services.points_calculator import PointsCalculator
    
    # Test score parsing
    score = "6-4, 6-3"
    p1_sets, p2_sets, p1_games, p2_games = PointsCalculator.parse_score(score)
    print(f"✅ Score parsing: {score} -> P1: {p1_sets} sets, {p1_games} games | P2: {p2_sets} sets, {p2_games} games")
    
    # Test points calculation
    match_result = {
        'wo_type': 'none',
        'sets_winner': p1_sets,
        'sets_loser': p2_sets,
        'games_winner': p1_games,
        'games_loser': p2_games
    }
    
    # Use default config for calculation
    season_id = 1  # Assuming first season
    winner_points, loser_points = PointsCalculator.calculate(match_result, season_id)
    print(f"✅ Points calculation: Winner: {winner_points}, Loser: {loser_points}")

def main():
    """Run all tests"""
    print("🎾 Testing LAPEN Ranking System")
    print("=" * 40)
    
    try:
        # Initialize database
        from src.database import init_db
        init_db()
        print("✅ Database initialized")
        
        # Create test season
        season_id = create_test_season()
        
        # Create test participants
        participants = create_test_participants(season_id)
        if not participants:
            return
        
        # Create test round
        round_id = create_test_round(season_id)
        
        # Test draw generation
        matches = test_draw_generation(round_id)
        
        # Test match result calculation
        test_match_result()
        
        print("\n✅ All ranking system tests completed successfully!")
        print(f"🌐 Visit http://localhost:5173/ranking to see the leaderboard")
        print(f"🔧 Visit http://localhost:5173/admin/ranking to manage seasons")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()