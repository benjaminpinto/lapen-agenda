from datetime import datetime

from flask import Blueprint, request, jsonify

from src.auth import verify_token, get_user_by_id
from src.database import get_db
from src.logger import get_logger
from src.services.draw_engine import DrawEngine
from src.services.points_calculator import PointsCalculator
from src.services.ranking_config import RankingConfigService

logger = get_logger()
ranking_bp = Blueprint('ranking', __name__, url_prefix='/api/ranking')

def require_auth(f):
    def decorated_function(*args, **kwargs):
        token = request.cookies.get('access_token')
        if not token:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header[7:]
        
        if not token:
            return jsonify({'error': 'Autenticação necessária'}), 401
        
        user_id = verify_token(token)
        if not user_id:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        
        request.user_id = user_id
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

def require_admin_auth(f):
    def decorated_function(*args, **kwargs):
        token = request.cookies.get('access_token')
        if not token:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header[7:]
        
        if not token:
            return jsonify({'error': 'Autenticação necessária'}), 401
        
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

# Season Management
@ranking_bp.route('/seasons', methods=['POST'])
@require_admin_auth
def create_season():
    data = request.get_json()
    year = data.get('year')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    description = data.get('description', '')
    
    if not year or not start_date or not end_date:
        return jsonify({'error': 'Ano, data de início e data de fim são obrigatórios'}), 400
    
    db = get_db()
    try:
        cursor = db.cursor()
        cursor.execute('''
            INSERT INTO ranking_seasons (year, start_date, end_date, description)
            VALUES (%s, %s, %s, %s) RETURNING id
        ''', (year, start_date, end_date, description))
        season_id = cursor.fetchone()['id']
        
        # Set default configuration
        RankingConfigService.set_config(season_id, RankingConfigService.DEFAULT_CONFIG, db)
        
        db.commit()
        db.close()
        return jsonify({'success': True, 'season_id': season_id})
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/seasons', methods=['GET'])
def get_seasons():
    db = get_db()
    seasons = db.execute('SELECT * FROM ranking_seasons ORDER BY year DESC').fetchall()
    db.close()
    return jsonify([dict(s) for s in seasons])

