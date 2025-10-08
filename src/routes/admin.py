from flask import Blueprint, request, jsonify, session
from src.database import get_db
from src.database_utils import get_month_comparison_sql
from src.logger import get_logger
import base64
import os

logger = get_logger()

def normalize_time(time_value):
    """Convert time to string format for comparison"""
    if isinstance(time_value, str):
        return time_value
    elif hasattr(time_value, 'strftime'):
        return time_value.strftime('%H:%M')
    return str(time_value)

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

ADMIN_PASSWORD = 'PTCadmin2025'

@admin_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    password = data.get('password')
    
    if password == ADMIN_PASSWORD:
        session['admin_authenticated'] = True
        logger.info('Admin login successful')
        return jsonify({'success': True, 'message': 'Login successful'})
    else:
        logger.warning('Admin login failed - invalid password')
        return jsonify({'success': False, 'message': 'Invalid password'}), 401

@admin_bp.route('/logout', methods=['POST'])
def logout():
    session.pop('admin_authenticated', None)
    return jsonify({'success': True, 'message': 'Logout successful'})

def require_admin_auth(f):
    def decorated_function(*args, **kwargs):
        if not session.get('admin_authenticated'):
            return jsonify({'error': 'Admin authentication required'}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

@admin_bp.route('/verify-password', methods=['POST'])
@require_admin_auth
def verify_password():
    data = request.get_json()
    password = data.get('password')
    
    if password == ADMIN_PASSWORD:
        return jsonify({'success': True})
    else:
        return jsonify({'success': False, 'message': 'Invalid password'}), 401

# Courts CRUD
@admin_bp.route('/courts', methods=['GET'])
@require_admin_auth
def get_courts():
    db = get_db()
    courts = db.execute('SELECT * FROM courts').fetchall()
    return jsonify([dict(court) for court in courts])

@admin_bp.route('/courts', methods=['POST'])
@require_admin_auth
def create_court():
    data = request.get_json()
    name = data.get('name')
    court_type = data.get('type')
    description = data.get('description', '')
    active = data.get('active', True)
    image_data = data.get('image')
    
    image_url = None
    if image_data:
        # Save image to static folder
        image_filename = f"court_{name.replace(' ', '_').lower()}.jpg"
        image_path = f"src/static/images/{image_filename}"
        os.makedirs(os.path.dirname(image_path), exist_ok=True)
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data.split(',')[1])
        with open(image_path, 'wb') as f:
            f.write(image_bytes)
        image_url = f"/images/{image_filename}"
    
    db = get_db()
    try:
        db.execute(
            'INSERT INTO courts (name, type, description, active, image_url) VALUES (?, ?, ?, ?, ?)',
            (name, court_type, description, active, image_url)
        )
        db.commit()
        logger.info(f'Court created: {name}')
        return jsonify({'success': True, 'message': 'Court created successfully'})
    except Exception as e:
        logger.error(f'Error creating court {name}: {str(e)}')
        return jsonify({'success': False, 'message': str(e)}), 400

