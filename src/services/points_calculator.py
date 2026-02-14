from src.services.ranking_config import RankingConfigService

class PointsCalculator:
    """Calculate points for ranking matches based on season configuration"""
    
    @staticmethod
    def calculate(match_result, season_id):
        """Calculate points for both players based on match result"""
        config = RankingConfigService.get_config(season_id)
        
        if match_result['wo_type'] in ['admin', 'forfeit', 'user']:
            # W.O. points
            winner_points = config['wo_win_points']
            loser_points = config['wo_loss_points']
        else:
            # Regular match points
            winner_points = config['win_points']
            loser_points = config['loss_points']
            
            # Add set points
            winner_sets = match_result['sets_winner']
            loser_sets = match_result['sets_loser']
            winner_points += winner_sets * config['set_win_points']
            winner_points += loser_sets * config['set_loss_points']
            loser_points += loser_sets * config['set_win_points']
            loser_points += winner_sets * config['set_loss_points']
            
            # Add game points
            winner_games = match_result['games_winner']
            loser_games = match_result['games_loser']
            winner_points += winner_games * config['game_win_points']
            winner_points += loser_games * config['game_loss_points']
            loser_points += loser_games * config['game_win_points']
            loser_points += winner_games * config['game_loss_points']
        
        return winner_points, loser_points
    
    @staticmethod
    def parse_score(score_str):
        """Parse score string like '6-4, 6-3' or '6-4, 4-6, 10-8' (super tiebreak)"""
        if not score_str:
            return 0, 0, 0, 0
        
        sets = score_str.split(', ')
        p1_sets = p2_sets = p1_games = p2_games = 0
        
        for idx, set_score in enumerate(sets):
            try:
                games = set_score.split('-')
                g1, g2 = int(games[0]), int(games[1])
                
                # Add games
                p1_games += g1
                p2_games += g2
                
                # Count sets (all sets including super tiebreak)
                if g1 > g2:
                    p1_sets += 1
                else:
                    p2_sets += 1
            except (ValueError, IndexError):
                continue
        
        return p1_sets, p2_sets, p1_games, p2_games