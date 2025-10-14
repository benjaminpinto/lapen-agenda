from src.database import get_db
from decimal import Decimal

def calculate_odds(match_id):
    """Calculate real-time odds based on bet distribution"""
    db = get_db()
    try:
        # Get total pool and betting stats
        cursor = db.execute('''
            SELECT player_name, SUM(amount) as total_amount
            FROM bets
            WHERE match_id = ? AND status = 'active'
            GROUP BY player_name
        ''', (match_id,))
        
        bet_stats = {}
        total_pool = Decimal('0')
        
        for row in cursor.fetchall():
            amount = Decimal(str(row['total_amount']))
            bet_stats[row['player_name']] = amount
            total_pool += amount
        
        if total_pool == 0:
            return {}
        
        # Apply 20% house edge
        payout_pool = total_pool * Decimal('0.8')
        
        odds = {}
        for player, player_bets in bet_stats.items():
            if player_bets > 0:
                # Odds = (total payout pool / player bets)
                player_odds = float(payout_pool / player_bets)
                odds[player] = round(player_odds, 2)
        
        return {
            'odds': odds,
            'total_pool': float(total_pool),
            'payout_pool': float(payout_pool)
        }
        
    except Exception:
        return {}
    finally:
        db.close()

def calculate_potential_return(match_id, player_name, bet_amount):
    """Calculate potential return for a specific bet"""
    odds_data = calculate_odds(match_id)
    
    if not odds_data or player_name not in odds_data['odds']:
        return 0
    
    player_odds = odds_data['odds'][player_name]
    return round(float(bet_amount) * player_odds, 2)