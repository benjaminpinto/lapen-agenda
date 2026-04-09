from src.database import get_db


class WOResolver:
    """Resolve W.O. disputes based on scheduling evidence"""
    
    @staticmethod
    def resolve(match_id):
        """Resolve W.O. based on scheduling logs"""
        db = get_db()
        
        match = db.execute('''
            SELECT rm.*, rr.season_id FROM ranking_matches rm
            JOIN ranking_rounds rr ON rm.round_id = rr.id
            WHERE rm.id = %s
        ''', (match_id,)).fetchone()
        
        if not match:
            raise ValueError("Match not found")
        
        logs = db.execute('''
            SELECT user_id, COUNT(*) as proposal_count
            FROM match_scheduling_logs
            WHERE match_id = %s
            GROUP BY user_id
        ''', (match_id,)).fetchall()
        
        if len(logs) < 2:
            raise ValueError("Insufficient scheduling evidence")
        
        player1_proposals = 0
        player2_proposals = 0
        for log in logs:
            if log['user_id'] == match['player1_id']:
                player1_proposals = log['proposal_count']
            elif log['user_id'] == match['player2_id']:
                player2_proposals = log['proposal_count']
        
        if player1_proposals > player2_proposals:
            winner_id = match['player1_id']
        elif player2_proposals > player1_proposals:
            winner_id = match['player2_id']
        else:
            raise ValueError("Equal proposals - manual resolution required")
        
        from src.routes.ranking import _update_match_result
        _update_match_result(db, match_id, winner_id, 'W.O. - Resolução administrativa', 'admin',
                           0, 0, 0, 0, None)
        db.commit()
        
        return winner_id
