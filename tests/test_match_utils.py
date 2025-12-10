import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch
from src.utils.match_utils import is_match_eligible_for_betting, get_or_create_match, update_match_pool


class TestMatchUtils(unittest.TestCase):
    
    @patch('src.utils.match_utils.get_db')
    def test_match_eligible_more_than_1_hour(self, mock_get_db):
        """Test match is eligible when more than 1 hour away"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        # Match in 4 hours from now
        now = datetime.now(timezone.utc)
        match_time = now + timedelta(hours=4)
        
        mock_cursor.fetchone.return_value = {
            'date': match_time.date(),
            'start_time': match_time.time()
        }
        
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = is_match_eligible_for_betting(1)
        self.assertTrue(result)
    
    @patch('src.utils.match_utils.get_db')
    def test_match_not_eligible_less_than_1_hour(self, mock_get_db):
        """Test match is not eligible when less than 1 hour away"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        # Match in 30 minutes from now (in local time, which gets converted to UTC+3)
        # Function assumes local time is UTC-3 (Brazil), so it adds 3 hours
        now_utc = datetime.now(timezone.utc)
        # To have match in 30 min UTC time, we need local time to be 30min - 3h = -2h30min from now
        match_local = now_utc - timedelta(hours=2, minutes=30)
        
        mock_cursor.fetchone.return_value = {
            'date': match_local.date(),
            'start_time': match_local.time()
        }
        
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = is_match_eligible_for_betting(1)
        self.assertFalse(result)
    
    @patch('src.utils.match_utils.get_db')
    def test_match_not_found(self, mock_get_db):
        """Test when schedule doesn't exist"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        mock_cursor.fetchone.return_value = None
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = is_match_eligible_for_betting(999)
        self.assertFalse(result)
    
    @patch('src.utils.match_utils.get_db')
    def test_get_existing_match(self, mock_get_db):
        """Test getting an existing match"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        mock_cursor.fetchone.return_value = {'id': 5}
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = get_or_create_match(1)
        self.assertEqual(result, 5)
    
    @patch('src.utils.match_utils.is_match_eligible_for_betting')
    @patch('src.utils.match_utils.get_db')
    def test_create_new_match_eligible(self, mock_get_db, mock_eligible):
        """Test creating a new match when eligible"""
        mock_db = Mock()
        mock_cursor = Mock()
        mock_insert_cursor = Mock()
        
        # First call returns None (no existing match), second returns new ID
        mock_cursor.fetchone.return_value = None
        mock_insert_cursor.fetchone.return_value = {'id': 10}
        
        mock_db.execute.return_value = mock_cursor
        mock_db.cursor.return_value = mock_insert_cursor
        mock_insert_cursor.execute.return_value = None
        mock_get_db.return_value = mock_db
        mock_eligible.return_value = True
        
        result = get_or_create_match(1)
        self.assertEqual(result, 10)
    
    @patch('src.utils.match_utils.is_match_eligible_for_betting')
    @patch('src.utils.match_utils.get_db')
    def test_create_new_match_not_eligible(self, mock_get_db, mock_eligible):
        """Test creating a new match when not eligible"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        mock_cursor.fetchone.return_value = None
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        mock_eligible.return_value = False
        
        result = get_or_create_match(1)
        self.assertIsNone(result)
    
    @patch('src.utils.match_utils.get_db')
    def test_update_match_pool_add(self, mock_get_db):
        """Test adding to match pool"""
        mock_db = Mock()
        mock_get_db.return_value = mock_db
        
        result = update_match_pool(1, 50.0)
        self.assertTrue(result)
        mock_db.execute.assert_called_once()
        mock_db.commit.assert_called_once()
    
    @patch('src.utils.match_utils.get_db')
    def test_update_match_pool_subtract(self, mock_get_db):
        """Test subtracting from match pool (refund)"""
        mock_db = Mock()
        mock_get_db.return_value = mock_db
        
        result = update_match_pool(1, -50.0)
        self.assertTrue(result)
        mock_db.execute.assert_called_once()


if __name__ == '__main__':
    unittest.main()
