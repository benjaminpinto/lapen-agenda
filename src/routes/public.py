import calendar
from datetime import datetime, timedelta, time, timezone

from flask import Blueprint, request, jsonify

from src.database import get_db

public_bp = Blueprint('public', __name__, url_prefix='/api/public')

def normalize_time(time_value):
    """Convert time to string format for comparison"""
    if isinstance(time_value, str):
        return time_value
    elif hasattr(time_value, 'strftime'):
        return time_value.strftime('%H:%M')
    return str(time_value)


def generate_time_slots():
    """Generate available time slots from 07:30 to 22:30 with 1.5 hour intervals"""
    slots = []
    current_time = datetime.combine(datetime.today(), time(7, 30))
    end_time = datetime.combine(datetime.today(), time(22, 30))
    interval = timedelta(minutes=90)

    while current_time <= end_time:
        slots.append(current_time.strftime('%H:%M'))
        current_time += interval

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
            if normalize_time(block['start_time']) <= start_time < normalize_time(block['end_time']):
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
        if normalize_time(schedule['start_time']) <= start_time < normalize_time(schedule['end_time']):
            return True

    return False


@public_bp.route('/courts', methods=['GET'])
def get_active_courts():
    """Get all active courts"""
    db = get_db()
    courts = db.execute('SELECT * FROM courts WHERE active = TRUE').fetchall()
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
    booked_times = [normalize_time(slot['start_time']) for slot in booked_slots]

    # Get all blocked times once
    blocks = db.execute('SELECT * FROM holidays_blocks WHERE date = ?', (date,)).fetchall()

    date_obj = datetime.strptime(date, '%Y-%m-%d')
    day_of_week = date_obj.weekday()

    recurring = db.execute('''
        SELECT * FROM recurring_schedules 
        WHERE day_of_week = ? AND start_date <= ? AND end_date >= ?
        AND (? IS NULL OR court_id = ?)
    ''', (day_of_week, date, date, court_id, court_id)).fetchall()

    # Check blocked times efficiently
    def is_slot_blocked(start_time):
        for block in blocks:
            if not block['start_time'] and not block['end_time']:
                return True
            elif block['start_time'] and block['end_time']:
                if normalize_time(block['start_time']) <= start_time < normalize_time(block['end_time']):
                    return True

        for schedule in recurring:
            if normalize_time(schedule['start_time']) <= start_time < normalize_time(schedule['end_time']):
                return True
        return False

    # Filter available slots
    available_slots = [slot for slot in all_slots
                       if slot not in booked_times and not is_slot_blocked(slot)]

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
    except Exception:
        return jsonify({'error': 'Failed to create schedule'}), 500


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

    # Check if schedule exists
    existing = db.execute('SELECT id FROM schedules WHERE id = ?', (schedule_id,)).fetchone()
    if not existing:
        return jsonify({'error': 'Schedule not found'}), 404

    try:
        db.execute('''
            UPDATE schedules 
            SET player1_name = ?, player2_name = ?, match_type = ?
            WHERE id = ?
        ''', (player1_name, player2_name, match_type, schedule_id))
        db.commit()
        return jsonify({'success': True, 'message': 'Schedule updated successfully'})
    except Exception:
        return jsonify({'error': 'Failed to update schedule'}), 500


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
    """Get all schedules for the current month"""
    now = datetime.now(timezone.utc)
    year = request.args.get('year', now.year)
    month = request.args.get('month', now.month)

    # Get first and last day of the month
    first_day = f"{year}-{month:02d}-01"
    last_day_num = calendar.monthrange(int(year), int(month))[1]
    last_day = f"{year}-{month:02d}-{last_day_num:02d}"

    db = get_db()
    schedules = db.execute('''
        SELECT s.*, c.name as court_name, c.type as court_type
        FROM schedules s
        JOIN courts c ON s.court_id = c.id
        WHERE s.date >= ? AND s.date <= ?
        ORDER BY s.date, s.start_time
    ''', (first_day, last_day)).fetchall()

    # Convert time objects to strings for JSON serialization
    serialized_schedules = []
    for schedule in schedules:
        schedule_dict = dict(schedule)
        if 'start_time' in schedule_dict:
            schedule_dict['start_time'] = normalize_time(schedule_dict['start_time'])
        if 'date' in schedule_dict and not isinstance(schedule_dict['date'], str):
            schedule_dict['date'] = schedule_dict['date'].strftime('%Y-%m-%d')
        serialized_schedules.append(schedule_dict)
    return jsonify(serialized_schedules)


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

    # Convert time objects to strings for JSON serialization
    serialized_schedules = []
    for schedule in schedules:
        schedule_dict = dict(schedule)
        if 'start_time' in schedule_dict:
            schedule_dict['start_time'] = normalize_time(schedule_dict['start_time'])
        if 'date' in schedule_dict and not isinstance(schedule_dict['date'], str):
            schedule_dict['date'] = schedule_dict['date'].strftime('%Y-%m-%d')
        serialized_schedules.append(schedule_dict)
    return jsonify(serialized_schedules)


