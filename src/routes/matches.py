from flask import Blueprint, request, jsonify
from src.database import get_db
from src.database_utils import get_current_date_sql, get_current_time_sql
from src.auth import require_auth
from src.logger import get_logger
from datetime import datetime

logger = get_logger()

matches_bp = Blueprint('matches', __name__, url_prefix='/api/matches')

@matches_bp.route('/', methods=['GET'])
def get_available_matches():
    """Get matches available for betting (future matches only)"""
    db = get_db()
    try:
        # Get future schedules that can be bet on
        current_date = get_current_date_sql()
        current_time = get_current_time_sql()
        cursor = db.execute(f'''
            SELECT s.id, s.court_id, s.date, s.start_time, s.player1_name, s.player2_name, 
                   s.match_type, c.name as court_name,
                   m.id as match_id, m.status, m.betting_enabled, m.total_pool
            FROM schedules s
            LEFT JOIN courts c ON s.court_id = c.id
            LEFT JOIN matches m ON s.id = m.schedule_id
            WHERE s.date > {current_date} OR (s.date = {current_date} AND s.start_time >= {current_time})
            ORDER BY s.date, s.start_time
        ''')
        
        schedules = cursor.fetchall()
        matches = []
        
        for schedule in schedules:
            status = schedule['status'] or 'upcoming'
            
            # Convert time objects to strings for JSON serialization
            start_time = schedule['start_time']
            if hasattr(start_time, 'strftime'):
                start_time = start_time.strftime('%H:%M')
            
            date = schedule['date']
            if hasattr(date, 'strftime'):
                date = date.strftime('%Y-%m-%d')
            
            # Check if match is still eligible for betting (1 hour before)
            from datetime import datetime, timedelta
            try:
                match_datetime = datetime.strptime(f"{date} {start_time}", '%Y-%m-%d %H:%M')
                cutoff_time = datetime.now() + timedelta(hours=1)
                is_betting_eligible = match_datetime > cutoff_time
            except:
                is_betting_eligible = True
            
            match_data = {
                'schedule_id': schedule['id'],
                'match_id': schedule['match_id'],
                'court_name': schedule['court_name'],
                'date': date,
                'start_time': start_time,
                'player1_name': schedule['player1_name'],
                'player2_name': schedule['player2_name'],
                'match_type': schedule['match_type'],
                'status': status,
                'betting_enabled': (schedule['betting_enabled'] if schedule['betting_enabled'] is not None else True) and is_betting_eligible,
                'total_pool': float(schedule['total_pool'] or 0)
            }
            matches.append(match_data)
        
        logger.info(f'Fetched {len(matches)} matches successfully')
        return jsonify({'matches': matches})
        
    except Exception as e:
        logger.error(f'Error fetching matches: {str(e)}')
        return jsonify({'error': f'Erro ao buscar partidas: {str(e)}'}), 500
    finally:
        db.close()

@matches_bp.route('/create', methods=['POST'])
@require_auth
def create_match():
    """Create a match from an existing schedule"""
    data = request.get_json()
    schedule_id = data.get('schedule_id')
    
    if not schedule_id:
        return jsonify({'error': 'ID da agenda é obrigatório'}), 400
    
    db = get_db()
    try:
        # Check if schedule exists and is in the future
        current_date = get_current_date_sql()
        current_time = get_current_time_sql()
        cursor = db.execute(f'''
            SELECT * FROM schedules 
            WHERE id = ? AND (date > {current_date} OR (date = {current_date} AND start_time > {current_time}))
        ''', (schedule_id,))
        
        schedule = cursor.fetchone()
        if not schedule:
            return jsonify({'error': 'Agenda não encontrada ou já passou'}), 404
        
        # Check if match already exists
        cursor = db.execute('SELECT id FROM matches WHERE schedule_id = ?', (schedule_id,))
        existing_match = cursor.fetchone()
        
        if existing_match:
            return jsonify({'error': 'Partida já existe para esta agenda'}), 400
        
        # Create match
        cursor = db.execute('''
            INSERT INTO matches (schedule_id, status, betting_enabled, total_pool, house_edge)
            VALUES (?, 'upcoming', ?, 0.00, 0.20)
        ''', (schedule_id, data.get('betting_enabled', True)))
        
        db.commit()
        match_id = cursor.lastrowid
        
        logger.info(f'Match created: schedule_id={schedule_id}, match_id={match_id}')
        return jsonify({
            'message': 'Partida criada com sucesso',
            'match_id': match_id
        }), 201
        
    except Exception as e:
        logger.error(f'Error creating match for schedule {schedule_id}: {str(e)}')
        return jsonify({'error': f'Erro ao criar partida: {str(e)}'}), 500
    finally:
        db.close()

@matches_bp.route('/<int:match_id>/toggle-betting', methods=['POST'])
@require_auth
def toggle_betting(match_id):
    """Enable/disable betting for a match"""
    db = get_db()
    try:
        cursor = db.execute('SELECT betting_enabled FROM matches WHERE id = ?', (match_id,))
        match = cursor.fetchone()
        
        if not match:
            return jsonify({'error': 'Partida não encontrada'}), 404
        
        new_status = not match['betting_enabled']
        db.execute('UPDATE matches SET betting_enabled = ? WHERE id = ?', (new_status, match_id))
        db.commit()
        
        logger.info(f'Betting toggled for match {match_id}: {new_status}')
        return jsonify({
            'message': f'Apostas {"habilitadas" if new_status else "desabilitadas"}',
            'betting_enabled': new_status
        })
        
    except Exception as e:
        logger.error(f'Error toggling betting for match {match_id}: {str(e)}')
        return jsonify({'error': f'Erro ao alterar status das apostas: {str(e)}'}), 500
    finally:
        db.close()

@matches_bp.route('/<int:match_id>/status', methods=['PUT'])
@require_auth
def update_match_status(match_id):
    """Update match status (upcoming, live, finished, cancelled)"""
    data = request.get_json()
    status = data.get('status')
    
    valid_statuses = ['upcoming', 'live', 'finished', 'cancelled']
    if status not in valid_statuses:
        return jsonify({'error': 'Status inválido'}), 400
    
    db = get_db()
    try:
        cursor = db.execute('SELECT id FROM matches WHERE id = ?', (match_id,))
        if not cursor.fetchone():
            return jsonify({'error': 'Partida não encontrada'}), 404
        
        db.execute('UPDATE matches SET status = ? WHERE id = ?', (status, match_id))
        db.commit()
        
        logger.info(f'Match status updated: match_id={match_id}, status={status}')
        return jsonify({
            'message': 'Status da partida atualizado',
            'status': status
        })
        
    except Exception as e:
        logger.error(f'Error updating match status {match_id}: {str(e)}')
        return jsonify({'error': f'Erro ao atualizar status: {str(e)}'}), 500
    finally:
        db.close()