from flask import Blueprint, request, jsonify
from src.auth import require_auth
from src.database import get_db
from src.utils.score_parser import parse_score
from src.logger import get_logger

logger = get_logger()
statistics_bp = Blueprint('statistics', __name__, url_prefix='/api/statistics')

@statistics_bp.route('/match-result', methods=['POST'])
@require_auth
def add_match_result():
    data = request.get_json()
    schedule_id = data.get('schedule_id')
    ranking_match_id = data.get('ranking_match_id')
    winner_name = data.get('winner_name')
    score = data.get('score')
    
    if not winner_name or not score or (not schedule_id and not ranking_match_id):
        return jsonify({'error': 'Dados incompletos'}), 400
    
    db = get_db()
    try:
        if schedule_id:
            schedule = db.execute('SELECT * FROM schedules WHERE id = %s', (schedule_id,)).fetchone()
            if not schedule:
                return jsonify({'error': 'Partida não encontrada'}), 404
            
            p1 = schedule['player1_name']
            p2 = schedule['player2_name']
            match_type = schedule['match_type']
            match_date = schedule['date']
            season_id = None
        else:
            match = db.execute('''
                SELECT rm.*, u1.short_name as p1, u2.short_name as p2, rr.season_id
                FROM ranking_matches rm
                JOIN users u1 ON rm.player1_id = u1.id
                JOIN users u2 ON rm.player2_id = u2.id
                JOIN ranking_rounds rr ON rm.round_id = rr.id
                WHERE rm.id = %s
            ''', (ranking_match_id,)).fetchone()
            
            if not match:
                return jsonify({'error': 'Partida não encontrada'}), 404
            
            p1 = match['p1']
            p2 = match['p2']
            match_type = 'Ranking'
            match_date = match.get('played_at') or match.get('created_at')
            season_id = match['season_id']
            
            winner_id = match['player1_id'] if winner_name == p1 else match['player2_id']
            parsed = parse_score(score)
            
            from src.services.points_calculator import PointsCalculator
            match_result = {
                'wo_type': 'none',
                'sets_winner': max(parsed['p1_sets'], parsed['p2_sets']),
                'sets_loser': min(parsed['p1_sets'], parsed['p2_sets']),
                'games_winner': parsed['p1_games'] if winner_id == match['player1_id'] else parsed['p2_games'],
                'games_loser': parsed['p2_games'] if winner_id == match['player1_id'] else parsed['p1_games']
            }
            winner_points, loser_points = PointsCalculator.calculate(match_result, season_id)
            
            db.execute('''
                UPDATE ranking_matches
                SET status = 'completed', winner_id = %s, score = %s, played_at = NOW(), added_by = %s
                WHERE id = %s
            ''', (winner_id, score, request.user_id, ranking_match_id))
            
            for player_id, is_winner, points in [
                (match['player1_id'], winner_id == match['player1_id'], winner_points if winner_id == match['player1_id'] else loser_points),
                (match['player2_id'], winner_id == match['player2_id'], winner_points if winner_id == match['player2_id'] else loser_points)
            ]:
                db.execute('''
                    UPDATE ranking_participants
                    SET total_points = total_points + %s, wins = wins + %s, losses = losses + %s
                    WHERE season_id = %s AND user_id = %s
                ''', (points, 1 if is_winner else 0, 0 if is_winner else 1, season_id, player_id))
        
        p1_user = db.execute('SELECT id FROM users WHERE LOWER(short_name) = LOWER(%s) OR LOWER(name) = LOWER(%s)', (p1, p1)).fetchone()
        p2_user = db.execute('SELECT id FROM users WHERE LOWER(short_name) = LOWER(%s) OR LOWER(name) = LOWER(%s)', (p2, p2)).fetchone()
        winner_user = db.execute('SELECT id FROM users WHERE LOWER(short_name) = LOWER(%s) OR LOWER(name) = LOWER(%s)', (winner_name, winner_name)).fetchone()
        
        db.execute('''
            INSERT INTO match_statistics_unified (
                schedule_id, ranking_match_id, player1_id, player2_id,
                player1_name, player2_name, winner_id, winner_name,
                score, match_type, match_date, season_id, added_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            schedule_id, ranking_match_id,
            p1_user['id'] if p1_user else None, p2_user['id'] if p2_user else None,
            p1, p2,
            winner_user['id'] if winner_user else None, winner_name,
            score, match_type, match_date, season_id, request.user_id
        ))
        
        db.commit()
        return jsonify({'message': 'Resultado adicionado com sucesso'}), 201
    except Exception as e:
        logger.error(f'Error adding match result: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@statistics_bp.route('/player', methods=['GET'])
def get_player_statistics():
    player1 = request.args.get('player1')
    player2 = request.args.get('player2')
    match_type = request.args.get('match_type')
    
    if not player1:
        return jsonify({'error': 'Jogador obrigatório'}), 400
    
    db = get_db()
    
    # Get player IDs from names
    p1_user = db.execute('SELECT id, short_name FROM users WHERE LOWER(short_name) = LOWER(%s) OR LOWER(name) = LOWER(%s)', (player1, player1)).fetchone()
    if not p1_user:
        return jsonify({'error': 'Jogador não encontrado'}), 404
    
    conditions = ['(m.player1_id = %s OR m.player2_id = %s)']
    params = [p1_user['id'], p1_user['id']]
    
    if player2:
        p2_user = db.execute('SELECT id FROM users WHERE LOWER(short_name) = LOWER(%s) OR LOWER(name) = LOWER(%s)', (player2, player2)).fetchone()
        if p2_user:
            conditions.append('((m.player1_id = %s AND m.player2_id = %s) OR (m.player1_id = %s AND m.player2_id = %s))')
            params.extend([p1_user['id'], p2_user['id'], p2_user['id'], p1_user['id']])
    
    if match_type:
        conditions.append('m.match_type = %s')
        params.append(match_type)
    
    matches = db.execute(f'''
        SELECT m.*, u1.short_name as current_player1_name, u2.short_name as current_player2_name
        FROM match_statistics_unified m
        LEFT JOIN users u1 ON m.player1_id = u1.id
        LEFT JOIN users u2 ON m.player2_id = u2.id
        WHERE {" AND ".join(conditions)} 
        ORDER BY m.match_date DESC
    ''', params).fetchall()
    
    stats = {
        'total_matches': len(matches),
        'wins': sum(1 for m in matches if m['winner_id'] == p1_user['id']),
        'losses': len(matches) - sum(1 for m in matches if m['winner_id'] == p1_user['id']),
        'matches': []
    }
    
    sets_won = sets_lost = games_won = games_lost = 0
    for match in matches:
        parsed = parse_score(match['score'])
        is_p1 = match['player1_id'] == p1_user['id']
        
        sets_won += parsed['p1_sets'] if is_p1 else parsed['p2_sets']
        sets_lost += parsed['p2_sets'] if is_p1 else parsed['p1_sets']
        games_won += parsed['p1_games'] if is_p1 else parsed['p2_games']
        games_lost += parsed['p2_games'] if is_p1 else parsed['p1_games']
        
        stats['matches'].append({
            'player1_name': match.get('current_player1_name') or match['player1_name'],
            'player2_name': match.get('current_player2_name') or match['player2_name'],
            'winner_name': match['winner_name'],
            'score': match['score'],
            'match_type': match['match_type'],
            'match_date': match['match_date'],
            'player1_sets': parsed['p1_sets'],
            'player2_sets': parsed['p2_sets'],
            'player1_games': parsed['p1_games'],
            'player2_games': parsed['p2_games']
        })
    
    stats.update({
        'sets_won': sets_won,
        'sets_lost': sets_lost,
        'games_won': games_won,
        'games_lost': games_lost
    })
    
    if player2 and p2_user:
        stats['head_to_head'] = {
            'player1': p1_user['short_name'],
            'player2': p2_user['short_name'] if 'short_name' in p2_user else player2,
            'player1_wins': sum(1 for m in matches if m['winner_id'] == p1_user['id']),
            'player2_wins': sum(1 for m in matches if m['winner_id'] == p2_user['id'])
        }
    
    db.close()
    return jsonify(stats)

@statistics_bp.route('/past-matches', methods=['GET'])
def get_past_matches():
    db = get_db()
    try:
        schedule_matches = db.execute('''
            SELECT s.id, s.date, s.start_time, s.player1_name, s.player2_name, s.match_type
            FROM schedules s
            LEFT JOIN match_statistics_unified mr ON s.id = mr.schedule_id
            WHERE s.deleted_at IS NULL AND mr.id IS NULL AND s.date <= CURRENT_DATE
            ORDER BY s.date DESC, s.start_time DESC
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
        
        all_matches = []
        for m in schedule_matches:
            match_dict = dict(m)
            if match_dict.get('start_time'):
                match_dict['start_time'] = str(match_dict['start_time'])
            all_matches.append(match_dict)
        for m in ranking_matches:
            all_matches.append(dict(m))
        return jsonify({'matches': all_matches})
    finally:
        db.close()

@statistics_bp.route('/players', methods=['GET'])
def get_all_players():
    db = get_db()
    # Only show registered users (with IDs), exclude guests
    players = db.execute('''
        SELECT DISTINCT u.short_name as name 
        FROM match_statistics_unified m
        JOIN users u ON (m.player1_id = u.id OR m.player2_id = u.id)
        ORDER BY u.short_name
    ''').fetchall()
    db.close()
    return jsonify({'players': [p['name'] for p in players]})

@statistics_bp.route('/opponents/<player_name>', methods=['GET'])
def get_player_opponents(player_name):
    db = get_db()
    logger.info(f'Fetching opponents for player: {player_name}')
    
    player = db.execute('''
        SELECT id FROM users 
        WHERE unaccent(LOWER(TRIM(short_name))) = unaccent(LOWER(TRIM(%s))) 
           OR unaccent(LOWER(TRIM(name))) = unaccent(LOWER(TRIM(%s)))
    ''', (player_name, player_name)).fetchone()
    if not player:
        logger.info(f'Player not found: {player_name}')
        db.close()
        return jsonify({'opponents': []})
    
    opponents = db.execute('''
        SELECT DISTINCT u.short_name as opponent
        FROM match_statistics_unified m
        JOIN users u ON (CASE WHEN m.player1_id = %s THEN m.player2_id ELSE m.player1_id END) = u.id
        WHERE (m.player1_id = %s OR m.player2_id = %s) AND u.id IS NOT NULL
        ORDER BY u.short_name
    ''', (player['id'], player['id'], player['id'])).fetchall()
    logger.info(f'Found {len(opponents)} registered opponents')
    db.close()
    return jsonify({'opponents': [o['opponent'] for o in opponents]})

@statistics_bp.route('/recent-results', methods=['GET'])
def get_recent_statistics_results():
    limit = request.args.get('limit', 20, type=int)
    db = get_db()
    results = db.execute('''
        SELECT mr.*, u.short_name as added_by_name
        FROM match_statistics_unified mr
        LEFT JOIN users u ON mr.added_by = u.id
        ORDER BY mr.created_at DESC
        LIMIT %s
    ''', (limit,)).fetchall()
    db.close()
    return jsonify([dict(r) for r in results])

@statistics_bp.route('/general', methods=['GET'])
def get_general_statistics():
    season_filter = request.args.get('season')
    db = get_db()
    
    conditions = []
    params = []
    
    if season_filter == 'amistosos':
        conditions.append("match_type != 'Ranking'")
    elif season_filter:
        conditions.append('season_id = %s')
        params.append(season_filter)
    
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    
    matches = db.execute(f'SELECT * FROM match_statistics_unified {where_clause}', params).fetchall()
    
    if not matches:
        return jsonify({
            'total_matches': 0, 'total_players': 0, 'total_sets': 0,
            'total_games': 0, 'super_tiebreaks': 0, 'match_types': {},
            'top_players': [], 'top_streaks': []
        })
    
    players_stats = {}
    match_types = {}
    total_sets = total_games = super_tiebreaks = 0
    
    for match in matches:
        parsed = parse_score(match['score'])
        total_sets += parsed['p1_sets'] + parsed['p2_sets']
        total_games += parsed['p1_games'] + parsed['p2_games']
        
        if parsed['p1_sets'] == parsed['p2_sets'] == 1:
            super_tiebreaks += 1
        
        match_types[match['match_type']] = match_types.get(match['match_type'], 0) + 1
        
        # Only count registered users (with IDs), skip guests
        for player_id, player_name in [(match['player1_id'], match['player1_name']), (match['player2_id'], match['player2_name'])]:
            if player_id:  # Skip guests (NULL IDs)
                if player_id not in players_stats:
                    players_stats[player_id] = {'name': player_name, 'wins': 0, 'matches': 0, 'current_streak': 0}
                players_stats[player_id]['matches'] += 1
                if match['winner_id'] == player_id:
                    players_stats[player_id]['wins'] += 1
    
    for player_id in players_stats:
        player_matches = sorted(
            [m for m in matches if player_id in [m['player1_id'], m['player2_id']]],
            key=lambda x: x['match_date'],
            reverse=True
        )
        streak = 0
        for match in player_matches:
            if match['winner_id'] == player_id:
                streak += 1
            else:
                break
        players_stats[player_id]['current_streak'] = streak
    
    top_players = sorted(
        [{'name': s['name'], 'wins': s['wins'], 'matches': s['matches'],
          'win_rate': (s['wins'] / s['matches'] * 100) if s['matches'] > 0 else 0}
         for s in players_stats.values()],
        key=lambda x: (x['wins'], x['win_rate']),
        reverse=True
    )[:5]
    
    top_streaks = sorted(
        [{'name': s['name'], 'current_streak': s['current_streak'], 'max_streak': s['current_streak']}
         for s in players_stats.values()],
        key=lambda x: x['current_streak'],
        reverse=True
    )[:5]
    
    db.close()
    return jsonify({
        'total_matches': len(matches),
        'total_players': len(players_stats),
        'total_sets': total_sets,
        'total_games': total_games,
        'super_tiebreaks': super_tiebreaks,
        'match_types': match_types,
        'top_players': top_players,
        'top_streaks': top_streaks
    })
