from src.database import get_db
from src.services.points_calculator import PointsCalculator

class WOResolver:
    """Resolve W.O. disputes based on scheduling evidence"""
    
    @staticmethod
    def resolve(match_id):
        """Resolve W.O. based on scheduling logs"""
        db = get_db()
        
        # Get match details
        match = db.execute('''
            SELECT rm.*, rr.season_id FROM ranking_matches rm
            JOIN ranking_rounds rr ON rm.round_id = rr.id
            WHERE rm.id = ?
        ''', (match_id,)).fetchone()
        
        if not match:
            raise ValueError("Match not found")
        
        # Get scheduling logs
        logs = db.execute('''
            SELECT user_id, COUNT(*) as proposal_count
            FROM match_scheduling_logs
            WHERE match_id = ?
            GROUP BY user_id
        ''', (match_id,)).fetchall()
        
        if len(logs) < 2:
            raise ValueError("Insufficient scheduling evidence")
        
        # Determine winner based on proposals
        player1_proposals = 0
        player2_proposals = 0
        
        for log in logs:
            if log['user_id'] == match['player1_id']:
                player1_proposals = log['proposal_count']
            elif log['user_id'] == match['player2_id']:
                player2_proposals = log['proposal_count']
        
        # Winner is player with more proposals
        if player1_proposals > player2_proposals:
            winner_id = match['player1_id']
        elif player2_proposals > player1_proposals:
            winner_id = match['player2_id']
        else:
            raise ValueError("Equal proposals - manual resolution required")
        
        # Calculate W.O. points
        match_result = {'wo_type': 'admin'}
        winner_points, loser_points = PointsCalculator.calculate(match_result, match['season_id'])
        
        points_p1 = winner_points if winner_id == match['player1_id'] else loser_points
        points_p2 = winner_points if winner_id == match['player2_id'] else loser_points
        
        # Update match
        db.execute('''
            UPDATE ranking_matches
            SET status = ?, winner_id = ?, wo_type = ?, points_p1 = ?, points_p2 = ?
            WHERE id = ?
        ''', ('wo', winner_id, 'admin', points_p1, points_p2, match_id))
        
        # Update participant stats
        for player_id, is_winner, points in [
            (match['player1_id'], winner_id == match['player1_id'], points_p1),
            (match['player2_id'], winner_id == match['player2_id'], points_p2)
        ]:
            wo_field = 'wo_wins' if is_winner else 'wo_losses'
            db.execute(f'''
                UPDATE ranking_participants
                SET total_points = total_points + ?, {wo_field} = {wo_field} + 1
                WHERE season_id = ? AND user_id = ?
            ''', (points, match['season_id'], player_id))
        
        db.commit()
        return winner_id