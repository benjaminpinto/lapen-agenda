from flask import Blueprint, request, jsonify
from datetime import datetime, date
from src.database import get_db
from src.auth import verify_token, get_user_by_id
from src.services.ranking_config import RankingConfigService
from src.services.points_calculator import PointsCalculator
from src.services.draw_engine import DrawEngine
from src.logger import get_logger

logger = get_logger()
ranking_bp = Blueprint('ranking', __name__, url_prefix='/api/ranking')

def require_auth(f):
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Autenticação necessária'}), 401
        
        if token.startswith('Bearer '):
            token = token[7:]
        
        user_id = verify_token(token)
        if not user_id:
            return jsonify({'error': 'Token inválido ou expirado'}), 401
        
        request.user_id = user_id
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

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
        cursor = db.execute('''
            INSERT INTO ranking_seasons (year, start_date, end_date, description)
            VALUES (?, ?, ?, ?)
        ''', (year, start_date, end_date, description))
        season_id = cursor.lastrowid
        
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
    season = db.execute('SELECT * FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    return jsonify(dict(season))

# Configuration Management
@ranking_bp.route('/seasons/<int:season_id>/config', methods=['GET'])
def get_season_config(season_id):
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    config = RankingConfigService.get_config(season['id'])
    return jsonify(config)

@ranking_bp.route('/seasons/<int:season_id>/config', methods=['PUT'])
@require_admin_auth
def update_season_config(season_id):
    data = request.get_json()
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
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
    
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    config = RankingConfigService.get_config(season['id'])
    elite_cutoff = config['elite_cutoff']
    
    query = '''
        SELECT rp.*, u.name, u.short_name
        FROM ranking_participants rp
        JOIN users u ON rp.user_id = u.id
        WHERE rp.season_id = ? AND rp.is_active = 1
        ORDER BY rp.position ASC
    '''
    
    participants = db.execute(query, (season['id'],)).fetchall()
    
    if group == 'elite':
        participants = participants[:elite_cutoff]
    elif group == 'challenger':
        participants = participants[elite_cutoff:]
    
    return jsonify([dict(p) for p in participants])

# Match Results
@ranking_bp.route('/matches/<int:match_id>/result', methods=['POST'])
@require_auth
def submit_match_result(match_id):
    data = request.get_json()
    score = data.get('score')
    winner_id = data.get('winner_id')
    
    db = get_db()
    
    # Get match details
    match = db.execute('''
        SELECT rm.*, rr.season_id FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        WHERE rm.id = ?
    ''', (match_id,)).fetchone()
    
    if not match:
        return jsonify({'error': 'Partida não encontrada'}), 404
    
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
        
        # Determine winner and calculate points
        if winner_id == match['player1_id']:
            match_result = {
                'wo_type': 'none',
                'sets_winner': p1_sets,
                'sets_loser': p2_sets,
                'games_winner': p1_games,
                'games_loser': p2_games
            }
            winner_points, loser_points = PointsCalculator.calculate(match_result, match['season_id'])
            points_p1, points_p2 = winner_points, loser_points
        else:
            match_result = {
                'wo_type': 'none',
                'sets_winner': p2_sets,
                'sets_loser': p1_sets,
                'games_winner': p2_games,
                'games_loser': p1_games
            }
            winner_points, loser_points = PointsCalculator.calculate(match_result, match['season_id'])
            points_p1, points_p2 = loser_points, winner_points
        
        # Update match
        db.execute('''
            UPDATE ranking_matches
            SET status = ?, winner_id = ?, score = ?, sets_p1 = ?, sets_p2 = ?,
                games_p1 = ?, games_p2 = ?, points_p1 = ?, points_p2 = ?, played_at = ?, added_by = ?
            WHERE id = ?
        ''', ('completed', winner_id, score, p1_sets, p2_sets, p1_games, p2_games,
              points_p1, points_p2, datetime.utcnow(), request.user_id, match_id))
        
        # Update participant stats
        for player_id, is_winner, sets_won, sets_lost, games_won, games_lost, points in [
            (match['player1_id'], winner_id == match['player1_id'], p1_sets, p2_sets, p1_games, p2_games, points_p1),
            (match['player2_id'], winner_id == match['player2_id'], p2_sets, p1_sets, p2_games, p1_games, points_p2)
        ]:
            db.execute('''
                UPDATE ranking_participants
                SET total_points = total_points + ?,
                    wins = wins + ?,
                    losses = losses + ?,
                    sets_won = sets_won + ?,
                    sets_lost = sets_lost + ?,
                    games_won = games_won + ?,
                    games_lost = games_lost + ?
                WHERE season_id = ? AND user_id = ?
            ''', (points, 1 if is_winner else 0, 0 if is_winner else 1,
                  sets_won, sets_lost, games_won, games_lost,
                  match['season_id'], player_id))
        
        # Update positions after match result
        _update_positions(db, match['season_id'])
        
        db.commit()
        db.close()
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f'Error submitting match result: {str(e)}')
        db.close()
        return jsonify({'error': str(e)}), 400

