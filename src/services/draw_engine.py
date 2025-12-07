import random
from src.database import get_db
from src.services.ranking_config import RankingConfigService

class DrawEngine:
    """Generate draws for ranking rounds"""
    
    @staticmethod
    def generate_draw(round_id):
        """Generate draw for a round"""
        db = get_db()
        
        # Get round and season info
        round_info = db.execute('''
            SELECT r.*, s.id as season_id FROM ranking_rounds r
            JOIN ranking_seasons s ON r.season_id = s.id
            WHERE r.id = ?
        ''', (round_id,)).fetchone()
        
        if not round_info:
            raise ValueError("Round not found")
        
        config = RankingConfigService.get_config(round_info['season_id'])
        elite_cutoff = config['elite_cutoff']
        
        # Get participants ordered by position
        participants = db.execute('''
            SELECT rp.*, u.name FROM ranking_participants rp
            JOIN users u ON rp.user_id = u.id
            WHERE rp.season_id = ?
            ORDER BY rp.position ASC
        ''', (round_info['season_id'],)).fetchall()
        
        if len(participants) < 2:
            raise ValueError("Not enough participants for draw")
        
        # Split into Elite and Challenger groups
        elite_players = participants[:elite_cutoff]
        challenger_players = participants[elite_cutoff:]
        
        # Generate matches for each group
        elite_matches = DrawEngine._generate_group_matches(elite_players, 'elite', round_id)
        challenger_matches = DrawEngine._generate_group_matches(challenger_players, 'challenger', round_id)
        
        # Save matches to database
        all_matches = elite_matches + challenger_matches
        for match in all_matches:
            db.execute('''
                INSERT INTO ranking_matches (round_id, player1_id, player2_id, group_type)
                VALUES (?, ?, ?, ?)
            ''', (round_id, match['player1_id'], match['player2_id'], match['group_type']))
            
            # Save draw history
            db.execute('''
                INSERT INTO ranking_draws (round_id, player1_id, player2_id, group_type)
                VALUES (?, ?, ?, ?)
            ''', (round_id, match['player1_id'], match['player2_id'], match['group_type']))
        
        # Update round status
        db.execute('UPDATE ranking_rounds SET status = ? WHERE id = ?', ('drawn', round_id))
        db.commit()
        
        return all_matches
    
    @staticmethod
    def _generate_group_matches(players, group_type, round_id):
        """Generate matches within a group avoiding recent pairings"""
        if len(players) < 2:
            return []
        
        db = get_db()
        matches = []
        
        # Get recent pairings to avoid
        recent_pairings = db.execute('''
            SELECT player1_id, player2_id FROM ranking_draws
            WHERE round_id IN (
                SELECT id FROM ranking_rounds 
                WHERE season_id = (
                    SELECT season_id FROM ranking_rounds WHERE id = ?
                )
                AND round_number >= (
                    SELECT round_number - 2 FROM ranking_rounds WHERE id = ?
                )
            )
        ''', (round_id, round_id)).fetchall()
        
        recent_pairs = set()
        for pair in recent_pairings:
            recent_pairs.add((min(pair['player1_id'], pair['player2_id']), 
                            max(pair['player1_id'], pair['player2_id'])))
        
        # Simple pairing algorithm
        available_players = list(players)
        random.shuffle(available_players)
        
        while len(available_players) >= 2:
            player1 = available_players.pop(0)
            best_opponent = None
            
            # Find best opponent (not recently played)
            for i, player2 in enumerate(available_players):
                pair_key = (min(player1['user_id'], player2['user_id']), 
                           max(player1['user_id'], player2['user_id']))
                
                if pair_key not in recent_pairs:
                    best_opponent = available_players.pop(i)
                    break
            
            # If no fresh opponent, take first available
            if not best_opponent and available_players:
                best_opponent = available_players.pop(0)
            
            if best_opponent:
                matches.append({
                    'player1_id': player1['user_id'],
                    'player2_id': best_opponent['user_id'],
                    'group_type': group_type
                })
        
        return matches