@ranking_bp.route('/seasons/<int:season_id>', methods=['GET'])
def get_season(season_id):
    db = get_db()
    season = db.execute('SELECT * FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    return jsonify(dict(season))

# Configuration Management
@ranking_bp.route('/seasons/<int:season_id>/config', methods=['GET'])
def get_season_config(season_id):
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    config = RankingConfigService.get_config(season['id'])
    return jsonify(config)

@ranking_bp.route('/seasons/<int:season_id>/config', methods=['PUT'])
@require_admin_auth
def update_season_config(season_id):
    data = request.get_json()
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    try:
        RankingConfigService.set_config(season['id'], data)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Leaderboard
@ranking_bp.route('/leaderboard/<int:season_id>', methods=['GET'])
def get_leaderboard(season_id):
    group = request.args.get('group', 'all')
    db = get_db()
    
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    config = RankingConfigService.get_config(season['id'])
    elite_cutoff = config['elite_cutoff']
    challenger_cutoff = config['challenger_cutoff']
    
    query = '''
        SELECT rp.*, u.name, u.short_name
        FROM ranking_participants rp
        JOIN users u ON rp.user_id = u.id
        WHERE rp.season_id = %s AND rp.is_active = true AND u.lapen_approved = TRUE AND u.deleted_at IS NULL
        ORDER BY rp.position ASC
    '''
    
    participants = db.execute(query, (season['id'],)).fetchall()
    
    if group == 'elite':
        participants = participants[:elite_cutoff]
    elif group == 'challenger':
        participants = participants[elite_cutoff:challenger_cutoff]
    elif group == 'nextgen':
        participants = participants[challenger_cutoff:]
    
    return jsonify([dict(p) for p in participants])

def _update_match_result(db, match_id, winner_id, score, wo_type='none', sets_p1=0, sets_p2=0, games_p1=0, games_p2=0, added_by=None):
    """Unified method to update match results and participant stats"""
    # Get match details
    match = db.execute('''
        SELECT rm.*, rr.season_id, u1.short_name as p1_name, u2.short_name as p2_name
        FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        JOIN users u1 ON rm.player1_id = u1.id
        JOIN users u2 ON rm.player2_id = u2.id
        WHERE rm.id = %s
    ''', (match_id,)).fetchone()
    
    if not match:
        raise ValueError('Partida não encontrada')
    
    # Calculate points
    if wo_type != 'none':
        match_result = {'wo_type': wo_type}
    else:
        if winner_id == match['player1_id']:
            match_result = {
                'wo_type': 'none',
                'sets_winner': sets_p1,
                'sets_loser': sets_p2,
                'games_winner': games_p1,
                'games_loser': games_p2
            }
        else:
            match_result = {
                'wo_type': 'none',
                'sets_winner': sets_p2,
                'sets_loser': sets_p1,
                'games_winner': games_p2,
                'games_loser': games_p1
            }
    
    winner_points, loser_points = PointsCalculator.calculate(match_result, match['season_id'])
    points_p1 = winner_points if winner_id == match['player1_id'] else loser_points
    points_p2 = winner_points if winner_id == match['player2_id'] else loser_points
    
    # Update match
    db.execute('''
        UPDATE ranking_matches
        SET status = %s, winner_id = %s, score = %s, sets_p1 = %s, sets_p2 = %s,
            games_p1 = %s, games_p2 = %s, wo_type = %s, points_p1 = %s, points_p2 = %s, 
            played_at = %s, added_by = %s
        WHERE id = %s
    ''', ('completed', winner_id, score, sets_p1, sets_p2, games_p1, games_p2, wo_type,
          points_p1, points_p2, datetime.utcnow(), added_by, match_id))
    
    # Update or insert statistics
    winner_user = db.execute('SELECT short_name FROM users WHERE id = %s', (winner_id,)).fetchone()
    existing_stat = db.execute(
        'SELECT id FROM match_statistics_unified WHERE ranking_match_id = %s',
        (match_id,)
    ).fetchone()
    
    if existing_stat:
        db.execute('''
            UPDATE match_statistics_unified
            SET winner_id = %s, winner_name = TRIM(%s), score = %s, match_date = %s
            WHERE ranking_match_id = %s
        ''', (winner_id, winner_user['short_name'], score, datetime.utcnow(), match_id))
    else:
        db.execute('''
            INSERT INTO match_statistics_unified (
                ranking_match_id, player1_id, player2_id,
                player1_name, player2_name, winner_id, winner_name,
                score, match_type, match_date, season_id, added_by
            ) VALUES (%s, %s, %s, TRIM(%s), TRIM(%s), %s, TRIM(%s), %s, %s, %s, %s, %s)
        ''', (
            match_id, match['player1_id'], match['player2_id'],
            match['p1_name'], match['p2_name'],
            winner_id, winner_user['short_name'],
            score, 'Ranking', datetime.utcnow(), match['season_id'], added_by
        ))
    
    # Update participant stats
    for player_id, is_winner, sets_won, sets_lost, games_won, games_lost, points in [
        (match['player1_id'], winner_id == match['player1_id'], sets_p1, sets_p2, games_p1, games_p2, points_p1),
        (match['player2_id'], winner_id == match['player2_id'], sets_p2, sets_p1, games_p2, games_p1, points_p2)
    ]:
        update_fields = [
            'total_points = total_points + %s',
            'wins = wins + %s',
            'losses = losses + %s',
            'sets_won = sets_won + %s',
            'sets_lost = sets_lost + %s',
            'games_won = games_won + %s',
            'games_lost = games_lost + %s'
        ]
        update_values = [points, 1 if is_winner else 0, 0 if is_winner else 1,
                        sets_won, sets_lost, games_won, games_lost]
        
        if wo_type != 'none':
            wo_field = 'wo_wins' if is_winner else 'wo_losses'
            update_fields.append(f'{wo_field} = {wo_field} + 1')
        
        db.execute(f'''
            UPDATE ranking_participants
            SET {', '.join(update_fields)}
            WHERE season_id = %s AND user_id = %s
        ''', (*update_values, match['season_id'], player_id))
    
    # Update positions
    _update_positions(db, match['season_id'])

# Match Results
@ranking_bp.route('/matches/<int:match_id>/result', methods=['POST'])
@require_admin_auth
def submit_match_result(match_id):
    data = request.get_json()
    score = data.get('score')
    winner_id = data.get('winner_id')
    
    db = get_db()
    
    # Get match details with season and round status
    match = db.execute('''
        SELECT rm.*, rr.season_id, rr.status as round_status, rs.status as season_status
        FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        JOIN ranking_seasons rs ON rr.season_id = rs.id
        WHERE rm.id = %s
    ''', (match_id,)).fetchone()
    
    if not match:
        return jsonify({'error': 'Partida não encontrada'}), 404
    
    # Verify season is active
    if match['season_status'] != 'active':
        return jsonify({'error': 'Temporada não está ativa'}), 400
    
    # Verify round is open
    if match['round_status'] != 'open':
        return jsonify({'error': 'Rodada não está aberta'}), 400
    
    # Verify user can submit result
    if request.user_id not in [match['player1_id'], match['player2_id']]:
        user = get_user_by_id(request.user_id)
        if not user or not user.get('is_admin'):
            return jsonify({'error': 'Acesso negado'}), 403
    
    if match['status'] == 'completed':
        return jsonify({'error': 'Resultado já registrado'}), 400
    
    try:
        # Parse score
        p1_sets, p2_sets, p1_games, p2_games = PointsCalculator.parse_score(score)
        
        # Use unified method
        _update_match_result(db, match_id, winner_id, score, 'none', 
                           p1_sets, p2_sets, p1_games, p2_games, request.user_id)
        
        db.commit()
        db.close()
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f'Error submitting match result: {str(e)}')
        db.rollback()
        db.close()
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/matches/<int:match_id>/wo', methods=['POST'])
@require_auth
def set_wo_result(match_id):
    data = request.get_json()
    winner_id = data.get('winner_id')
    comment = data.get('comment', '')
    
    # Ensure winner_id is an integer
    try:
        winner_id = int(winner_id)
    except (ValueError, TypeError):
        return jsonify({'error': 'ID do vencedor inválido'}), 400
    
    db = get_db()
    match = db.execute('''
        SELECT rm.*, rr.season_id, rr.status as round_status, rs.status as season_status
        FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        JOIN ranking_seasons rs ON rr.season_id = rs.id
        WHERE rm.id = %s
    ''', (match_id,)).fetchone()
    
    if not match:
        return jsonify({'error': 'Partida não encontrada'}), 404
    
    if match['season_status'] != 'active':
        return jsonify({'error': 'Temporada não está ativa'}), 400
    
    if match['round_status'] != 'open':
        return jsonify({'error': 'Rodada não está aberta'}), 400
    
    try:
        wo_score = f'W.O. - {comment}'
        _update_match_result(db, match_id, winner_id, wo_score, 'user', 
                           0, 0, 0, 0, request.user_id)
        
        db.commit()
        db.close()
        return jsonify({'success': True})
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 400

