from flask import Blueprint, request, jsonify
from src.auth import require_auth
from src.database import get_db
from src.logger import get_logger

logger = get_logger()
statistics_bp = Blueprint('statistics', __name__, url_prefix='/api/statistics')

@statistics_bp.route('/match-result', methods=['POST'])
@require_auth
def add_match_result():
    """Add result for a past scheduled or ranking match"""
    data = request.get_json()
    schedule_id = data.get('schedule_id')
    ranking_match_id = data.get('ranking_match_id')
    winner_name = data.get('winner_name')
    player1_sets = data.get('player1_sets', 0)
    player2_sets = data.get('player2_sets', 0)
    player1_games = data.get('player1_games', 0)
    player2_games = data.get('player2_games', 0)

    if not winner_name or (not schedule_id and not ranking_match_id):
        return jsonify({'error': 'Dados incompletos'}), 400

    db = get_db()
    try:
        if schedule_id:
            schedule = db.execute('SELECT * FROM schedules WHERE id = ? AND deleted_at IS NULL', (schedule_id,)).fetchone()
            if not schedule:
                return jsonify({'error': 'Partida não encontrada'}), 404

            db.execute('''
                INSERT INTO match_statistics (schedule_id, player1_name, player2_name, winner_name,
                    player1_sets, player2_sets, player1_games, player2_games, match_type, match_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (schedule_id, schedule['player1_name'], schedule['player2_name'], winner_name,
                  player1_sets, player2_sets, player1_games, player2_games, schedule['match_type'], schedule['date']))
        
        elif ranking_match_id:
            from datetime import datetime
            match = db.execute('''
                SELECT rm.*, u1.short_name as player1_name, u2.short_name as player2_name, rr.season_id
                FROM ranking_matches rm
                JOIN users u1 ON rm.player1_id = u1.id
                JOIN users u2 ON rm.player2_id = u2.id
                JOIN ranking_rounds rr ON rm.round_id = rr.id
                WHERE rm.id = ?
            ''', (ranking_match_id,)).fetchone()
            
            if not match:
                return jsonify({'error': 'Partida de ranking não encontrada'}), 404
            
            winner_id = match['player1_id'] if winner_name == match['player1_name'] else match['player2_id']
            score = f"{player1_sets}-{player2_sets}"
            
            from src.services.points_calculator import PointsCalculator
            match_result = {
                'wo_type': 'none',
                'sets_winner': max(player1_sets, player2_sets),
                'sets_loser': min(player1_sets, player2_sets),
                'games_winner': player1_games if winner_id == match['player1_id'] else player2_games,
                'games_loser': player2_games if winner_id == match['player1_id'] else player1_games
            }
            winner_points, loser_points = PointsCalculator.calculate(match_result, match['season_id'])
            points_p1 = winner_points if winner_id == match['player1_id'] else loser_points
            points_p2 = winner_points if winner_id == match['player2_id'] else loser_points
            
            db.execute('''
                UPDATE ranking_matches
                SET status = ?, winner_id = ?, score = ?, sets_p1 = ?, sets_p2 = ?,
                    games_p1 = ?, games_p2 = ?, points_p1 = ?, points_p2 = ?, played_at = ?
                WHERE id = ?
            ''', ('completed', winner_id, score, player1_sets, player2_sets, player1_games, player2_games,
                  points_p1, points_p2, datetime.utcnow(), ranking_match_id))
            
            for player_id, is_winner, sets_won, sets_lost, games_won, games_lost, points in [
                (match['player1_id'], winner_id == match['player1_id'], player1_sets, player2_sets, player1_games, player2_games, points_p1),
                (match['player2_id'], winner_id == match['player2_id'], player2_sets, player1_sets, player2_games, player1_games, points_p2)
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
        
        db.commit()
        return jsonify({'message': 'Resultado adicionado com sucesso'}), 201
    except Exception as e:
        logger.error(f'Error adding match result: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@statistics_bp.route('/player', methods=['GET'])
def get_player_statistics():
    """Get statistics for specific players with filters"""
    player1 = request.args.get('player1')
    player2 = request.args.get('player2')
    match_type = request.args.get('match_type')

    if not player1:
        return jsonify({'error': 'Jogador obrigatório'}), 400

    db = get_db()
    try:
        conditions = ['(player1_name = ? OR player2_name = ?)']
        params = [player1, player1]

        if player2:
            conditions.append('((player1_name = ? AND player2_name = ?) OR (player1_name = ? AND player2_name = ?))')
            params.extend([player1, player2, player2, player1])

        if match_type:
            conditions.append('match_type = ?')
            params.append(match_type)

        query = f'SELECT * FROM match_statistics WHERE {" AND ".join(conditions)} ORDER BY match_date DESC'
        schedule_matches = db.execute(query, params).fetchall()
        
        ranking_matches_list = []
        if not match_type or match_type == 'Ranking':
            ranking_conditions = ['rm.status = "completed" AND (u1.short_name = ? OR u2.short_name = ?)']
            ranking_params = [player1, player1]
            
            if player2:
                ranking_conditions.append('((u1.short_name = ? AND u2.short_name = ?) OR (u1.short_name = ? AND u2.short_name = ?))')
                ranking_params.extend([player1, player2, player2, player1])
            
            ranking_query = f'''
                SELECT rm.id, rm.played_at as match_date, u1.short_name as player1_name, 
                       u2.short_name as player2_name, uw.short_name as winner_name,
                       rm.sets_p1 as player1_sets, rm.sets_p2 as player2_sets,
                       rm.games_p1 as player1_games, rm.games_p2 as player2_games,
                       'Ranking' as match_type
                FROM ranking_matches rm
                JOIN users u1 ON rm.player1_id = u1.id
                JOIN users u2 ON rm.player2_id = u2.id
                JOIN users uw ON rm.winner_id = uw.id
                WHERE {" AND ".join(ranking_conditions)}
                ORDER BY rm.played_at DESC
            '''
            ranking_matches_list = db.execute(ranking_query, ranking_params).fetchall()
        
        matches = list(schedule_matches) + list(ranking_matches_list)

        stats = {
            'total_matches': len(matches),
            'wins': sum(1 for m in matches if m['winner_name'] == player1),
            'losses': len(matches) - sum(1 for m in matches if m['winner_name'] == player1),
            'sets_won': sum(m['player1_sets'] if m['player1_name'] == player1 else m['player2_sets'] for m in matches),
            'sets_lost': sum(m['player2_sets'] if m['player1_name'] == player1 else m['player1_sets'] for m in matches),
            'games_won': sum(m['player1_games'] if m['player1_name'] == player1 else m['player2_games'] for m in matches),
            'games_lost': sum(m['player2_games'] if m['player1_name'] == player1 else m['player1_games'] for m in matches),
            'matches': [dict(m) for m in matches]
        }

        if player2:
            stats['head_to_head'] = {
                'player1': player1,
                'player2': player2,
                'player1_wins': sum(1 for m in matches if m['winner_name'] == player1),
                'player2_wins': sum(1 for m in matches if m['winner_name'] == player2)
            }

        return jsonify(stats)
    except Exception as e:
        logger.error(f'Error fetching statistics: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@statistics_bp.route('/past-matches', methods=['GET'])
def get_past_matches():
    """Get past scheduled matches and pending ranking matches without results"""
    db = get_db()
    try:
        schedule_matches = db.execute('''
            SELECT s.id, s.date, s.start_time, s.player1_name, s.player2_name, s.match_type
            FROM schedules s
            LEFT JOIN match_statistics ms ON s.id = ms.schedule_id
            WHERE s.deleted_at IS NULL AND ms.id IS NULL AND s.date < date('now')
        ''').fetchall()
        
        ranking_matches = db.execute('''
            SELECT rm.id, NULL as date, NULL as start_time, 
                   u1.short_name as player1_name, u2.short_name as player2_name, 
                   'Ranking' as match_type
            FROM ranking_matches rm
            JOIN users u1 ON rm.player1_id = u1.id
            JOIN users u2 ON rm.player2_id = u2.id
            WHERE rm.status = 'scheduled'
        ''').fetchall()
        
        all_matches = [dict(m) for m in schedule_matches] + [dict(m) for m in ranking_matches]
        return jsonify({'matches': all_matches})
    except Exception as e:
        logger.error(f'Error fetching past matches: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@statistics_bp.route('/players', methods=['GET'])
def get_all_players():
    """Get list of all players from match statistics and ranking"""
    db = get_db()
    try:
        players = db.execute('''
            SELECT DISTINCT player1_name as name FROM match_statistics
            UNION
            SELECT DISTINCT player2_name as name FROM match_statistics
            UNION
            SELECT DISTINCT u.short_name as name FROM ranking_matches rm
            JOIN users u ON rm.player1_id = u.id
            WHERE rm.status = 'completed'
            UNION
            SELECT DISTINCT u.short_name as name FROM ranking_matches rm
            JOIN users u ON rm.player2_id = u.id
            WHERE rm.status = 'completed'
            ORDER BY name
        ''').fetchall()
        return jsonify({'players': [p['name'] for p in players]})
    except Exception as e:
        logger.error(f'Error fetching players: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@statistics_bp.route('/opponents/<player_name>', methods=['GET'])
def get_player_opponents(player_name):
    """Get list of opponents for a specific player"""
    db = get_db()
    try:
        opponents = db.execute('''
            SELECT DISTINCT 
                CASE 
                    WHEN player1_name = ? THEN player2_name
                    ELSE player1_name
                END as opponent
            FROM match_statistics
            WHERE player1_name = ? OR player2_name = ?
            UNION
            SELECT DISTINCT 
                CASE 
                    WHEN u1.short_name = ? THEN u2.short_name
                    ELSE u1.short_name
                END as opponent
            FROM ranking_matches rm
            JOIN users u1 ON rm.player1_id = u1.id
            JOIN users u2 ON rm.player2_id = u2.id
            WHERE rm.status = 'completed' AND (u1.short_name = ? OR u2.short_name = ?)
            ORDER BY opponent
        ''', (player_name, player_name, player_name, player_name, player_name, player_name)).fetchall()
        return jsonify({'opponents': [o['opponent'] for o in opponents]})
    except Exception as e:
        logger.error(f'Error fetching opponents: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()
