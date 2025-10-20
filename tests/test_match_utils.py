import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch
from src.utils.match_utils import is_match_eligible_for_betting, get_or_create_match, update_match_pool


class TestMatchUtils(unittest.TestCase):
    
    @patch('src.utils.match_utils.get_db')
    @patch('src.utils.match_utils.datetime')
    def test_match_eligible_more_than_1_hour(self, mock_datetime, mock_get_db):
        """Test match is eligible when more than 1 hour away"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        # Set current time
        now = datetime(2025, 10, 20, 10, 0, 0, tzinfo=timezone.utc)
        mock_datetime.now.return_value = now
        mock_datetime.strptime = datetime.strptime
        
        # Match at 14:00 (4 hours away)
        mock_cursor.fetchone.return_value = {
            'date': datetime(2025, 10, 20).date(),
            'start_time': datetime.strptime('14:00', '%H:%M').time()
        }
        
        mock_db.execute.return_value = mock_cursor
        mock_get_db.return_value = mock_db
        
        result = is_match_eligible_for_betting(1)
        self.assertTrue(result)
    
    @patch('src.utils.match_utils.get_db')
    @patch('src.utils.match_utils.datetime')
    def test_match_not_eligible_less_than_1_hour(self, mock_datetime, mock_get_db):
        """Test match is not eligible when less than 1 hour away"""
        mock_db = Mock()
        mock_cursor = Mock()
        
        now = datetime(2025, 10, 20, 13, 30, 0, tzinfo=timezone.utc)
        mock_datetime.now.return_value = now
        mock_datetime.strptime = datetime.strptime
        
        # Match at 14:00 (30 minutes away)
        mock_cursor.fetchone.return_value = {
            'date': datetime(2025, 10, 20).date(),
            'start_time': datetime.strptime('14:00', '%H:%M').time()
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
        
        # First call returns None (no existing match)
        # Second call returns the new match id
        mock_cursor.fetchone.return_value = None
        mock_cursor.lastrowid = 10
        
        mock_db.execute.return_value = mock_cursor
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
