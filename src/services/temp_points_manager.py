from datetime import datetime
from src.database import get_db
from src.services.ranking_config import RankingConfigService

class TempPointsManager:
    """Manage temporary points expiry"""
    
    @staticmethod
    def check_expiry(season_id):
        """Check and expire temp points if needed"""
        config = RankingConfigService.get_config(season_id)
        expire_month = config['temp_points_expire_month']
        
        current_month = datetime.now().month
        if current_month >= expire_month:
            TempPointsManager.expire_temp_points(season_id)
    
    @staticmethod
    def expire_temp_points(season_id):
        """Remove temporary points from all participants"""
        db = get_db()
        db.execute('''
            UPDATE ranking_participants 
            SET temp_points = 0 
            WHERE season_id = %s
        ''', (season_id,))
        db.commit()