#!/usr/bin/env python3
"""
Retroactive Ranking-Schedule Integration Fix
Links existing Liga schedules to ranking matches and recalculates points
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from src.database import get_db
from src.services.points_calculator import PointsCalculator

def link_schedules_to_ranking_matches():
    """Link existing Liga schedules to ranking matches"""
    db = get_db()
    
    # Find unlinked ranking matches with matching schedules
    matches = db.execute("""
        SELECT rm.id as ranking_match_id, s.id as schedule_id, 
               rm.player1_id, rm.player2_id, rr.season_id
        FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        JOIN schedules s ON s.match_type = 'Liga' 
            AND s.deleted_at IS NULL
            AND s.player1_id IS NOT NULL 
            AND s.player2_id IS NOT NULL
            AND ((rm.player1_id = s.player1_id AND rm.player2_id = s.player2_id)
                OR (rm.player1_id = s.player2_id AND rm.player2_id = s.player1_id))
        WHERE rm.schedule_id IS NULL
          AND rm.status = 'scheduled'
          AND rr.status = 'open'
    """).fetchall()
    
    linked_count = 0
    for match in matches:
        db.execute(
            "UPDATE ranking_matches SET schedule_id = %s WHERE id = %s",
            (match['schedule_id'], match['ranking_match_id'])
        )
        linked_count += 1
    
    db.commit()
    print(f"✓ Linked {linked_count} schedules to ranking matches")
    return linked_count

def update_from_statistics():
    """Update ranking matches from existing statistics"""
    db = get_db()
    
    # Find statistics that should update ranking matches
    stats = db.execute("""
        SELECT ms.*, rm.id as ranking_match_id, rm.player1_id, rm.player2_id, 
               rr.season_id, rr.status as round_status
        FROM match_statistics_unified ms
        JOIN ranking_matches rm ON rm.schedule_id = ms.schedule_id
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        WHERE rm.status = 'scheduled'
          AND ms.match_type IN ('Liga', 'Ranking')
          AND ms.ranking_match_id IS NULL
    """).fetchall()
    
    updated_count = 0
    for stat in stats:
        # Parse score and calculate points
        p1_sets, p2_sets, p1_games, p2_games = PointsCalculator.parse_score(stat['score'])
        
        winner_id = stat['winner_id']
        if not winner_id:
            # Try to determine winner from name
            if stat['winner_name'] == stat['player1_name']:
                winner_id = stat['player1_id']
            elif stat['winner_name'] == stat['player2_name']:
                winner_id = stat['player2_id']
        
        if not winner_id:
            print(f"⚠ Skipping match {stat['ranking_match_id']}: Cannot determine winner")
            continue
        
        # Calculate points
        match_result = {
            'wo_type': 'none',
            'sets_winner': max(p1_sets, p2_sets),
            'sets_loser': min(p1_sets, p2_sets),
            'games_winner': p1_games if winner_id == stat['player1_id'] else p2_games,
            'games_loser': p2_games if winner_id == stat['player1_id'] else p1_games
        }
        winner_points, loser_points = PointsCalculator.calculate(match_result, stat['season_id'])
        
        # Update ranking match
        db.execute("""
            UPDATE ranking_matches
            SET status = 'completed', winner_id = %s, score = %s, 
                sets_p1 = %s, sets_p2 = %s, games_p1 = %s, games_p2 = %s,
                points_p1 = %s, points_p2 = %s, played_at = %s, added_by = %s
            WHERE id = %s
        """, (
            winner_id, stat['score'],
            p1_sets, p2_sets, p1_games, p2_games,
            winner_points if winner_id == stat['player1_id'] else loser_points,
            winner_points if winner_id == stat['player2_id'] else loser_points,
            stat['match_date'], stat['added_by'], stat['ranking_match_id']
        ))
        
        # Update participants
        for player_id, is_winner, sets_won, sets_lost, games_won, games_lost, points in [
            (stat['player1_id'], winner_id == stat['player1_id'], 
             p1_sets, p2_sets, p1_games, p2_games,
             winner_points if winner_id == stat['player1_id'] else loser_points),
            (stat['player2_id'], winner_id == stat['player2_id'], 
             p2_sets, p1_sets, p2_games, p1_games,
             winner_points if winner_id == stat['player2_id'] else loser_points)
        ]:
            db.execute("""
                UPDATE ranking_participants
                SET total_points = total_points + %s, wins = wins + %s, losses = losses + %s,
                    sets_won = sets_won + %s, sets_lost = sets_lost + %s,
                    games_won = games_won + %s, games_lost = games_lost + %s
                WHERE season_id = %s AND user_id = %s
            """, (points, 1 if is_winner else 0, 0 if is_winner else 1,
                  sets_won, sets_lost, games_won, games_lost, stat['season_id'], player_id))
        
        # Link statistics to ranking match (update existing entry)
        db.execute(
            "UPDATE match_statistics_unified SET ranking_match_id = %s, schedule_id = NULL WHERE id = %s",
            (stat['ranking_match_id'], stat['id'])
        )
        
        updated_count += 1
    
    db.commit()
    print(f"✓ Updated {updated_count} ranking matches from statistics")
    return updated_count

def recalculate_positions():
    """Recalculate positions for all active seasons"""
    db = get_db()
    
    seasons = db.execute("SELECT id FROM ranking_seasons WHERE status = 'active'").fetchall()
    
    for season in seasons:
        season_id = season['id']
        
        # Get participants sorted by points
        participants = db.execute("""
            SELECT user_id, (total_points + temp_points) as total,
                   wins, (sets_won - sets_lost) as set_diff, (games_won - games_lost) as game_diff
            FROM ranking_participants
            WHERE season_id = %s
            ORDER BY total DESC, wins DESC, set_diff DESC, game_diff DESC
        """, (season_id,)).fetchall()
        
        # Update positions
        for idx, participant in enumerate(participants):
            db.execute(
                "UPDATE ranking_participants SET position = %s WHERE season_id = %s AND user_id = %s",
                (idx + 1, season_id, participant['user_id'])
            )
        
        db.commit()
        print(f"✓ Recalculated positions for season {season_id}")

def main():
    print("Starting retroactive ranking-schedule integration fix...\n")
    
    try:
        # Step 1: Link schedules
        linked = link_schedules_to_ranking_matches()
        
        # Step 2: Update from statistics
        updated = update_from_statistics()
        
        # Step 3: Recalculate positions
        if updated > 0:
            recalculate_positions()
        
        print(f"\n✅ Migration complete!")
        print(f"   - {linked} schedules linked")
        print(f"   - {updated} matches updated from statistics")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