def _update_positions(db, season_id):
    """Update participant positions based on total points and tie-breaking rules"""
    participants = db.execute('''
        SELECT user_id, total_points, temp_points, (total_points + temp_points) as total,
               wins, (sets_won - sets_lost) as set_diff, (games_won - games_lost) as game_diff
        FROM ranking_participants
        WHERE season_id = %s AND is_active = true
        ORDER BY (total_points + temp_points) DESC, wins DESC, (sets_won - sets_lost) DESC, (games_won - games_lost) DESC
    ''', (season_id,)).fetchall()
    
    # Apply head-to-head for remaining ties
    participants_list = list(participants)
    i = 0
    while i < len(participants_list):
        # Find group with same stats
        j = i + 1
        while j < len(participants_list) and _same_stats(participants_list[i], participants_list[j]):
            j += 1
        
        # If tied group, apply head-to-head
        if j - i > 1:
            tied_group = participants_list[i:j]
            tied_group = _apply_head_to_head(db, season_id, tied_group)
            participants_list[i:j] = tied_group
        
        i = j
    
    for idx, participant in enumerate(participants_list):
        db.execute('''
            UPDATE ranking_participants
            SET position = %s
            WHERE season_id = %s AND user_id = %s
        ''', (idx + 1, season_id, participant['user_id']))

def _same_stats(p1, p2):
    """Check if two participants have identical stats for tie-breaking"""
    return (p1['total'] == p2['total'] and 
            p1['wins'] == p2['wins'] and 
            p1['set_diff'] == p2['set_diff'] and 
            p1['game_diff'] == p2['game_diff'])

def _apply_head_to_head(db, season_id, tied_players):
    """Apply head-to-head results to break ties"""
    if len(tied_players) != 2:
        return tied_players  # Head-to-head only for 2-player ties
    
    p1_id = tied_players[0]['user_id']
    p2_id = tied_players[1]['user_id']
    
    # Check if they played each other
    h2h = db.execute('''
        SELECT winner_id FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        WHERE rr.season_id = %s 
          AND ((rm.player1_id = %s AND rm.player2_id = %s) 
            OR (rm.player1_id = %s AND rm.player2_id = %s))
          AND rm.winner_id IS NOT NULL
        ORDER BY rm.played_at DESC
        LIMIT 1
    ''', (season_id, p1_id, p2_id, p2_id, p1_id)).fetchone()
    
    if h2h and h2h['winner_id'] == p2_id:
        return [tied_players[1], tied_players[0]]
    
    return tied_players

@ranking_bp.route('/stats/<int:user_id>/<int:season_id>', methods=['GET'])
def get_user_stats(user_id, season_id):
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    participant = db.execute('''
        SELECT rp.*, u.short_name as name FROM ranking_participants rp
        JOIN users u ON rp.user_id = u.id
        WHERE rp.season_id = %s AND rp.user_id = %s
    ''', (season['id'], user_id)).fetchone()
    
    if not participant:
        return jsonify({'error': 'Participante não encontrado'}), 404
    
    return jsonify(dict(participant))

