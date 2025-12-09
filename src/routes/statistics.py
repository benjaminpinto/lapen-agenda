from flask import Blueprint, request, jsonify
from src.auth import require_auth
from src.database import get_db
from src.database_utils import row_to_dict
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
            schedule = db.execute('SELECT * FROM schedules WHERE id = %s AND deleted_at IS NULL', (schedule_id,)).fetchone()
            if not schedule:
                return jsonify({'error': 'Partida não encontrada'}), 404

            db.execute('''
                INSERT INTO match_statistics (schedule_id, player1_name, player2_name, winner_name,
                    player1_sets, player2_sets, player1_games, player2_games, match_type, match_date, added_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (schedule_id, schedule['player1_name'], schedule['player2_name'], winner_name,
                  player1_sets, player2_sets, player1_games, player2_games, schedule['match_type'], schedule['date'], request.user_id))
        
        elif ranking_match_id:
            from datetime import datetime
            match = db.execute('''
                SELECT rm.*, u1.short_name as player1_name, u2.short_name as player2_name, rr.season_id
                FROM ranking_matches rm
                JOIN users u1 ON rm.player1_id = u1.id
                JOIN users u2 ON rm.player2_id = u2.id
                JOIN ranking_rounds rr ON rm.round_id = rr.id
                WHERE rm.id = %s
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
                SET status = %s, winner_id = %s, score = %s, sets_p1 = %s, sets_p2 = %s,
                    games_p1 = %s, games_p2 = %s, points_p1 = %s, points_p2 = %s, played_at = %s, added_by = %s
                WHERE id = %s
            ''', ('completed', winner_id, score, player1_sets, player2_sets, player1_games, player2_games,
                  points_p1, points_p2, datetime.utcnow(), request.user_id, ranking_match_id))
            
            for player_id, is_winner, sets_won, sets_lost, games_won, games_lost, points in [
                (match['player1_id'], winner_id == match['player1_id'], player1_sets, player2_sets, player1_games, player2_games, points_p1),
                (match['player2_id'], winner_id == match['player2_id'], player2_sets, player1_sets, player2_games, player1_games, points_p2)
            ]:
                db.execute('''
                    UPDATE ranking_participants
                    SET total_points = total_points + %s,
                        wins = wins + %s,
                        losses = losses + %s,
                        sets_won = sets_won + %s,
                        sets_lost = sets_lost + %s,
                        games_won = games_won + %s,
                        games_lost = games_lost + %s
                    WHERE season_id = %s AND user_id = %s
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
        conditions = ['(player1_name = %s OR player2_name = %s)']
        params = [player1, player1]

        if player2:
            conditions.append('((player1_name = %s AND player2_name = %s) OR (player1_name = %s AND player2_name = %s))')
            params.extend([player1, player2, player2, player1])

        if match_type:
            conditions.append('match_type = %s')
            params.append(match_type)

        query = f'SELECT * FROM match_statistics WHERE {" AND ".join(conditions)} ORDER BY match_date DESC'
        schedule_matches = db.execute(query, params).fetchall()
        
        ranking_matches_list = []
        if not match_type or match_type == 'Ranking':
            ranking_conditions = ["rm.status = 'completed' AND (u1.short_name = %s OR u2.short_name = %s)"]
            ranking_params = [player1, player1]
            
            if player2:
                ranking_conditions.append('((u1.short_name = %s AND u2.short_name = %s) OR (u1.short_name = %s AND u2.short_name = %s))')
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
            WHERE s.deleted_at IS NULL AND ms.id IS NULL AND s.date <= CURRENT_DATE
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
        
        all_matches = [row_to_dict(m) for m in schedule_matches] + [row_to_dict(m) for m in ranking_matches]
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
                    WHEN player1_name = %s THEN player2_name
                    ELSE player1_name
                END as opponent
            FROM match_statistics
            WHERE player1_name = %s OR player2_name = %s
            UNION
            SELECT DISTINCT 
                CASE 
                    WHEN u1.short_name = %s THEN u2.short_name
                    ELSE u1.short_name
                END as opponent
            FROM ranking_matches rm
            JOIN users u1 ON rm.player1_id = u1.id
            JOIN users u2 ON rm.player2_id = u2.id
            WHERE rm.status = 'completed' AND (u1.short_name = %s OR u2.short_name = %s)
            ORDER BY opponent
        ''', (player_name, player_name, player_name, player_name, player_name, player_name)).fetchall()
        return jsonify({'opponents': [o['opponent'] for o in opponents]})
    except Exception as e:
        logger.error(f'Error fetching opponents: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@statistics_bp.route('/recent-results', methods=['GET'])
def get_recent_statistics_results():
    """Get recent match statistics results with audit log"""
    limit = request.args.get('limit', 20, type=int)
    db = get_db()
    try:
        results = db.execute('''
            SELECT ms.*, u.short_name as added_by_name, u.id as added_by_id
            FROM match_statistics ms
            LEFT JOIN users u ON ms.added_by = u.id
            ORDER BY ms.created_at DESC
            LIMIT %s
        ''', (limit,)).fetchall()
        return jsonify([dict(r) for r in results])
    except Exception as e:
        logger.error(f'Error fetching recent statistics results: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@statistics_bp.route('/general', methods=['GET'])
def get_general_statistics():
    """Get general statistics for all matches"""
    season_filter = request.args.get('season')
    db = get_db()
    try:
        # Handle virtual 'amistosos' season
        if season_filter == 'amistosos':
            schedule_matches = db.execute('SELECT * FROM match_statistics').fetchall()
            ranking_matches = []
        elif season_filter:
            # Specific ranking season
            schedule_matches = []
            ranking_matches = db.execute('''
                SELECT rm.played_at as match_date, u1.short_name as player1_name, 
                       u2.short_name as player2_name, uw.short_name as winner_name,
                       rm.sets_p1 as player1_sets, rm.sets_p2 as player2_sets,
                       rm.games_p1 as player1_games, rm.games_p2 as player2_games,
                       'Ranking' as match_type
                FROM ranking_matches rm
                JOIN users u1 ON rm.player1_id = u1.id
                JOIN users u2 ON rm.player2_id = u2.id
                JOIN users uw ON rm.winner_id = uw.id
                JOIN ranking_rounds rr ON rm.round_id = rr.id
                WHERE rm.status = 'completed' AND rr.season_id = %s
            ''', (season_filter,)).fetchall()
        else:
            # All matches
            schedule_matches = db.execute('SELECT * FROM match_statistics').fetchall()
            ranking_matches = db.execute('''
                SELECT rm.played_at as match_date, u1.short_name as player1_name, 
                       u2.short_name as player2_name, uw.short_name as winner_name,
                       rm.sets_p1 as player1_sets, rm.sets_p2 as player2_sets,
                       rm.games_p1 as player1_games, rm.games_p2 as player2_games,
                       'Ranking' as match_type
                FROM ranking_matches rm
                JOIN users u1 ON rm.player1_id = u1.id
                JOIN users u2 ON rm.player2_id = u2.id
                JOIN users uw ON rm.winner_id = uw.id
                WHERE rm.status = 'completed'
            ''').fetchall()
        
        all_matches = list(schedule_matches) + list(ranking_matches)
        
        if not all_matches:
            return jsonify({
                'total_matches': 0,
                'total_players': 0,
                'total_sets': 0,
                'total_games': 0,
                'super_tiebreaks': 0,
                'match_types': {},
                'top_players': []
            })
        
        players_stats = {}
        match_types = {}
        total_sets = 0
        total_games = 0
        super_tiebreaks = 0
        
        for match in all_matches:
            match_types[match['match_type']] = match_types.get(match['match_type'], 0) + 1
            total_sets += match['player1_sets'] + match['player2_sets']
            total_games += match['player1_games'] + match['player2_games']
            
            if match['player1_sets'] == match['player2_sets'] == 1:
                super_tiebreaks += 1
            
            for player in [match['player1_name'], match['player2_name']]:
                if player not in players_stats:
                    players_stats[player] = {'wins': 0, 'matches': 0, 'current_streak': 0, 'max_streak': 0}
                players_stats[player]['matches'] += 1
                if match['winner_name'] == player:
                    players_stats[player]['wins'] += 1
        
        for player in players_stats:
            player_matches = sorted(
                [m for m in all_matches if player in [m['player1_name'], m['player2_name']]],
                key=lambda x: str(x['match_date']) if x['match_date'] else '',
                reverse=True
            )
            current_streak = 0
            max_streak = 0
            for match in player_matches:
                if match['winner_name'] == player:
                    current_streak += 1
                    max_streak = max(max_streak, current_streak)
                else:
                    break
            players_stats[player]['current_streak'] = current_streak
            players_stats[player]['max_streak'] = max_streak
        
        top_players = sorted(
            [{'name': p, 'wins': s['wins'], 'matches': s['matches'], 
              'win_rate': (s['wins'] / s['matches'] * 100) if s['matches'] > 0 else 0}
             for p, s in players_stats.items()],
            key=lambda x: (x['wins'], x['win_rate']),
            reverse=True
        )[:5]
        
        top_streaks = sorted(
            [{'name': p, 'current_streak': s['current_streak'], 'max_streak': s['max_streak']}
             for p, s in players_stats.items()],
            key=lambda x: x['current_streak'],
            reverse=True
        )[:5]
        
        return jsonify({
            'total_matches': len(all_matches),
            'total_players': len(players_stats),
            'total_sets': total_sets,
            'total_games': total_games,
            'super_tiebreaks': super_tiebreaks,
            'match_types': match_types,
            'top_players': top_players,
            'top_streaks': top_streaks
        })
    except Exception as e:
        logger.error(f'Error fetching general statistics: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()
