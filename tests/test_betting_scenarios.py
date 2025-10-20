import unittest
from decimal import Decimal
from unittest.mock import Mock, patch
from src.utils.odds_calculator import calculate_odds, calculate_potential_return


class TestBettingScenarios(unittest.TestCase):
    """Integration tests for realistic betting scenarios"""
    
    @patch('src.utils.odds_calculator.get_db')
    def test_scenario_favorite_vs_underdog(self, mock_get_db):
        """Test realistic scenario: favorite gets 80% of bets"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        # Favorite gets 800, Underdog gets 200
        mock_cursor.fetchall.return_value = [
            {'player_name': 'Favorite', 'total_amount': 800.0},
            {'player_name': 'Underdog', 'total_amount': 200.0}
        ]
        
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = calculate_odds(1)
        
        # Total = 1000, Payout = 800
        # Favorite odds = 800/800 = 1.0x (break even)
        # Underdog odds = 800/200 = 4.0x
        self.assertEqual(result['odds']['Favorite'], 1.0)
        self.assertEqual(result['odds']['Underdog'], 4.0)
    
    @patch('src.utils.odds_calculator.get_db')
    def test_scenario_multiple_small_bets(self, mock_get_db):
        """Test scenario with many small bets"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        # Simulate 10 bets of 10 each on Player1, 5 bets of 20 each on Player2
        mock_cursor.fetchall.return_value = [
            {'player_name': 'Player1', 'total_amount': 100.0},  # 10 * 10
            {'player_name': 'Player2', 'total_amount': 100.0}   # 5 * 20
        ]
        
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = calculate_odds(1)
        
        # Should still be equal odds
        self.assertEqual(result['odds']['Player1'], 1.6)
        self.assertEqual(result['odds']['Player2'], 1.6)
    
    @patch('src.utils.odds_calculator.calculate_odds')
    def test_scenario_late_bet_changes_odds(self, mock_calculate_odds):
        """Test how a late large bet affects potential returns"""
        # Initial odds
        mock_calculate_odds.return_value = {
            'odds': {'Player1': 2.0, 'Player2': 2.0},
            'total_pool': 200.0,
            'payout_pool': 160.0
        }
        
        early_bet_return = calculate_potential_return(1, 'Player1', 50)
        self.assertEqual(early_bet_return, 100.0)  # 50 * 2.0
        
        # After large bet on Player1, odds change
        mock_calculate_odds.return_value = {
            'odds': {'Player1': 1.2, 'Player2': 4.0},
            'total_pool': 500.0,
            'payout_pool': 400.0
        }
        
        # Same bet now has different return
        new_return = calculate_potential_return(1, 'Player1', 50)
        self.assertEqual(new_return, 60.0)  # 50 * 1.2
    
    @patch('src.utils.odds_calculator.get_db')
    def test_scenario_minimum_bet(self, mock_get_db):
        """Test scenario with minimum bet amounts"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        # Very small bets
        mock_cursor.fetchall.return_value = [
            {'player_name': 'Player1', 'total_amount': 1.0},
            {'player_name': 'Player2', 'total_amount': 1.0}
        ]
        
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = calculate_odds(1)
        
        # Total = 2, Payout = 1.6
        # Each player odds = 1.6/1 = 1.6x
        self.assertEqual(result['odds']['Player1'], 1.6)
        self.assertEqual(result['odds']['Player2'], 1.6)
        self.assertEqual(result['total_pool'], 2.0)
    
    @patch('src.utils.odds_calculator.get_db')
    def test_scenario_large_pool(self, mock_get_db):
        """Test scenario with large betting pool"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        # Large pool: 5000 vs 5000
        mock_cursor.fetchall.return_value = [
            {'player_name': 'Player1', 'total_amount': 5000.0},
            {'player_name': 'Player2', 'total_amount': 5000.0}
        ]
        
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = calculate_odds(1)
        
        # Total = 10000, Payout = 8000
        # Odds = 8000/5000 = 1.6x
        self.assertEqual(result['odds']['Player1'], 1.6)
        self.assertEqual(result['odds']['Player2'], 1.6)
        self.assertEqual(result['total_pool'], 10000.0)
        self.assertEqual(result['payout_pool'], 8000.0)
    
    @patch('src.utils.odds_calculator.calculate_odds')
    def test_scenario_profit_calculation(self, mock_calculate_odds):
        """Test profit calculation for winning bet"""
        mock_calculate_odds.return_value = {
            'odds': {'Winner': 3.0, 'Loser': 1.2},
            'total_pool': 400.0,
            'payout_pool': 320.0
        }
        
        bet_amount = 100
        potential_return = calculate_potential_return(1, 'Winner', bet_amount)
        profit = potential_return - bet_amount
        
        self.assertEqual(potential_return, 300.0)  # 100 * 3.0
        self.assertEqual(profit, 200.0)  # Net profit
    
    @patch('src.utils.odds_calculator.get_db')
    def test_scenario_extreme_imbalance(self, mock_get_db):
        """Test extreme betting imbalance (95% vs 5%)"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        mock_cursor.fetchall.return_value = [
            {'player_name': 'Heavy Favorite', 'total_amount': 950.0},
            {'player_name': 'Underdog', 'total_amount': 50.0}
        ]
        
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = calculate_odds(1)
        
        # Total = 1000, Payout = 800
        # Favorite odds = 800/950 = 0.84x (losing bet)
        # Underdog odds = 800/50 = 16.0x
        self.assertLess(result['odds']['Heavy Favorite'], 1.0)
        self.assertEqual(result['odds']['Underdog'], 16.0)


if __name__ == '__main__':
    unittest.main()