@ranking_bp.route('/my-matches', methods=['GET'])
@require_auth
def get_my_matches():
    db = get_db()
    matches = db.execute('''
        SELECT rm.*, rr.round_number, u1.short_name as player1_name, u2.short_name as player2_name, uw.short_name as winner_name
        FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        JOIN users u1 ON rm.player1_id = u1.id
        JOIN users u2 ON rm.player2_id = u2.id
        LEFT JOIN users uw ON rm.winner_id = uw.id
        WHERE rm.player1_id = %s OR rm.player2_id = %s
        ORDER BY rr.round_number DESC, rm.created_at DESC
    ''', (request.user_id, request.user_id)).fetchall()
    return jsonify([dict(match) for match in matches])

@ranking_bp.route('/all-open-matches', methods=['GET'])
def get_all_open_matches():
    db = get_db()
    matches = db.execute('''
        SELECT rm.*, rr.round_number, rr.month, u1.short_name as player1_name, u2.short_name as player2_name, u1.id as player1_id, u2.id as player2_id
        FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        JOIN users u1 ON rm.player1_id = u1.id
        JOIN users u2 ON rm.player2_id = u2.id
        WHERE rr.status = 'open' AND rm.schedule_id IS NULL AND rm.status = 'scheduled'
        ORDER BY rr.round_number DESC, rm.created_at DESC
    ''').fetchall()
    return jsonify([dict(match) for match in matches])

@ranking_bp.route('/seasons/<int:season_id>/participants', methods=['POST'])
@require_admin_auth
def add_participant(season_id):
    data = request.get_json()
    user_id = data.get('user_id')
    previous_position = data.get('previous_position')
    
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    try:
        # Get next position
        max_pos = db.execute('SELECT MAX(position) as max_pos FROM ranking_participants WHERE season_id = %s', (season['id'],)).fetchone()
        position = (max_pos['max_pos'] or 0) + 1
        
        # Calculate temp points if previous position provided
        temp_points = 0
        if previous_position:
            temp_points = RankingConfigService.get_temp_points_for_position(season['id'], previous_position)
        
        db.execute('''
            INSERT INTO ranking_participants (season_id, user_id, position, temp_points)
            VALUES (%s, %s, %s, %s)
        ''', (season['id'], user_id, position, temp_points))
        
        _update_positions(db, season['id'])
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/seasons/<int:season_id>/participants/<int:user_id>/toggle', methods=['PUT'])
@require_admin_auth
def toggle_participant(season_id, user_id):
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    try:
        participant = db.execute(
            'SELECT is_active FROM ranking_participants WHERE season_id = %s AND user_id = %s',
            (season['id'], user_id)
        ).fetchone()
        
        if not participant:
            return jsonify({'error': 'Participante não encontrado'}), 404
        
        new_status = not participant['is_active']
        db.execute(
            'UPDATE ranking_participants SET is_active = %s WHERE season_id = %s AND user_id = %s',
            (new_status, season['id'], user_id)
        )
        db.commit()
        return jsonify({'success': True, 'is_active': new_status})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/seasons/<int:season_id>/all-participants', methods=['GET'])
@require_admin_auth
def get_all_participants(season_id):
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    participants = db.execute('''
        SELECT rp.*, u.name, u.short_name
        FROM ranking_participants rp
        JOIN users u ON rp.user_id = u.id
        WHERE rp.season_id = %s
        ORDER BY rp.position ASC
    ''', (season['id'],)).fetchall()
    
    return jsonify([dict(p) for p in participants])

