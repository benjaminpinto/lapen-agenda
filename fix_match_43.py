#!/usr/bin/env python3
"""Fix ranking match 43 with correct sets/games/points"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from src.database import get_db
from src.services.points_calculator import PointsCalculator

def fix_match_43():
    db = get_db()
    
    # Get match details
    match = db.execute('''
        SELECT rm.*, rr.season_id
        FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        WHERE rm.id = 43
    ''').fetchone()
    
    if not match:
        print("Match 43 not found")
        return
    
    print(f"Current state:")
    print(f"  Score: {match['score']}")
    print(f"  Winner: {match['winner_id']}")
    print(f"  Sets: {match['sets_p1']}-{match['sets_p2']}")
    print(f"  Games: {match['games_p1']}-{match['games_p2']}")
    print(f"  Points: {match['points_p1']}-{match['points_p2']}")
    
    # Parse score "0-6, 2-6"
    score = match['score']
    p1_sets, p2_sets, p1_games, p2_games = PointsCalculator.parse_score(score)
    
    print(f"\nParsed score:")
    print(f"  Sets: {p1_sets}-{p2_sets}")
    print(f"  Games: {p1_games}-{p2_games}")
    
    # Calculate points
    winner_id = match['winner_id']
    if winner_id == match['player1_id']:
        match_result = {
            'wo_type': 'none',
            'sets_winner': p1_sets,
            'sets_loser': p2_sets,
            'games_winner': p1_games,
            'games_loser': p2_games
        }
    else:
        match_result = {
            'wo_type': 'none',
            'sets_winner': p2_sets,
            'sets_loser': p1_sets,
            'games_winner': p2_games,
            'games_loser': p1_games
        }
    
    winner_points, loser_points = PointsCalculator.calculate(match_result, match['season_id'])
    points_p1 = winner_points if winner_id == match['player1_id'] else loser_points
    points_p2 = winner_points if winner_id == match['player2_id'] else loser_points
    
    print(f"\nCalculated points:")
    print(f"  Player 1: {points_p1}")
    print(f"  Player 2: {points_p2}")
    
    # Calculate point difference
    old_points_p1 = match['points_p1']
    old_points_p2 = match['points_p2']
    diff_p1 = points_p1 - old_points_p1
    diff_p2 = points_p2 - old_points_p2
    
    print(f"\nPoint adjustments needed:")
    print(f"  Player 1: {old_points_p1} -> {points_p1} (diff: {diff_p1:+d})")
    print(f"  Player 2: {old_points_p2} -> {points_p2} (diff: {diff_p2:+d})")
    
    # Update match
    db.execute('''
        UPDATE ranking_matches
        SET sets_p1 = %s, sets_p2 = %s, games_p1 = %s, games_p2 = %s,
            points_p1 = %s, points_p2 = %s
        WHERE id = 43
    ''', (p1_sets, p2_sets, p1_games, p2_games, points_p1, points_p2))
    
    # Update participant stats
    db.execute('''
        UPDATE ranking_participants
        SET total_points = total_points + %s,
            sets_won = sets_won + %s,
            sets_lost = sets_lost + %s,
            games_won = games_won + %s,
            games_lost = games_lost + %s
        WHERE season_id = %s AND user_id = %s
    ''', (diff_p1, p1_sets - match['sets_p1'], p2_sets - match['sets_p2'],
          p1_games - match['games_p1'], p2_games - match['games_p2'],
          match['season_id'], match['player1_id']))
    
    db.execute('''
        UPDATE ranking_participants
        SET total_points = total_points + %s,
            sets_won = sets_won + %s,
            sets_lost = sets_lost + %s,
            games_won = games_won + %s,
            games_lost = games_lost + %s
        WHERE season_id = %s AND user_id = %s
    ''', (diff_p2, p2_sets - match['sets_p2'], p1_sets - match['sets_p1'],
          p2_games - match['games_p2'], p1_games - match['games_p1'],
          match['season_id'], match['player2_id']))
    
    db.commit()
    print("\n✅ Match 43 fixed successfully!")
    
    # Show updated state
    updated_match = db.execute('SELECT * FROM ranking_matches WHERE id = 43').fetchone()
    print(f"\nUpdated state:")
    print(f"  Sets: {updated_match['sets_p1']}-{updated_match['sets_p2']}")
    print(f"  Games: {updated_match['games_p1']}-{updated_match['games_p2']}")
    print(f"  Points: {updated_match['points_p1']}-{updated_match['points_p2']}")
    
    db.close()

if __name__ == '__main__':
    fix_match_43()
