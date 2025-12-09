from src.database import get_db

class RankingConfigService:
    """Service for managing year-specific ranking configuration"""
    
    DEFAULT_CONFIG = {
        'elite_cutoff': 8,
        'matches_per_round': 2,
        'win_points': 100,
        'loss_points': 25,
        'wo_win_points': 132,
        'wo_loss_points': -30,
        'set_win_points': 10,
        'set_loss_points': -10,
        'game_win_points': 1,
        'game_loss_points': -1,
        'temp_points_expire_month': 3,
        'regular_rounds': 10,
        'finals_month': 11
    }
    
    @staticmethod
    def get_config(season_id):
        """Get configuration for a season with defaults"""
        db = get_db()
        config_rows = db.execute(
            'SELECT key, value, data_type FROM ranking_season_config WHERE season_id = %s',
            (season_id,)
        ).fetchall()
        
        config = {}
        for row in config_rows:
            value = row['value']
            if row['data_type'] == 'int':
                value = int(value)
            elif row['data_type'] == 'float':
                value = float(value)
            elif row['data_type'] == 'boolean':
                value = value.lower() == 'true'
            config[row['key']] = value
        
        # Fill in defaults for missing keys
        for key, default_value in RankingConfigService.DEFAULT_CONFIG.items():
            if key not in config:
                config[key] = default_value
        
        return config
    
    @staticmethod
    def set_config(season_id, config_dict, db=None):
        """Set configuration for a season"""
        should_close = False
        if db is None:
            db = get_db()
            should_close = True
        
        for key, value in config_dict.items():
            data_type = 'string'
            if isinstance(value, int):
                data_type = 'int'
            elif isinstance(value, float):
                data_type = 'float'
            elif isinstance(value, bool):
                data_type = 'boolean'
                value = str(value).lower()
            
            # Use INSERT ... ON CONFLICT for PostgreSQL compatibility
            db.execute('''
                INSERT INTO ranking_season_config (season_id, key, value, data_type)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (season_id, key) DO UPDATE SET value = %s, data_type = %s
            ''', (season_id, key, str(value), data_type, str(value), data_type))
        
        if should_close:
            db.commit()
            db.close()
    
    @staticmethod
    def get_temp_points_for_position(season_id, position):
        """Get temporary points for a position based on rules"""
        db = get_db()
        rule = db.execute('''
            SELECT points FROM ranking_temp_points_rules
            WHERE season_id = %s AND position_min <= %s AND position_max >= %s
            ORDER BY position_min
            LIMIT 1
        ''', (season_id, position, position)).fetchone()
        
        return rule['points'] if rule else 0