def _update_positions(db, season_id):
    """Update participant positions based on total points"""
    participants = db.execute('''
        SELECT user_id, (total_points + temp_points) as total
        FROM ranking_participants
        WHERE season_id = ?
        ORDER BY total DESC
    ''', (season_id,)).fetchall()
    
    for i, participant in enumerate(participants):
        db.execute('''
            UPDATE ranking_participants
            SET position = ?
            WHERE season_id = ? AND user_id = ?
        ''', (i + 1, season_id, participant['user_id']))

@ranking_bp.route('/stats/<int:user_id>/<int:season_id>', methods=['GET'])
def get_user_stats(user_id, season_id):
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    participant = db.execute('''
        SELECT rp.*, u.short_name as name FROM ranking_participants rp
        JOIN users u ON rp.user_id = u.id
        WHERE rp.season_id = ? AND rp.user_id = ?
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
        WHERE rm.player1_id = ? OR rm.player2_id = ?
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
        WHERE rr.status = 'open'
        ORDER BY rr.round_number DESC, rm.created_at DESC
    ''').fetchall()
    return jsonify([dict(match) for match in matches])

@ranking_bp.route('/matches/<int:match_id>/wo', methods=['POST'])
@require_admin_auth
def set_wo_result(match_id):
    data = request.get_json()
    winner_id = data.get('winner_id')
    comment = data.get('comment', '')
    
    db = get_db()
    match = db.execute('''
        SELECT rm.*, rr.season_id FROM ranking_matches rm
        JOIN ranking_rounds rr ON rm.round_id = rr.id
        WHERE rm.id = ?
    ''', (match_id,)).fetchone()
    
    if not match:
        return jsonify({'error': 'Partida não encontrada'}), 404
    
    try:
        # Calculate W.O. points
        from src.services.points_calculator import PointsCalculator
        match_result = {'wo_type': 'admin'}
        winner_points, loser_points = PointsCalculator.calculate(match_result, match['season_id'])
        
        points_p1 = winner_points if winner_id == match['player1_id'] else loser_points
        points_p2 = winner_points if winner_id == match['player2_id'] else loser_points
        
        # Update match
        db.execute('''
            UPDATE ranking_matches
            SET status = ?, winner_id = ?, wo_type = ?, points_p1 = ?, points_p2 = ?, score = ?
            WHERE id = ?
        ''', ('completed', winner_id, 'admin', points_p1, points_p2, f'W.O. - {comment}', match_id))
        
        # Update participant stats
        for player_id, is_winner, points in [
            (match['player1_id'], winner_id == match['player1_id'], points_p1),
            (match['player2_id'], winner_id == match['player2_id'], points_p2)
        ]:
            wo_field = 'wo_wins' if is_winner else 'wo_losses'
            db.execute(f'''
                UPDATE ranking_participants
                SET total_points = total_points + ?, {wo_field} = {wo_field} + 1
                WHERE season_id = ? AND user_id = ?
            ''', (points, match['season_id'], player_id))
        
        _update_positions(db, match['season_id'])
        db.commit()
        db.close()
        return jsonify({'success': True})
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/seasons/<int:season_id>/participants', methods=['POST'])
@require_admin_auth
def add_participant(season_id):
    data = request.get_json()
    user_id = data.get('user_id')
    previous_position = data.get('previous_position')
    
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    try:
        # Get next position
        max_pos = db.execute('SELECT MAX(position) as max_pos FROM ranking_participants WHERE season_id = ?', (season['id'],)).fetchone()
        position = (max_pos['max_pos'] or 0) + 1
        
        # Calculate temp points if previous position provided
        temp_points = 0
        if previous_position:
            temp_points = RankingConfigService.get_temp_points_for_position(season['id'], previous_position)
        
        db.execute('''
            INSERT INTO ranking_participants (season_id, user_id, position, temp_points)
            VALUES (?, ?, ?, ?)
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
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    try:
        participant = db.execute(
            'SELECT is_active FROM ranking_participants WHERE season_id = ? AND user_id = ?',
            (season['id'], user_id)
        ).fetchone()
        
        if not participant:
            return jsonify({'error': 'Participante não encontrado'}), 404
        
        new_status = not participant['is_active']
        db.execute(
            'UPDATE ranking_participants SET is_active = ? WHERE season_id = ? AND user_id = ?',
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
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    participants = db.execute('''
        SELECT rp.*, u.name, u.short_name
        FROM ranking_participants rp
        JOIN users u ON rp.user_id = u.id
        WHERE rp.season_id = ?
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
            VALUES (?, ?, ?, ?, ?, ?)
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
            'SELECT COUNT(*) as count FROM ranking_matches WHERE round_id = ? AND status = "completed"',
            (round_id,)
        ).fetchone()
        
        if completed['count'] > 0:
            return jsonify({'error': 'Não é possível cancelar sorteio com resultados registrados'}), 400
        
        # Delete matches and draw history
        db.execute('DELETE FROM ranking_matches WHERE round_id = ?', (round_id,))
        db.execute('DELETE FROM ranking_draws WHERE round_id = ?', (round_id,))
        db.execute('UPDATE ranking_rounds SET status = ? WHERE id = ?', ('pending', round_id))
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
        round_info = db.execute('SELECT season_id, status FROM ranking_rounds WHERE id = ?', (round_id,)).fetchone()
        if not round_info:
            return jsonify({'error': 'Rodada não encontrada'}), 404
        
        if round_info['status'] != 'drawn':
            return jsonify({'error': 'Rodada precisa estar sorteada'}), 400
        
        # Check if season is active
        season = db.execute('SELECT status FROM ranking_seasons WHERE id = ?', (round_info['season_id'],)).fetchone()
        if season['status'] != 'active':
            return jsonify({'error': 'Temporada precisa estar ativa'}), 400
        
        # Close any open rounds in the same season
        db.execute('UPDATE ranking_rounds SET status = ? WHERE season_id = ? AND status = ?', 
                   ('closed', round_info['season_id'], 'open'))
        
        # Open this round
        db.execute('UPDATE ranking_rounds SET status = ? WHERE id = ?', ('open', round_id))
        db.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f'Error opening round: {str(e)}')
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/rounds/<int:round_id>/close', methods=['PUT'])
@require_admin_auth
def close_round(round_id):
    db = get_db()
    try:
        # Check if all matches have results
        pending = db.execute(
            'SELECT COUNT(*) as count FROM ranking_matches WHERE round_id = ? AND status = "scheduled"',
            (round_id,)
        ).fetchone()
        
        if pending['count'] > 0:
            return jsonify({'error': f'{pending["count"]} partida(s) ainda sem resultado'}), 400
        
        db.execute('UPDATE ranking_rounds SET status = ? WHERE id = ?', ('closed', round_id))
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
        season = db.execute('SELECT status FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
        if not season:
            return jsonify({'error': 'Temporada não encontrada'}), 404
        
        if season['status'] != 'draft':
            return jsonify({'error': 'Apenas temporadas em rascunho podem ser abertas'}), 400
        
        # Check if there's already an active season
        active = db.execute('SELECT COUNT(*) as count FROM ranking_seasons WHERE status = "active"').fetchone()
        if active['count'] > 0:
            return jsonify({'error': 'Já existe uma temporada ativa. Finalize-a antes de abrir outra'}), 400
        
        db.execute('UPDATE ranking_seasons SET status = ? WHERE id = ?', ('active', season_id))
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
        season = db.execute('SELECT status FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
        if not season:
            return jsonify({'error': 'Temporada não encontrada'}), 404
        
        if season['status'] != 'active':
            return jsonify({'error': 'Apenas temporadas ativas podem ser finalizadas'}), 400
        
        # Check if there are open rounds
        open_rounds = db.execute(
            'SELECT COUNT(*) as count FROM ranking_rounds WHERE season_id = ? AND status = "open"',
            (season_id,)
        ).fetchone()
        
        if open_rounds['count'] > 0:
            return jsonify({'error': 'Feche todas as rodadas antes de finalizar a temporada'}), 400
        
        db.execute('UPDATE ranking_seasons SET status = ? WHERE id = ?', ('finished', season_id))
        db.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f'Error closing season: {str(e)}')
        return jsonify({'error': str(e)}), 400

# Missing routes
@ranking_bp.route('/seasons/<int:season_id>/temp-points-rules', methods=['GET'])
def get_temp_points_rules(season_id):
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    rules = db.execute('SELECT * FROM ranking_temp_points_rules WHERE season_id = ? ORDER BY position_min', (season['id'],)).fetchall()
    return jsonify([dict(rule) for rule in rules])

@ranking_bp.route('/seasons/<int:season_id>/temp-points-rules', methods=['POST'])
@require_admin_auth
def create_temp_points_rules(season_id):
    data = request.get_json()
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    try:
        for rule in data.get('rules', []):
            db.execute('''
                INSERT INTO ranking_temp_points_rules (season_id, position_min, position_max, points, label)
                VALUES (?, ?, ?, ?, ?)
            ''', (season['id'], rule['position_min'], rule['position_max'], rule['points'], rule.get('label')))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/seasons/<int:season_id>/temp-points-rules', methods=['DELETE'])
@require_admin_auth
def delete_temp_points_rules(season_id):
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    try:
        db.execute('DELETE FROM ranking_temp_points_rules WHERE season_id = ?', (season['id'],))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/seasons/<int:season_id>/expire-temp-points', methods=['POST'])
@require_admin_auth
def expire_temp_points(season_id):
    from src.services.temp_points_manager import TempPointsManager
    db = get_db()
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
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
    season = db.execute('SELECT id FROM ranking_seasons WHERE id = ?', (season_id,)).fetchone()
    if not season:
        return jsonify({'error': 'Temporada não encontrada'}), 404
    
    try:
        db.execute('''
            UPDATE ranking_participants
            SET temp_points = ?
            WHERE season_id = ? AND user_id = ?
        ''', (temp_points, season['id'], user_id))
        _update_positions(db, season['id'])
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@ranking_bp.route('/rounds/<int:season_id>', methods=['GET'])
def get_rounds(season_id):
    db = get_db()
    rounds = db.execute('SELECT * FROM ranking_rounds WHERE season_id = ? ORDER BY round_number', (season_id,)).fetchall()
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
        WHERE rm.round_id = ?
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
        WHERE rm.id = ?
    ''', (match_id,)).fetchone()
    if not match:
        return jsonify({'error': 'Partida não encontrada'}), 404
    return jsonify(dict(match))

@ranking_bp.route('/recent-results', methods=['GET'])
def get_recent_results():
    limit = request.args.get('limit', 20, type=int)
    db = get_db()
    results = db.execute('''
        SELECT rm.*, rr.round_number, rr.month,
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
        ORDER BY rm.played_at DESC
        LIMIT ?
    ''', (limit,)).fetchall()
    return jsonify([dict(r) for r in results])