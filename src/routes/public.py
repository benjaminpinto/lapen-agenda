from flask import Blueprint, request, jsonify
from src.database import get_db
from datetime import datetime, timedelta
import calendar

public_bp = Blueprint('public', __name__, url_prefix='/api/public')

def generate_time_slots():
    """Generate available time slots from 07:30 to 22:30 with 1.5 hour intervals"""
    slots = []
    start_hour = 7
    start_minute = 30
    
    while True:
        time_str = f"{start_hour:02d}:{start_minute:02d}"
        slots.append(time_str)
        
        # Add 90 minutes
        start_minute += 30
        if start_minute >= 60:
            start_hour += 1
            start_minute -= 60
        
        # Stop if we've reached the last possible slot (22:30)
        if start_hour > 22 or (start_hour == 22 and start_minute > 30):
            break
    
    return slots

def is_time_blocked(date, start_time, court_id=None):
    """Check if a time slot is blocked by holidays/blocks or recurring schedules"""
    db = get_db()
    
    # Check holidays/blocks
    blocks = db.execute('''
        SELECT * FROM holidays_blocks 
        WHERE date = ?
    ''', (date,)).fetchall()
    
    for block in blocks:
        if not block['start_time'] and not block['end_time']:
            # Full day block
            return True
        elif block['start_time'] and block['end_time']:
            # Partial day block
            if block['start_time'] <= start_time < block['end_time']:
                return True
    
    # Check recurring schedules
    date_obj = datetime.strptime(date, '%Y-%m-%d')
    day_of_week = date_obj.weekday()  # 0=Monday, 6=Sunday
    
    recurring = db.execute('''
        SELECT * FROM recurring_schedules 
        WHERE day_of_week = ? AND start_date <= ? AND end_date >= ?
        AND (? IS NULL OR court_id = ?)
    ''', (day_of_week, date, date, court_id, court_id)).fetchall()
    
    for schedule in recurring:
        if schedule['start_time'] <= start_time < schedule['end_time']:
            return True
    
    return False

@public_bp.route('/courts', methods=['GET'])
def get_active_courts():
    """Get all active courts"""
    db = get_db()
    courts = db.execute('SELECT * FROM courts WHERE active = 1').fetchall()
    response = jsonify([dict(court) for court in courts])
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@public_bp.route('/players', methods=['GET'])
def get_players_autocomplete():
    """Get all players for autocomplete"""
    db = get_db()
    players = db.execute('SELECT name FROM players ORDER BY name').fetchall()
    response = jsonify([player["name"] for player in players])
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@public_bp.route('/available-times', methods=['GET'])
def get_available_times():
    """Get available time slots for a specific court and date"""
    court_id = request.args.get('court_id')
    date = request.args.get('date')
    
    if not court_id or not date:
        return jsonify({'error': 'court_id and date are required'}), 400
    
    db = get_db()
    
    # Get all possible time slots
    all_slots = generate_time_slots()
    
    # Get already booked slots
    booked_slots = db.execute('''
        SELECT start_time FROM schedules 
        WHERE court_id = ? AND date = ?
    ''', (court_id, date)).fetchall()
    booked_times = [slot['start_time'] for slot in booked_slots]
    
    # Filter out booked and blocked slots
    available_slots = []
    for slot in all_slots:
        if slot not in booked_times and not is_time_blocked(date, slot, court_id):
            available_slots.append(slot)
    
    return jsonify(available_slots)

