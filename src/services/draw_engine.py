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
            WHERE r.id = %s
        ''', (round_id,)).fetchone()
        
        if not round_info:
            raise ValueError("Rodada não encontrada")
        
        config = RankingConfigService.get_config(round_info['season_id'])
        elite_cutoff = config['elite_cutoff']
        challenger_cutoff = config['challenger_cutoff']
        
        # Get active participants ordered by position
        participants = db.execute('''
            SELECT rp.*, u.name FROM ranking_participants rp
            JOIN users u ON rp.user_id = u.id
            WHERE rp.season_id = %s AND rp.is_active = true AND u.lapen_approved = TRUE AND u.deleted_at IS NULL
            ORDER BY rp.position ASC
        ''', (round_info['season_id'],)).fetchall()
        
        if len(participants) < 2:
            raise ValueError("Participantes insuficientes para realizar o sorteio")
        
        # Split into Elite, Challenger, and Next Gen groups
        elite_players = participants[:elite_cutoff]
        challenger_players = participants[elite_cutoff:challenger_cutoff]
        nextgen_players = participants[challenger_cutoff:]
        
        # Generate matches for each group
        elite_matches = DrawEngine._generate_group_matches(elite_players, 'elite', round_id)
        challenger_matches = DrawEngine._generate_group_matches(challenger_players, 'challenger', round_id)
        nextgen_matches = DrawEngine._generate_group_matches(nextgen_players, 'nextgen', round_id)
        
        # Save matches to database
        all_matches = elite_matches + challenger_matches + nextgen_matches
        for match in all_matches:
            db.execute('''
                INSERT INTO ranking_matches (round_id, player1_id, player2_id, group_type)
                VALUES (%s, %s, %s, %s)
            ''', (round_id, match['player1_id'], match['player2_id'], match['group_type']))
            
            # Save draw history
            db.execute('''
                INSERT INTO ranking_draws (round_id, player1_id, player2_id, group_type)
                VALUES (%s, %s, %s, %s)
            ''', (round_id, match['player1_id'], match['player2_id'], match['group_type']))
        
        # Update round status
        db.execute('UPDATE ranking_rounds SET status = %s WHERE id = %s', ('drawn', round_id))
        db.commit()
        
        return all_matches
    
    @staticmethod
    def _generate_group_matches(players, group_type, round_id):
        """Generate 2 matches per player within a group"""
        if len(players) < 2:
            return []
        
        db = get_db()
        matches = []
        player_ids = [p['user_id'] for p in players]
        
        # Get recent pairings to avoid
        recent_pairings = db.execute('''
            SELECT player1_id, player2_id FROM ranking_draws
            WHERE round_id IN (
                SELECT id FROM ranking_rounds 
                WHERE season_id = (
                    SELECT season_id FROM ranking_rounds WHERE id = %s
                )
                AND round_number >= (
                    SELECT round_number - 2 FROM ranking_rounds WHERE id = %s
                )
            )
        ''', (round_id, round_id)).fetchall()
        
        recent_pairs = set()
        for pair in recent_pairings:
            recent_pairs.add((min(pair['player1_id'], pair['player2_id']), 
                            max(pair['player1_id'], pair['player2_id'])))
        
        # Track matches per player
        player_matches = {pid: 0 for pid in player_ids}
        used_pairs = set()
        
        # Generate matches ensuring even distribution
        max_attempts = len(player_ids) * 3
        attempts = 0
        
        while attempts < max_attempts:
            attempts += 1
            
            # Find player with fewest matches
            min_matches = min(player_matches.values())
            if min_matches >= 2:
                break
            
            candidates = [pid for pid in player_ids if player_matches[pid] == min_matches]
            random.shuffle(candidates)
            
            matched = False
            for player_id in candidates:
                if player_matches[player_id] >= 2:
                    continue
                
                # Find best opponent (prioritize those with fewer matches)
                opponents = [(pid, player_matches[pid]) for pid in player_ids 
                           if pid != player_id and player_matches[pid] < 2]
                opponents.sort(key=lambda x: x[1])
                
                for opponent_id, _ in opponents:
                    pair_key = (min(player_id, opponent_id), max(player_id, opponent_id))
                    if pair_key in used_pairs:
                        continue
                    
                    # Prefer non-recent opponents
                    if pair_key not in recent_pairs or min_matches >= 1:
                        matches.append({
                            'player1_id': player_id,
                            'player2_id': opponent_id,
                            'group_type': group_type
                        })
                        player_matches[player_id] += 1
                        player_matches[opponent_id] += 1
                        used_pairs.add(pair_key)
                        matched = True
                        break
                
                if matched:
                    break
            
            if not matched:
                break
        
        return matches