@public_bp.route('/whatsapp-message', methods=['GET'])
def generate_whatsapp_message():
    """Generate WhatsApp message with current month's future schedules"""
    now = datetime.now(timezone.utc)
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
        WHERE s.date >= ? AND s.date <= ?
        ORDER BY s.date, c.name, s.start_time
    ''', (today, last_day)).fetchall()

    if not schedules:
        message = f"📅 *Agenda LAPEN - {month_name} {year}*\n\nNenhum jogo agendado para este mês."
        return jsonify({'message': message})

    # Group schedules by date and court
    grouped_schedules = {}
    for schedule in schedules:
        date = schedule['date']
        court_name = schedule['court_name']
        if date not in grouped_schedules:
            grouped_schedules[date] = {}
        if court_name not in grouped_schedules[date]:
            grouped_schedules[date][court_name] = []
        grouped_schedules[date][court_name].append(schedule)

    message_parts = [f"📅 *Agenda LAPEN - {month_name} {year}*\n\n"]

    for date, courts in grouped_schedules.items():
        # Handle both string (SQLite) and date object (PostgreSQL)
        if isinstance(date, str):
            schedule_date = datetime.strptime(date, '%Y-%m-%d')
        else:
            schedule_date = datetime.combine(date, datetime.min.time())
        formatted_date = schedule_date.strftime('%d/%m')
        day_name = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][schedule_date.weekday()]

        message_parts.append(f"\n🗓️ *{day_name}, {formatted_date}*\n")

        for court_name, court_schedules in courts.items():
            message_parts.append(f"\n📍 *{court_name}*\n")

            for schedule in court_schedules:
                if schedule['match_type'] == 'Liga':
                    match_emoji = "🎾"
                elif schedule['match_type'] == 'Aula':
                    match_emoji = "✍️"
                else:
                    match_emoji = "🤝"
                message_parts.append(
                    f"  🕐 {normalize_time(schedule['start_time'])} - {schedule['player1_name']} vs {schedule['player2_name']} {match_emoji}\n")

    message_parts.extend(["\n\n---\n", f"\n\nPara criar ou alterar seu agendamento, acesse:\n🔗 {request.host_url}",
                          "\n\n\n🎾 *LAPEN - Liga Penedense de Tênis*"])
    message = ''.join(message_parts)

    return jsonify({'message': message})


@public_bp.route('/dashboard-stats', methods=['GET'])
def get_public_dashboard_stats():
    """Get dashboard statistics for public view"""
    db = get_db()

    # Most booked court this month
    most_booked_court = db.execute('''
        SELECT c.name, COUNT(*) as bookings
        FROM schedules s
        JOIN courts c ON s.court_id = c.id
        WHERE strftime('%Y-%m', s.date) = strftime('%Y-%m', 'now')
        GROUP BY c.id, c.name
        ORDER BY bookings DESC
        LIMIT 1
    ''').fetchone()

    # Total games by type this month
    game_stats = db.execute('''
        SELECT match_type, COUNT(*) as count
        FROM schedules
        WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
        GROUP BY match_type
    ''').fetchall()

    # Top players this month
    top_players = db.execute('''
        WITH monthly_schedules AS (
            SELECT player1_name, player2_name 
            FROM schedules 
            WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
        )
        SELECT player_name, COUNT(*) as games
        FROM (
            SELECT player1_name as player_name FROM monthly_schedules
            UNION ALL
            SELECT player2_name as player_name FROM monthly_schedules
        )
        GROUP BY player_name
        ORDER BY games DESC
        LIMIT 5
    ''').fetchall()

    return jsonify({
        'mostBookedCourt': dict(most_booked_court) if most_booked_court else None,
        'gameStats': [dict(stat) for stat in game_stats],
        'topPlayers': [dict(player) for player in top_players]
    })