@admin_bp.route('/courts/<int:court_id>', methods=['PUT'])
@require_admin_auth
def update_court(court_id):
    data = request.get_json()
    name = data.get('name')
    court_type = data.get('type')
    description = data.get('description', '')
    active = data.get('active', True)
    image_data = data.get('image')
    
    image_url = None
    if image_data:
        # Save image to static folder
        image_filename = f"court_{name.replace(' ', '_').lower()}.jpg"
        image_path = f"src/static/images/{image_filename}"
        os.makedirs(os.path.dirname(image_path), exist_ok=True)
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data.split(',')[1])
        with open(image_path, 'wb') as f:
            f.write(image_bytes)
        image_url = f"/images/{image_filename}"
    
    db = get_db()
    try:
        if image_url:
            db.execute(
                'UPDATE courts SET name = ?, type = ?, description = ?, active = ?, image_url = ? WHERE id = ?',
                (name, court_type, description, active, image_url, court_id)
            )
        else:
            db.execute(
                'UPDATE courts SET name = ?, type = ?, description = ?, active = ? WHERE id = ?',
                (name, court_type, description, active, court_id)
            )
        db.commit()
        return jsonify({'success': True, 'message': 'Court updated successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@admin_bp.route('/courts/<int:court_id>', methods=['DELETE'])
@require_admin_auth
def delete_court(court_id):
    db = get_db()
    try:
        db.execute('DELETE FROM courts WHERE id = ?', (court_id,))
        db.commit()
        return jsonify({'success': True, 'message': 'Court deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

# Players CRUD
@admin_bp.route('/players', methods=['GET'])
@require_admin_auth
def get_players():
    db = get_db()
    players = db.execute('SELECT * FROM players ORDER BY name').fetchall()
    return jsonify([dict(player) for player in players])

@admin_bp.route('/players', methods=['POST'])
@require_admin_auth
def create_player():
    data = request.get_json()
    name = data.get('name')
    
    db = get_db()
    try:
        db.execute('INSERT INTO players (name) VALUES (?)', (name,))
        db.commit()
        return jsonify({'success': True, 'message': 'Player added successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@admin_bp.route('/players/<int:player_id>', methods=['DELETE'])
@require_admin_auth
def delete_player(player_id):
    db = get_db()
    try:
        db.execute('DELETE FROM players WHERE id = ?', (player_id,))
        db.commit()
        return jsonify({'success': True, 'message': 'Player deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

# Holidays/Blocks CRUD
@admin_bp.route('/holidays-blocks', methods=['GET'])
def get_holidays_blocks():
    db = get_db()
    blocks = db.execute('SELECT * FROM holidays_blocks ORDER BY date').fetchall()
    
    # Convert time/date objects to strings for JSON serialization
    serialized_blocks = []
    for block in blocks:
        block_dict = dict(block)
        if 'start_time' in block_dict and block_dict['start_time']:
            block_dict['start_time'] = normalize_time(block_dict['start_time'])
        if 'end_time' in block_dict and block_dict['end_time']:
            block_dict['end_time'] = normalize_time(block_dict['end_time'])
        if 'date' in block_dict and not isinstance(block_dict['date'], str):
            block_dict['date'] = block_dict['date'].strftime('%Y-%m-%d')
        serialized_blocks.append(block_dict)
    return jsonify(serialized_blocks)

@admin_bp.route('/holidays-blocks', methods=['POST'])
@require_admin_auth
def create_holiday_block():
    data = request.get_json()
    date = data.get('date')
    start_time = data.get('start_time') or None
    end_time = data.get('end_time') or None
    description = data.get('description', '')
    
    # Convert empty strings to None for time fields
    if start_time == '':
        start_time = None
    if end_time == '':
        end_time = None
    
    db = get_db()
    try:
        db.execute(
            'INSERT INTO holidays_blocks (date, start_time, end_time, description) VALUES (?, ?, ?, ?)',
            (date, start_time, end_time, description)
        )
        db.commit()
        return jsonify({'success': True, 'message': 'Holiday/Block created successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@admin_bp.route('/holidays-blocks/<int:block_id>', methods=['DELETE'])
@require_admin_auth
def delete_holiday_block(block_id):
    db = get_db()
    try:
        db.execute('DELETE FROM holidays_blocks WHERE id = ?', (block_id,))
        db.commit()
        return jsonify({'success': True, 'message': 'Holiday/Block deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

# Recurring Schedules CRUD
@admin_bp.route('/recurring-schedules', methods=['GET'])
def get_recurring_schedules():
    db = get_db()
    schedules = db.execute('''
        SELECT rs.*, c.name as court_name 
        FROM recurring_schedules rs 
        JOIN courts c ON rs.court_id = c.id 
        ORDER BY rs.start_date
    ''').fetchall()
    
    # Convert time/date objects to strings for JSON serialization
    serialized_schedules = []
    for schedule in schedules:
        schedule_dict = dict(schedule)
        if 'start_time' in schedule_dict:
            schedule_dict['start_time'] = normalize_time(schedule_dict['start_time'])
        if 'end_time' in schedule_dict:
            schedule_dict['end_time'] = normalize_time(schedule_dict['end_time'])
        if 'start_date' in schedule_dict and not isinstance(schedule_dict['start_date'], str):
            schedule_dict['start_date'] = schedule_dict['start_date'].strftime('%Y-%m-%d')
        if 'end_date' in schedule_dict and not isinstance(schedule_dict['end_date'], str):
            schedule_dict['end_date'] = schedule_dict['end_date'].strftime('%Y-%m-%d')
        serialized_schedules.append(schedule_dict)
    return jsonify(serialized_schedules)

@admin_bp.route('/recurring-schedules', methods=['POST'])
@require_admin_auth
def create_recurring_schedule():
    data = request.get_json()
    court_id = data.get('court_id')
    days_of_week = data.get('days_of_week')  # List of integers
    times = data.get('times')  # List of time strings
    description = data.get('description', '')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    
    db = get_db()
    try:
        for day in days_of_week:
            for time_slot in times:
                start_time = time_slot
                # Calculate end time (1.5 hours later)
                hour, minute = map(int, start_time.split(':'))
                end_hour = hour + 1
                end_minute = minute + 30
                if end_minute >= 60:
                    end_hour += 1
                    end_minute -= 60
                end_time = f"{end_hour:02d}:{end_minute:02d}"
                
                db.execute(
                    'INSERT INTO recurring_schedules (court_id, day_of_week, start_time, end_time, description, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    (court_id, day, start_time, end_time, description, start_date, end_date)
                )
        db.commit()
        return jsonify({'success': True, 'message': 'Recurring schedule created successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@admin_bp.route('/recurring-schedules/<int:schedule_id>', methods=['DELETE'])
@require_admin_auth
def delete_recurring_schedule(schedule_id):
    db = get_db()
    try:
        db.execute('DELETE FROM recurring_schedules WHERE id = ?', (schedule_id,))
        db.commit()
        return jsonify({'success': True, 'message': 'Recurring schedule deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

# Dashboard statistics
@admin_bp.route('/dashboard', methods=['GET'])
@require_admin_auth
def get_dashboard_stats():
    db = get_db()
    
    # Most booked court this month
    month_condition = get_month_comparison_sql('s.date')
    most_booked_court = db.execute(f'''
        SELECT c.name, COUNT(*) as bookings
        FROM schedules s
        JOIN courts c ON s.court_id = c.id
        WHERE {month_condition}
        GROUP BY c.id, c.name
        ORDER BY bookings DESC
        LIMIT 1
    ''').fetchone()
    
    # Total games by type this month
    month_condition = get_month_comparison_sql('date')
    game_stats = db.execute(f'''
        SELECT match_type, COUNT(*) as count
        FROM schedules
        WHERE {month_condition}
        GROUP BY match_type
    ''').fetchall()
    
    # Top players this month
    month_condition = get_month_comparison_sql('date')
    top_players = db.execute(f'''
        SELECT player_name, COUNT(*) as games
        FROM (
            SELECT player1_name as player_name FROM schedules WHERE {month_condition}
            UNION ALL
            SELECT player2_name as player_name FROM schedules WHERE {month_condition}
        )
        GROUP BY player_name
        ORDER BY games DESC
        LIMIT 5
    ''').fetchall()
    
    return jsonify({
        'most_booked_court': dict(most_booked_court) if most_booked_court else None,
        'game_stats': [dict(stat) for stat in game_stats],
        'top_players': [dict(player) for player in top_players]
    })