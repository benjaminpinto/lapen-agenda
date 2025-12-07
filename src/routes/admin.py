from flask import Blueprint, request, jsonify
from src.database import get_db
from src.database_utils import get_month_comparison_sql
from src.logger import get_logger
from src.auth import verify_token, get_user_by_id
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

def require_admin_auth(f):
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Autenticação necessária'}), 401
        
        if token.startswith('Bearer '):
            token = token[7:]
        
        user_id = verify_token(token)
        if not user_id:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        
        user = get_user_by_id(user_id)
        if not user or not user.get('is_admin'):
            return jsonify({'error': 'Acesso negado'}), 403
        
        request.user_id = user_id
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

@admin_bp.route('/logout', methods=['POST'])
def logout():
    return jsonify({'success': True, 'message': 'Logout realizado com sucesso'})

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
        # Sanitize filename to prevent path traversal
        safe_name = ''.join(c for c in name if c.isalnum() or c in (' ', '_')).strip().replace(' ', '_').lower()
        image_filename = f"court_{safe_name}.jpg"
        image_path = os.path.join('src', 'static', 'images', image_filename)
        os.makedirs(os.path.dirname(image_path), exist_ok=True)
        
        try:
            image_bytes = base64.b64decode(image_data.split(',')[1])
            with open(image_path, 'wb') as f:
                f.write(image_bytes)
            image_url = f"/images/{image_filename}"
        except Exception as e:
            logger.error(f'Error saving image: {str(e)}')
            return jsonify({'success': False, 'message': 'Dados de imagem inválidos'}), 400
    
    db = get_db()
    try:
        db.execute(
            'INSERT INTO courts (name, type, description, active, image_url) VALUES (?, ?, ?, ?, ?)',
            (name, court_type, description, active, image_url)
        )
        db.commit()
        logger.info(f'Court created: {name}')
        return jsonify({'success': True, 'message': 'Quadra criada com sucesso'})
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
        # Sanitize filename to prevent path traversal
        safe_name = ''.join(c for c in name if c.isalnum() or c in (' ', '_')).strip().replace(' ', '_').lower()
        image_filename = f"court_{safe_name}.jpg"
        image_path = os.path.join('src', 'static', 'images', image_filename)
        os.makedirs(os.path.dirname(image_path), exist_ok=True)
        
        try:
            image_bytes = base64.b64decode(image_data.split(',')[1])
            with open(image_path, 'wb') as f:
                f.write(image_bytes)
            image_url = f"/images/{image_filename}"
        except Exception as e:
            logger.error(f'Error saving image: {str(e)}')
            return jsonify({'success': False, 'message': 'Dados de imagem inválidos'}), 400
    
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
        return jsonify({'success': True, 'message': 'Quadra atualizada com sucesso'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@admin_bp.route('/courts/<int:court_id>', methods=['DELETE'])
@require_admin_auth
def delete_court(court_id):
    db = get_db()
    try:
        db.execute('DELETE FROM courts WHERE id = ?', (court_id,))
        db.commit()
        return jsonify({'success': True, 'message': 'Quadra excluída com sucesso'})
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
        return jsonify({'success': True, 'message': 'Feriado/Bloqueio criado com sucesso'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@admin_bp.route('/holidays-blocks/<int:block_id>', methods=['DELETE'])
@require_admin_auth
def delete_holiday_block(block_id):
    db = get_db()
    try:
        db.execute('DELETE FROM holidays_blocks WHERE id = ?', (block_id,))
        db.commit()
        return jsonify({'success': True, 'message': 'Feriado/Bloqueio excluído com sucesso'})
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
        return jsonify({'success': True, 'message': 'Horário recorrente criado com sucesso'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@admin_bp.route('/recurring-schedules/<int:schedule_id>', methods=['DELETE'])
@require_admin_auth
def delete_recurring_schedule(schedule_id):
    db = get_db()
    try:
        db.execute('DELETE FROM recurring_schedules WHERE id = ?', (schedule_id,))
        db.commit()
        return jsonify({'success': True, 'message': 'Horário recorrente excluído com sucesso'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

# LAPEN Member Management
@admin_bp.route('/lapen-requests', methods=['GET'])
@require_admin_auth
def get_lapen_requests():
    """Get all pending LAPEN member requests"""
    db = get_db()
    status = request.args.get('status', 'pending')
    
    if status == 'pending':
        users = db.execute('''
            SELECT id, email, name, phone, lapen_requested_at
            FROM users
            WHERE is_lapen_member = ? AND lapen_approved = ? AND lapen_approved_at IS NULL
            ORDER BY lapen_requested_at DESC
        ''', (True, False)).fetchall()
    elif status == 'approved':
        users = db.execute('''
            SELECT id, email, name, phone, lapen_requested_at, lapen_approved_at
            FROM users
            WHERE is_lapen_member = ? AND lapen_approved = ?
            ORDER BY lapen_approved_at DESC
        ''', (True, True)).fetchall()
    elif status == 'rejected':
        users = db.execute('''
            SELECT id, email, name, phone, lapen_requested_at, lapen_approved_at
            FROM users
            WHERE is_lapen_member = ? AND lapen_approved = ? AND lapen_approved_at IS NOT NULL
            ORDER BY lapen_approved_at DESC
        ''', (True, False)).fetchall()
    else:
        users = db.execute('''
            SELECT id, email, name, phone, lapen_requested_at, lapen_approved_at, lapen_approved
            FROM users
            WHERE is_lapen_member = ?
            ORDER BY lapen_requested_at DESC
        ''', (True,)).fetchall()
    
    return jsonify([dict(user) for user in users])

@admin_bp.route('/lapen-approve/<int:user_id>', methods=['POST'])
@require_admin_auth
def approve_lapen_member(user_id):
    """Approve a LAPEN member request"""
    from src.email_service import send_lapen_approval_notification_email
    db = get_db()
    try:
        from datetime import datetime
        
        cursor = db.execute('SELECT email, name FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        
        db.execute('''
            UPDATE users
            SET lapen_approved = ?, lapen_approved_at = ?
            WHERE id = ? AND is_lapen_member = ?
        ''', (True, datetime.utcnow(), user_id, True))
        db.commit()
        
        if user:
            try:
                send_lapen_approval_notification_email(user['email'], user['name'])
                logger.info(f'Approval email sent to {user["email"]}')
            except Exception as e:
                logger.error(f'Failed to send approval email: {e}')
        
        logger.info(f'LAPEN member approved: user_id={user_id}')
        return jsonify({'success': True, 'message': 'Membro LAPEN aprovado com sucesso'})
    except Exception as e:
        logger.error(f'Error approving LAPEN member {user_id}: {str(e)}')
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()

@admin_bp.route('/lapen-reject/<int:user_id>', methods=['POST'])
@require_admin_auth
def reject_lapen_member(user_id):
    """Reject a LAPEN member request"""
    db = get_db()
    try:
        from datetime import datetime
        db.execute('''
            UPDATE users
            SET lapen_approved = ?, lapen_approved_at = ?
            WHERE id = ? AND is_lapen_member = ?
        ''', (False, datetime.utcnow(), user_id, True))
        db.commit()
        
        logger.info(f'LAPEN member rejected: user_id={user_id}')
        return jsonify({'success': True, 'message': 'Solicitação rejeitada'})
    except Exception as e:
        logger.error(f'Error rejecting LAPEN member {user_id}: {str(e)}')
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()

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
        WHERE {month_condition} AND s.deleted_at IS NULL
        GROUP BY c.id, c.name
        ORDER BY bookings DESC
        LIMIT 1
    ''').fetchone()
    
    # Total games by type this month
    month_condition = get_month_comparison_sql('date')
    game_stats = db.execute(f'''
        SELECT match_type, COUNT(*) as count
        FROM schedules
        WHERE {month_condition} AND deleted_at IS NULL
        GROUP BY match_type
    ''').fetchall()
    
    # Top players this month
    month_condition = get_month_comparison_sql('date')
    top_players = db.execute(f'''
        SELECT player_name, COUNT(*) as games
        FROM (
            SELECT player1_name as player_name FROM schedules WHERE {month_condition} AND deleted_at IS NULL
            UNION ALL
            SELECT player2_name as player_name FROM schedules WHERE {month_condition} AND deleted_at IS NULL
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