@public_bp.route('/schedules', methods=['POST'])
def create_schedule():
    """Create a new schedule"""
    data = request.get_json()
    court_id = data.get('court_id')
    date = data.get('date')
    start_time = data.get('start_time')
    player1_name = data.get('player1_name')
    player2_name = data.get('player2_name')
    match_type = data.get('match_type')
    
    if not all([court_id, date, start_time, player1_name, player2_name, match_type]):
        return jsonify({'error': 'All fields are required'}), 400
    
    # Check if slot is still available
    db = get_db()
    existing = db.execute('''
        SELECT id FROM schedules 
        WHERE court_id = ? AND date = ? AND start_time = ?
    ''', (court_id, date, start_time)).fetchone()
    
    if existing:
        return jsonify({'error': 'Time slot is no longer available'}), 400
    
    # Check if time is blocked
    if is_time_blocked(date, start_time, court_id):
        return jsonify({'error': 'Time slot is blocked'}), 400
    
    try:
        db.execute('''
            INSERT INTO schedules (court_id, date, start_time, player1_name, player2_name, match_type)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (court_id, date, start_time, player1_name, player2_name, match_type))
        db.commit()
        return jsonify({'success': True, 'message': 'Schedule created successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@public_bp.route('/schedules/<int:schedule_id>', methods=['PUT'])
def update_schedule(schedule_id):
    """Update an existing schedule"""
    data = request.get_json()
    player1_name = data.get('player1_name')
    player2_name = data.get('player2_name')
    match_type = data.get('match_type')
    
    if not all([player1_name, player2_name, match_type]):
        return jsonify({'error': 'All fields are required'}), 400
    
    db = get_db()
    try:
        db.execute('''
            UPDATE schedules 
            SET player1_name = ?, player2_name = ?, match_type = ?
            WHERE id = ?
        ''', (player1_name, player2_name, match_type, schedule_id))
        db.commit()
        return jsonify({'success': True, 'message': 'Schedule updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@public_bp.route('/schedules/<int:schedule_id>', methods=['DELETE'])
def delete_schedule(schedule_id):
    """Delete a schedule"""
    db = get_db()
    try:
        db.execute('DELETE FROM schedules WHERE id = ?', (schedule_id,))
        db.commit()
        return jsonify({'success': True, 'message': 'Schedule deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@public_bp.route('/schedules/month', methods=['GET'])
def get_month_schedules():
    """Get all schedules for the current month (future dates only)"""
    year = request.args.get('year', datetime.now().year)
    month = request.args.get('month', datetime.now().month)
    
    # Get first and last day of the month
    first_day = f"{year}-{month:02d}-01"
    last_day_num = calendar.monthrange(int(year), int(month))[1]
    last_day = f"{year}-{month:02d}-{last_day_num:02d}"
    
    # Only get future dates (including today)
    today = datetime.now().strftime('%Y-%m-%d')
    
    db = get_db()
    schedules = db.execute('''
        SELECT s.*, c.name as court_name, c.type as court_type
        FROM schedules s
        JOIN courts c ON s.court_id = c.id
        WHERE s.date >= ? AND s.date >= ? AND s.date <= ?
        ORDER BY s.date, s.start_time
    ''', (today, first_day, last_day)).fetchall()
    
    return jsonify([dict(schedule) for schedule in schedules])

@public_bp.route('/schedules/week', methods=['GET'])
def get_week_schedules():
    """Get schedules for a specific week"""
    date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
    
    # Get start of week (Monday)
    start_of_week = date_obj - timedelta(days=date_obj.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    
    start_date = start_of_week.strftime('%Y-%m-%d')
    end_date = end_of_week.strftime('%Y-%m-%d')
    
    db = get_db()
    schedules = db.execute('''
        SELECT s.*, c.name as court_name, c.type as court_type
        FROM schedules s
        JOIN courts c ON s.court_id = c.id
        WHERE s.date >= ? AND s.date <= ?
        ORDER BY s.date, s.start_time
    ''', (start_date, end_date)).fetchall()
    
    return jsonify([dict(schedule) for schedule in schedules])

@public_bp.route('/whatsapp-message', methods=['GET'])
def generate_whatsapp_message():
    """Generate WhatsApp message with current month's future schedules"""
    now = datetime.now()
    year = now.year
    month = now.month
    today = now.strftime('%Y-%m-%d')
    
    # Get month name in Portuguese
    month_names = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    month_name = month_names[month - 1]
    
    # Get first and last day of the month
    first_day = f"{year}-{month:02d}-01"
    last_day_num = calendar.monthrange(int(year), int(month))[1]
    last_day = f"{year}-{month:02d}-{last_day_num:02d}"
    
    db = get_db()
    schedules = db.execute('''
        SELECT s.*, c.name as court_name, c.type as court_type
        FROM schedules s
        JOIN courts c ON s.court_id = c.id
        WHERE s.date >= ? AND s.date >= ? AND s.date <= ?
        ORDER BY s.date, s.start_time
    ''', (today, first_day, last_day)).fetchall()
    
    if not schedules:
        message = f"📅 *Agenda LAPEN - {month_name} {year}*\n\nNenhum jogo agendado para este mês."
        return jsonify({'message': message})
    
    message = f"📅 *Agenda LAPEN - {month_name} {year}*\n\n"
    
    current_date = None
    for schedule in schedules:
        schedule_date = datetime.strptime(schedule['date'], '%Y-%m-%d')
        formatted_date = schedule_date.strftime('%d/%m')
        day_name = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][schedule_date.weekday()]
        
        if current_date != schedule['date']:
            current_date = schedule['date']
            message += f"\n🗓️ *{day_name}, {formatted_date}*\n"
        
        court_emoji = "🎾" if schedule['court_type'] == 'Tênis' else "🏸"
        match_emoji = "🏆" if schedule['match_type'] == 'Liga' else "🤝"
        
        message += f"{court_emoji} {schedule['start_time']} - {schedule['court_name']}\n"
        message += f"{match_emoji} {schedule['player1_name']} vs {schedule['player2_name']}\n"
        message += f"📋 {schedule['match_type']}\n\n"
    
    message += "---\n🎾 *LAPEN - Liga de Tênis*"
    
    return jsonify({'message': message})