# Rounds Management
@ranking_bp.route('/rounds', methods=['POST'])
@require_admin_auth
def create_round():
    data = request.get_json()
    season_id = data.get('season_id')
    round_number = data.get('round_number')
    month = data.get('month')
    year = data.get('year')
    is_finals = data.get('is_finals', False)
    description = data.get('description', '')
    
    db = get_db()
    try:
        db.execute('''
            INSERT INTO ranking_rounds (season_id, round_number, month, year, is_finals, description)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (season_id, round_number, month, year, is_finals, description))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/rounds/<int:round_id>/draw', methods=['POST'])
@require_admin_auth
def generate_draw(round_id):
    try:
        matches = DrawEngine.generate_draw(round_id)
        return jsonify({'success': True, 'matches': matches})
    except Exception as e:
        logger.error(f'Error generating draw: {str(e)}')
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/rounds/<int:round_id>/draw', methods=['DELETE'])
@require_admin_auth
def cancel_draw(round_id):
    db = get_db()
    try:
        # Check if any matches have results
        completed = db.execute(
            'SELECT COUNT(*) as count FROM ranking_matches WHERE round_id = %s AND status = %s',
            (round_id, 'completed')
        ).fetchone()
        
        if completed['count'] > 0:
            return jsonify({'error': 'Não é possível cancelar sorteio com resultados registrados'}), 400
        
        # Delete matches and draw history
        db.execute('DELETE FROM ranking_matches WHERE round_id = %s', (round_id,))
        db.execute('DELETE FROM ranking_draws WHERE round_id = %s', (round_id,))
        db.execute('UPDATE ranking_rounds SET status = %s WHERE id = %s', ('pending', round_id))
        db.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f'Error canceling draw: {str(e)}')
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/rounds/<int:round_id>/open', methods=['PUT'])
@require_admin_auth
def open_round(round_id):
    db = get_db()
    try:
        round_info = db.execute('SELECT season_id, status FROM ranking_rounds WHERE id = %s', (round_id,)).fetchone()
        if not round_info:
            return jsonify({'error': 'Rodada não encontrada'}), 404
        
        if round_info['status'] != 'drawn':
            return jsonify({'error': 'Rodada precisa estar sorteada'}), 400
        
        # Check if season is active
        season = db.execute('SELECT status FROM ranking_seasons WHERE id = %s', (round_info['season_id'],)).fetchone()
        if season['status'] != 'active':
            return jsonify({'error': 'Temporada precisa estar ativa'}), 400
        
        # Close any open rounds in the same season
        db.execute('UPDATE ranking_rounds SET status = %s WHERE season_id = %s AND status = %s', 
                   ('closed', round_info['season_id'], 'open'))
        
        # Open this round
        db.execute('UPDATE ranking_rounds SET status = %s WHERE id = %s', ('open', round_id))
        db.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f'Error opening round: {str(e)}')
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/rounds/<int:round_id>/close', methods=['PUT'])
@require_admin_auth
def close_round(round_id):
    data = request.get_json() or {}
    mark_pending_as_not_played = data.get('mark_pending_as_not_played', False)
    
    db = get_db()
    try:
        pending = db.execute(
            'SELECT COUNT(*) as count FROM ranking_matches WHERE round_id = %s AND status = %s',
            (round_id, 'scheduled')
        ).fetchone()
        
        if pending['count'] > 0:
            if not mark_pending_as_not_played:
                return jsonify({
                    'error': f'{pending["count"]} partida(s) ainda sem resultado',
                    'pending_count': pending['count']
                }), 400
            
            db.execute('''
                UPDATE ranking_matches
                SET status = 'not_played', score = 'Não realizado', 
                    points_p1 = 0, points_p2 = 0
                WHERE round_id = %s AND status = 'scheduled'
            ''', (round_id,))
        
        db.execute('UPDATE ranking_rounds SET status = %s WHERE id = %s', ('closed', round_id))
        db.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f'Error closing round: {str(e)}')
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/seasons/<int:season_id>/open', methods=['PUT'])
@require_admin_auth
def open_season(season_id):
    db = get_db()
    try:
        season = db.execute('SELECT status FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
        if not season:
            return jsonify({'error': 'Temporada não encontrada'}), 404
        
        if season['status'] != 'draft':
            return jsonify({'error': 'Apenas temporadas em rascunho podem ser abertas'}), 400
        
        # Check if there's already an active season
        active = db.execute('SELECT COUNT(*) as count FROM ranking_seasons WHERE status = %s', ('active',)).fetchone()
        if active['count'] > 0:
            return jsonify({'error': 'Já existe uma temporada ativa. Finalize-a antes de abrir outra'}), 400
        
        db.execute('UPDATE ranking_seasons SET status = %s WHERE id = %s', ('active', season_id))
        db.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f'Error opening season: {str(e)}')
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/seasons/<int:season_id>/close', methods=['PUT'])
@require_admin_auth
def close_season(season_id):
    db = get_db()
    try:
        season = db.execute('SELECT status FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
        if not season:
            return jsonify({'error': 'Temporada não encontrada'}), 404
        
        if season['status'] != 'active':
            return jsonify({'error': 'Apenas temporadas ativas podem ser finalizadas'}), 400
        
        # Check if there are open rounds
        open_rounds = db.execute(
            'SELECT COUNT(*) as count FROM ranking_rounds WHERE season_id = %s AND status = %s',
            (season_id, 'open')
        ).fetchone()
        
        if open_rounds['count'] > 0:
            return jsonify({'error': 'Feche todas as rodadas antes de finalizar a temporada'}), 400
        
        db.execute('UPDATE ranking_seasons SET status = %s WHERE id = %s', ('finished', season_id))
        db.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f'Error closing season: {str(e)}')
        return jsonify({'error': str(e)}), 400

# Missing routes
@ranking_bp.route('/seasons/<int:season_id>/temp-points-rules', methods=['GET'])
def get_temp_points_rules(season_id):
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    rules = db.execute('SELECT * FROM ranking_temp_points_rules WHERE season_id = %s ORDER BY position_min', (season['id'],)).fetchall()
    return jsonify([dict(rule) for rule in rules])

@ranking_bp.route('/seasons/<int:season_id>/temp-points-rules', methods=['POST'])
@require_admin_auth
def create_temp_points_rules(season_id):
    data = request.get_json()
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    try:
        for rule in data.get('rules', []):
            db.execute('''
                INSERT INTO ranking_temp_points_rules (season_id, position_min, position_max, points, label)
                VALUES (%s, %s, %s, %s, %s)
            ''', (season['id'], rule['position_min'], rule['position_max'], rule['points'], rule.get('label')))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/seasons/<int:season_id>/temp-points-rules', methods=['DELETE'])
@require_admin_auth
def delete_temp_points_rules(season_id):
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    try:
        db.execute('DELETE FROM ranking_temp_points_rules WHERE season_id = %s', (season['id'],))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/seasons/<int:season_id>/expire-temp-points', methods=['POST'])
@require_admin_auth
def expire_temp_points(season_id):
    from src.services.temp_points_manager import TempPointsManager
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    try:
        TempPointsManager.expire_temp_points(season['id'])
        _update_positions(db, season['id'])
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/seasons/<int:season_id>/participants/<int:user_id>/temp-points', methods=['PUT'])
@require_admin_auth
def update_participant_temp_points(season_id, user_id):
    data = request.get_json()
    temp_points = data.get('temp_points', 0)
    
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    try:
        db.execute('''
            UPDATE ranking_participants
            SET temp_points = %s
            WHERE season_id = %s AND user_id = %s
        ''', (temp_points, season['id'], user_id))
        _update_positions(db, season['id'])
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/seasons/<int:season_id>/recalculate', methods=['POST'])
@require_admin_auth
def recalculate_ranking(season_id):
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = %s', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    try:
        # Reset all participant stats to zero, keep temp_points separate
        db.execute('''
            UPDATE ranking_participants 
            SET total_points = 0, wins = 0, losses = 0, sets_won = 0, sets_lost = 0,
                games_won = 0, games_lost = 0, wo_wins = 0, wo_losses = 0
            WHERE season_id = %s
        ''', (season['id'],))
        
        # Recalculate from all completed matches
        matches = db.execute('''
            SELECT rm.id, rm.player1_id, rm.player2_id, rm.winner_id, rm.score, rm.wo_type
            FROM ranking_matches rm
            JOIN ranking_rounds rr ON rm.round_id = rr.id
            WHERE rr.season_id = %s AND rm.status = 'completed'
        ''', (season['id'],)).fetchall()
        
        for match in matches:
            # Parse score and recalculate points
            if match['wo_type'] != 'none':
                # W.O. match - no sets/games
                p1_sets = p2_sets = p1_games = p2_games = 0
                match_result = {'wo_type': match['wo_type']}
            else:
                # Regular match - parse score
                p1_sets, p2_sets, p1_games, p2_games = PointsCalculator.parse_score(match['score'])
                if match['winner_id'] == match['player1_id']:
                    match_result = {
                        'wo_type': 'none',
                        'sets_winner': p1_sets,
                        'sets_loser': p2_sets,
                        'games_winner': p1_games,
                        'games_loser': p2_games
                    }
                else:
                    match_result = {
                        'wo_type': 'none',
                        'sets_winner': p2_sets,
                        'sets_loser': p1_sets,
                        'games_winner': p2_games,
                        'games_loser': p1_games
                    }
            
            # Calculate points
            winner_points, loser_points = PointsCalculator.calculate(match_result, season['id'])
            points_p1 = winner_points if match['winner_id'] == match['player1_id'] else loser_points
            points_p2 = winner_points if match['winner_id'] == match['player2_id'] else loser_points
            
            # Update match with recalculated values
            db.execute('''
                UPDATE ranking_matches
                SET sets_p1 = %s, sets_p2 = %s, games_p1 = %s, games_p2 = %s,
                    points_p1 = %s, points_p2 = %s
                WHERE id = %s
            ''', (p1_sets, p2_sets, p1_games, p2_games, points_p1, points_p2, match['id']))
            
            # Update participant stats for each match
            for player_id, is_winner, sets_won, sets_lost, games_won, games_lost, points in [
                (match['player1_id'], match['winner_id'] == match['player1_id'], 
                 p1_sets, p2_sets, p1_games, p2_games, points_p1),
                (match['player2_id'], match['winner_id'] == match['player2_id'], 
                 p2_sets, p1_sets, p2_games, p1_games, points_p2)
            ]:
                update_fields = [
                    'total_points = total_points + %s',
                    'wins = wins + %s',
                    'losses = losses + %s',
                    'sets_won = sets_won + %s',
                    'sets_lost = sets_lost + %s',
                    'games_won = games_won + %s',
                    'games_lost = games_lost + %s'
                ]
                update_values = [points, 1 if is_winner else 0, 0 if is_winner else 1,
                                sets_won, sets_lost, games_won, games_lost]
                
                if match['wo_type'] != 'none':
                    wo_field = 'wo_wins' if is_winner else 'wo_losses'
                    update_fields.append(f'{wo_field} = {wo_field} + 1')
                
                db.execute(f'''
                    UPDATE ranking_participants
                    SET {', '.join(update_fields)}
                    WHERE season_id = %s AND user_id = %s
                ''', (*update_values, season['id'], player_id))
        
        # Update positions
        _update_positions(db, season['id'])
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/rounds/<int:season_id>', methods=['GET'])
def get_rounds(season_id):
    db = get_db()
    rounds = db.execute('SELECT * FROM ranking_rounds WHERE season_id = %s ORDER BY round_number', (season_id,)).fetchall()
    return jsonify([dict(round) for round in rounds])

@ranking_bp.route('/rounds/<int:round_id>/matches', methods=['GET'])
def get_round_matches(round_id):
    db = get_db()
    matches = db.execute('''
        SELECT rm.*, u1.short_name as player1_name, u2.short_name as player2_name, uw.short_name as winner_name
        FROM ranking_matches rm
        JOIN users u1 ON rm.player1_id = u1.id
        JOIN users u2 ON rm.player2_id = u2.id
        LEFT JOIN users uw ON rm.winner_id = uw.id
        WHERE rm.round_id = %s
    ''', (round_id,)).fetchall()
    return jsonify([dict(match) for match in matches])

@ranking_bp.route('/matches/<int:match_id>', methods=['GET'])
def get_match(match_id):
    db = get_db()
    match = db.execute('''
        SELECT rm.*, u1.short_name as player1_name, u2.short_name as player2_name, uw.short_name as winner_name
        FROM ranking_matches rm
        JOIN users u1 ON rm.player1_id = u1.id
        JOIN users u2 ON rm.player2_id = u2.id
        LEFT JOIN users uw ON rm.winner_id = uw.id
        WHERE rm.id = %s
    ''', (match_id,)).fetchone()
    if not match:
        return jsonify({'error': 'Partida não encontrada'}), 404
    return jsonify(dict(match))

@ranking_bp.route('/recent-results', methods=['GET'])
def get_recent_results():
    limit = request.args.get('limit', 20, type=int)
    db = get_db()
    results = db.execute('''
        SELECT rm.*, rr.round_number, rr.month, rr.season_id,
               u1.short_name as player1_name, u2.short_name as player2_name, 
               uw.short_name as winner_name,
               ua.short_name as added_by_name, ua.id as added_by_id
        FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        JOIN users u1 ON rm.player1_id = u1.id
        JOIN users u2 ON rm.player2_id = u2.id
        LEFT JOIN users uw ON rm.winner_id = uw.id
        LEFT JOIN users ua ON rm.added_by = ua.id
        WHERE rm.status = 'completed'
        ORDER BY rm.played_at DESC, rm.id DESC
        LIMIT %s
    ''', (limit,)).fetchall()
    
    enriched_results = []
    for result in results:
        result_dict = dict(result)
        
        config = RankingConfigService.get_config(result['season_id'])
        elite_cutoff = config.get('elite_cutoff', 8)
        challenger_cutoff = config.get('challenger_cutoff', 16)
        
        p1_position = db.execute(
            'SELECT position FROM ranking_participants WHERE season_id = %s AND user_id = %s',
            (result['season_id'], result['player1_id'])
        ).fetchone()
        p2_position = db.execute(
            'SELECT position FROM ranking_participants WHERE season_id = %s AND user_id = %s',
            (result['season_id'], result['player2_id'])
        ).fetchone()
        
        if (p1_position and p1_position['position'] <= elite_cutoff) or \
           (p2_position and p2_position['position'] <= elite_cutoff):
            result_dict['group_type'] = 'elite'
        elif (p1_position and p1_position['position'] <= challenger_cutoff) or \
             (p2_position and p2_position['position'] <= challenger_cutoff):
            result_dict['group_type'] = 'challenger'
        else:
            result_dict['group_type'] = 'nextgen'
        
        enriched_results.append(result_dict)
    
    db.close()
    return jsonify(enriched_results)

@ranking_bp.route('/participants/<int:participant_id>/points-history', methods=['GET'])
def get_participant_points_history(participant_id):
    db = get_db()
    
    participant = db.execute('''
        SELECT rp.*, u.short_name, rs.year
        FROM ranking_participants rp
        JOIN users u ON rp.user_id = u.id
        JOIN ranking_seasons rs ON rp.season_id = rs.id
        WHERE rp.id = %s
    ''', (participant_id,)).fetchone()
    
    if not participant:
        return jsonify({'error': 'Participante não encontrado'}), 404
    
    matches = db.execute('''
        SELECT rm.*, rr.round_number, rr.month,
               u1.short_name as player1_name, u2.short_name as player2_name,
               uw.short_name as winner_name
        FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        JOIN users u1 ON rm.player1_id = u1.id
        JOIN users u2 ON rm.player2_id = u2.id
        LEFT JOIN users uw ON rm.winner_id = uw.id
        WHERE rr.season_id = %s 
          AND (rm.player1_id = %s OR rm.player2_id = %s)
          AND rm.status = 'completed'
        ORDER BY rr.round_number ASC, rm.played_at ASC
    ''', (participant['season_id'], participant['user_id'], participant['user_id'])).fetchall()
    
    history = []
    running_total = participant['temp_points']
    
    if participant['temp_points'] > 0:
        history.append({
            'type': 'temp_points',
            'description': 'Pontos Temporários (Ranking Anterior)',
            'points': participant['temp_points'],
            'running_total': running_total
        })
    
    for match in matches:
        is_player1 = match['player1_id'] == participant['user_id']
        points = match['points_p1'] if is_player1 else match['points_p2']
        opponent = match['player2_name'] if is_player1 else match['player1_name']
        is_winner = match['winner_id'] == participant['user_id']
        
        running_total += points
        
        history.append({
            'type': 'match',
            'round_number': match['round_number'],
            'month': match['month'],
            'opponent': opponent,
            'score': match['score'],
            'result': 'Vitória' if is_winner else 'Derrota',
            'wo_type': match['wo_type'],
            'group_type': match['group_type'],
            'points': points,
            'running_total': running_total,
            'played_at': match['played_at']
        })
    
    return jsonify({
        'participant': {
            'name': participant['short_name'],
            'season_year': participant['year'],
            'temp_points': participant['temp_points'],
            'total_points': participant['total_points'],
            'final_total': participant['temp_points'] + participant['total_points']
        },
        'history': history
    })

@ranking_bp.route('/player-on-fire', methods=['GET'])
def get_player_on_fire():
    db = get_db()
    
    active_season = db.execute("SELECT id FROM ranking_seasons WHERE status = 'active'").fetchone()
    if not active_season:
        return jsonify({'elite': [], 'challenger': [], 'nextgen': []})
    
    season_id = active_season['id']
    
    config = RankingConfigService.get_config(season_id)
    elite_cutoff = config.get('elite_cutoff', 8)
    challenger_cutoff = config.get('challenger_cutoff', 16)
    
    participants = db.execute('''
        SELECT rp.*, u.short_name, u.name
        FROM ranking_participants rp
        JOIN users u ON rp.user_id = u.id
        WHERE rp.season_id = %s AND rp.is_active = true AND u.lapen_approved = TRUE AND u.deleted_at IS NULL
    ''', (season_id,)).fetchall()
    
    participants_map = {p['user_id']: dict(p) for p in participants}
    
    matches = db.execute('''
        SELECT rm.player1_id, rm.player2_id, rm.winner_id, rm.played_at
        FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        WHERE rr.season_id = %s AND rm.winner_id IS NOT NULL
        ORDER BY rm.played_at ASC, rm.id ASC
    ''', (season_id,)).fetchall()
    
    streaks = {uid: 0 for uid in participants_map.keys()}
    
    for match in matches:
        p1 = match['player1_id']
        p2 = match['player2_id']
        winner = match['winner_id']
        
        if not winner:
            continue
            
        if p1 in streaks:
            if p1 == winner:
                streaks[p1] += 1
            else:
                streaks[p1] = 0
                
        if p2 in streaks:
            if p2 == winner:
                streaks[p2] += 1
            else:
                streaks[p2] = 0
    
    elite_streaks = []
    challenger_streaks = []
    nextgen_streaks = []
    
    for uid, streak in streaks.items():
        if streak > 0:
            player = participants_map[uid]
            player_data = {
                'user_id': uid,
                'name': player['short_name'] or player['name'],
                'streak': streak,
                'position': player['position']
            }
            
            if player['position'] <= elite_cutoff:
                elite_streaks.append(player_data)
            elif player['position'] <= challenger_cutoff:
                challenger_streaks.append(player_data)
            else:
                nextgen_streaks.append(player_data)
    
    elite_streaks.sort(key=lambda x: x['streak'], reverse=True)
    challenger_streaks.sort(key=lambda x: x['streak'], reverse=True)
    nextgen_streaks.sort(key=lambda x: x['streak'], reverse=True)
    
    return jsonify({
        'elite': elite_streaks[:5],
        'challenger': challenger_streaks[:5],
        'nextgen': nextgen_streaks[:5]
    })