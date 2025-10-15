import calendar
from datetime import datetime, timedelta, time, timezone

from flask import Blueprint, request, jsonify

from src.database import get_db
from src.database_utils import get_current_date_sql, get_current_time_sql, get_month_comparison_sql, row_to_dict, rows_to_dicts

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
    return jsonify(rows_to_dicts(courts))


@public_bp.route('/players', methods=['GET'])
def get_players_autocomplete():
    """Get all players for autocomplete"""
    db = get_db()
    players = db.execute('SELECT name FROM players ORDER BY name').fetchall()
    return jsonify([player[0] if isinstance(player, tuple) else player['name'] for player in players])


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
    year = int(request.args.get('year', now.year))
    month = int(request.args.get('month', now.month))

    # Get first and last day of the month
    first_day = f"{year}-{month:02d}-01"
    last_day_num = calendar.monthrange(year, month)[1]
    last_day = f"{year}-{month:02d}-{last_day_num:02d}"

    db = get_db()
    schedules = db.execute('''
        SELECT s.*, c.name as court_name, c.type as court_type
        FROM schedules s
        JOIN courts c ON s.court_id = c.id
        WHERE s.date >= ? AND s.date <= ?
        ORDER BY s.date, s.start_time
    ''', (first_day, last_day)).fetchall()

    return jsonify(rows_to_dicts(schedules))


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

    return jsonify(rows_to_dicts(schedules))


@public_bp.route('/whatsapp-message', methods=['GET'])
def generate_whatsapp_message():
    """Generate WhatsApp message with selected month's schedules"""
    now = datetime.now(timezone.utc)
    year = int(request.args.get('year', now.year))
    month = int(request.args.get('month', now.month))
    today = now.strftime('%Y-%m-%d')
    
    # For selected month, show all schedules if it's not current month, otherwise show future schedules
    current_month = now.month
    current_year = now.year
    show_all = (year != current_year or month != current_month)

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
    
    # Use appropriate date filter based on whether we're showing current month or another month
    start_date = first_day if show_all else max(today, first_day)
    
    schedules = db.execute('''
        SELECT s.*, c.name as court_name, c.type as court_type
        FROM schedules s
        JOIN courts c ON s.court_id = c.id
        WHERE s.date >= ? AND s.date <= ?
        ORDER BY s.date, c.name, s.start_time
    ''', (start_date, last_day)).fetchall()

    if not schedules:
        period_text = "este mês" if not show_all else f"{month_name.lower()} de {year}"
        message = f"📅 *Agenda LAPEN - {month_name} {year}*\n\nNenhum jogo agendado para {period_text}."
        return jsonify({'message': message})

    # Get betting odds for matches with active bets
    match_odds = {}
    for schedule in schedules:
        match = db.execute('SELECT id FROM matches WHERE schedule_id = ? AND status = \'upcoming\'', (schedule['id'],)).fetchone()
        if match:
            bets = db.execute('''
                SELECT player_name, SUM(amount) as total_amount
                FROM bets
                WHERE match_id = ? AND status = \'active\'
                GROUP BY player_name
            ''', (match['id'],)).fetchall()
            
            if len(bets) == 2:
                total_pool = sum(bet['total_amount'] for bet in bets)
                odds = {}
                for bet in bets:
                    odds[bet['player_name']] = round(total_pool / bet['total_amount'], 2)
                match_odds[schedule['id']] = odds

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
                elif schedule['match_type'] == 'Torneio':
                    match_emoji = "🏅"
                else:
                    match_emoji = "🤝"
                
                # Add odds if available
                odds_text = ""
                if schedule['id'] in match_odds:
                    odds = match_odds[schedule['id']]
                    p1_odd = odds.get(schedule['player1_name'], 0)
                    p2_odd = odds.get(schedule['player2_name'], 0)
                    
                    if p1_odd > p2_odd:
                        odds_text = f" ({p1_odd:.2f}x 🔥 vs {p2_odd:.2f}x)"
                    else:
                        odds_text = f" ({p1_odd:.2f}x vs {p2_odd:.2f}x 🔥)"
                
                message_parts.append(
                    f"  🕐 {normalize_time(schedule['start_time'])} - {schedule['player1_name']} vs {schedule['player2_name']} {match_emoji}{odds_text}\n")

    message_parts.extend(["\n\n---\n", f"Para criar ou alterar seu agendamento, acesse:\n🔗 {request.host_url}",
                          "\n\n🎾 *LAPEN - Liga Penedense de Tênis*"])
    message = ''.join(message_parts)

    return jsonify({'message': message})


@public_bp.route('/dashboard-stats', methods=['GET'])
def get_public_dashboard_stats():
    """Get dashboard statistics for public view"""
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
        'mostBookedCourt': row_to_dict(most_booked_court),
        'gameStats': rows_to_dicts(game_stats),
        'topPlayers': rows_to_dicts(top_players)
    })
