from datetime import datetime, timedelta
from src.database import get_db

def is_match_eligible_for_betting(schedule_id):
    """Check if a match is eligible for betting (at least 1 hour before match)"""
    db = get_db()
    try:
        cursor = db.execute('''
            SELECT date, start_time FROM schedules 
            WHERE id = ?
        ''', (schedule_id,))
        
        schedule = cursor.fetchone()
        if not schedule:
            return False
        
        # Check if match is at least 1 hour in the future
        match_datetime = f"{schedule['date']} {schedule['start_time']}"
        match_time = datetime.strptime(match_datetime, '%Y-%m-%d %H:%M')
        cutoff_time = datetime.now() + timedelta(hours=1)
        
        return match_time > cutoff_time
        
    except Exception:
        return False
    finally:
        db.close()

def get_or_create_match(schedule_id):
    """Get existing match or create new one for a schedule"""
    db = get_db()
    try:
        # Check if match already exists
        cursor = db.execute('SELECT id FROM matches WHERE schedule_id = ?', (schedule_id,))
        existing_match = cursor.fetchone()
        
        if existing_match:
            return existing_match['id']
        
        # Create new match if eligible
        if not is_match_eligible_for_betting(schedule_id):
            return None
        
        cursor = db.execute('''
            INSERT INTO matches (schedule_id, status, betting_enabled, total_pool, house_edge)
            VALUES (?, 'upcoming', ?, 0.00, 0.20)
        ''', (schedule_id, True))
        
        db.commit()
        return cursor.lastrowid
        
    except Exception:
        return None
    finally:
        db.close()

def update_match_pool(match_id, amount):
    """Update the total pool amount for a match"""
    db = get_db()
    try:
        db.execute('''
            UPDATE matches 
            SET total_pool = total_pool + ? 
            WHERE id = ?
        ''', (amount, match_id))
        db.commit()
        return True
    except Exception:
        return False
    finally:
        db.close()