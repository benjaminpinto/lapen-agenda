from flask import jsonify

def handler(request):
    """One-time migration endpoint - DELETE AFTER USE"""
    try:
        from src.database import get_db
        from src.services.points_calculator import PointsCalculator
        
        db = get_db()
        
        # Step 1: Link existing Liga schedules to ranking matches
        result = db.execute("""
            UPDATE ranking_matches
            SET schedule_id = subq.schedule_id
            FROM (
                SELECT rm.id as match_id, s.id as schedule_id
                FROM ranking_matches rm
                JOIN ranking_rounds rr ON rm.round_id = rr.id
                JOIN users u1 ON rm.player1_id = u1.id
                JOIN users u2 ON rm.player2_id = u2.id
                JOIN schedules s ON LOWER(TRIM(s.player1_name)) = LOWER(TRIM(u1.short_name))
                                AND LOWER(TRIM(s.player2_name)) = LOWER(TRIM(u2.short_name))
                WHERE rm.status = 'scheduled'
                  AND rm.schedule_id IS NULL
                  AND s.match_type = 'Liga'
                  AND s.deleted_at IS NULL
                  AND rr.status = 'open'
            ) subq
            WHERE ranking_matches.id = subq.match_id
        """)
        linked = result.rowcount if hasattr(result, 'rowcount') else 0
        
        # Step 2: Update ranking matches from statistics
        stats = db.execute("""
            SELECT ms.*, rm.id as ranking_match_id, rm.player1_id, rm.player2_id, rr.season_id
            FROM match_statistics_unified ms
            JOIN ranking_matches rm ON rm.schedule_id = ms.schedule_id
            JOIN ranking_rounds rr ON rm.round_id = rr.id
            WHERE rm.status = 'scheduled'
              AND ms.match_type IN ('Liga', 'Ranking')
              AND ms.ranking_match_id IS NULL
        """).fetchall()
        
        updated = 0
        for stat in stats:
            p1_sets, p2_sets, p1_games, p2_games = PointsCalculator.parse_score(stat['score'])
            winner_id = stat['winner_id']
            if not winner_id:
                continue
            
            match_result = {
                'wo_type': 'none',
                'sets_winner': max(p1_sets, p2_sets),
                'sets_loser': min(p1_sets, p2_sets),
                'games_winner': p1_games if winner_id == stat['player1_id'] else p2_games,
                'games_loser': p2_games if winner_id == stat['player1_id'] else p1_games
            }
            winner_points, loser_points = PointsCalculator.calculate(match_result, stat['season_id'])
            
            db.execute("""
                UPDATE ranking_matches
                SET status = 'completed', winner_id = %s, score = %s, 
                    sets_p1 = %s, sets_p2 = %s, games_p1 = %s, games_p2 = %s,
                    points_p1 = %s, points_p2 = %s, played_at = %s, added_by = %s
                WHERE id = %s
            """, (
                winner_id, stat['score'], p1_sets, p2_sets, p1_games, p2_games,
                winner_points if winner_id == stat['player1_id'] else loser_points,
                winner_points if winner_id == stat['player2_id'] else loser_points,
                stat['match_date'], stat['added_by'], stat['ranking_match_id']
            ))
            
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
            
            db.execute(
                "UPDATE match_statistics_unified SET ranking_match_id = %s, schedule_id = NULL WHERE id = %s",
                (stat['ranking_match_id'], stat['id'])
            )
            updated += 1
        
        db.commit()
        db.close()
        
        return jsonify({'success': True, 'linked': linked, 'updated': updated})
    except Exception as e:
        import traceback
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500
