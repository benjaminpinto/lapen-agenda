import unittest
from decimal import Decimal
from unittest.mock import Mock, patch
from src.utils.odds_calculator import calculate_odds, calculate_potential_return


class TestOddsCalculator(unittest.TestCase):
    
    @patch('src.utils.odds_calculator.get_db')
    def test_calculate_odds_equal_bets(self, mock_get_db):
        """Test odds calculation with equal bets on both players"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        # Simulate equal bets: Player1 = 100, Player2 = 100
        mock_cursor.fetchall.return_value = [
            {'player_name': 'Player1', 'total_amount': 100.0},
            {'player_name': 'Player2', 'total_amount': 100.0}
        ]
        
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = calculate_odds(1)
        
        # Total pool = 200, Payout pool = 160 (80%)
        # Odds for each = 160/100 = 1.6x
        self.assertEqual(result['odds']['Player1'], 1.6)
        self.assertEqual(result['odds']['Player2'], 1.6)
        self.assertEqual(result['total_pool'], 200.0)
        self.assertEqual(result['payout_pool'], 160.0)
    
    @patch('src.utils.odds_calculator.get_db')
    def test_calculate_odds_unequal_bets(self, mock_get_db):
        """Test odds calculation with unequal bets"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        # Player1 = 150, Player2 = 50
        mock_cursor.fetchall.return_value = [
            {'player_name': 'Player1', 'total_amount': 150.0},
            {'player_name': 'Player2', 'total_amount': 50.0}
        ]
        
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = calculate_odds(1)
        
        # Total pool = 200, Payout pool = 160
        # Player1 odds = 160/150 = 1.07x
        # Player2 odds = 160/50 = 3.2x
        self.assertEqual(result['odds']['Player1'], 1.07)
        self.assertEqual(result['odds']['Player2'], 3.2)
        self.assertEqual(result['total_pool'], 200.0)
    
    @patch('src.utils.odds_calculator.get_db')
    def test_calculate_odds_single_player(self, mock_get_db):
        """Test odds calculation with only one player betting"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        mock_cursor.fetchall.return_value = [
            {'player_name': 'Player1', 'total_amount': 100.0}
        ]
        
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = calculate_odds(1)
        
        # Should return empty odds when only one player has bets
        self.assertEqual(result['odds'], {})
        self.assertEqual(result['total_pool'], 100.0)
        self.assertEqual(result['payout_pool'], 0)
    
    @patch('src.utils.odds_calculator.get_db')
    def test_calculate_odds_no_bets(self, mock_get_db):
        """Test odds calculation with no bets"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        mock_cursor.fetchall.return_value = []
        
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = calculate_odds(1)
        
        self.assertEqual(result, {})
    
    @patch('src.utils.odds_calculator.calculate_odds')
    def test_calculate_potential_return(self, mock_calculate_odds):
        """Test potential return calculation"""
        mock_calculate_odds.return_value = {
            'odds': {'Player1': 2.5, 'Player2': 1.5},
            'total_pool': 200.0,
            'payout_pool': 160.0
        }
        
        # Bet 50 on Player1 with 2.5x odds
        result = calculate_potential_return(1, 'Player1', 50)
        self.assertEqual(result, 125.0)  # 50 * 2.5
        
        # Bet 100 on Player2 with 1.5x odds
        result = calculate_potential_return(1, 'Player2', 100)
        self.assertEqual(result, 150.0)  # 100 * 1.5
    
    @patch('src.utils.odds_calculator.calculate_odds')
    def test_calculate_potential_return_no_odds(self, mock_calculate_odds):
        """Test potential return when player has no odds"""
        mock_calculate_odds.return_value = {
            'odds': {},
            'total_pool': 0,
            'payout_pool': 0
        }
        
        result = calculate_potential_return(1, 'Player1', 50)
        self.assertEqual(result, 0)
    
    @patch('src.utils.odds_calculator.get_db')
    def test_house_edge_calculation(self, mock_get_db):
        """Test that 20% house edge is correctly applied"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        mock_cursor.fetchall.return_value = [
            {'player_name': 'Player1', 'total_amount': 500.0},
            {'player_name': 'Player2', 'total_amount': 500.0}
        ]
        
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = calculate_odds(1)
        
        # Total pool = 1000, House takes 20%, Payout = 800
        self.assertEqual(result['total_pool'], 1000.0)
        self.assertEqual(result['payout_pool'], 800.0)
        self.assertEqual(result['payout_pool'], result['total_pool'] * 0.8)


if __name__ == '__main__':
    unittest.main()
