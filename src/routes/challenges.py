from datetime import datetime, date
from flask import Blueprint, request, jsonify
from src.auth import require_auth
from src.database import get_db
from src.logger import get_logger

logger = get_logger()
challenges_bp = Blueprint('challenges', __name__, url_prefix='/api/challenges')

@challenges_bp.route('/users', methods=['GET'])
@require_auth
def get_users_for_challenge():
    """Get list of users available to be challenged"""
    db = get_db()
    try:
        cursor = db.execute('''
            SELECT id, name, short_name 
            FROM users 
            WHERE deleted_at IS NULL
            ORDER BY name
        ''')
        users = cursor.fetchall()
        return jsonify(users)
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@challenges_bp.route('/create', methods=['POST'])
@require_auth
def create_challenge():
    """Create a new challenge"""
    data = request.get_json()
    challenger_id = request.user_id
    challenged_id = int(data.get('challenged_id'))
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    target_type = data.get('target_type')
    target_amount = data.get('target_amount') or None
    prize_comment = data.get('prize_comment')

    if not all([challenged_id, start_date, end_date, target_type]):
        return jsonify({'error': 'Missing required fields'}), 400

    if challenger_id == challenged_id:
        return jsonify({'error': 'Cannot challenge yourself'}), 400

    db = get_db()
    try:
        db.execute('''
            INSERT INTO challenges 
            (challenger_id, challenged_id, start_date, end_date, target_type, target_amount, prize_comment, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
        ''', (challenger_id, challenged_id, start_date, end_date, target_type, target_amount, prize_comment))
        db.commit()
        
        return jsonify({'message': 'Challenge created successfully'}), 201
    except Exception as e:
        logger.error(f"Error creating challenge: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@challenges_bp.route('/', methods=['GET'])
def get_challenges():
    """Get all challenges for the current user"""
    # Check if user is authenticated via cookie
    from flask import request as flask_request
    token = flask_request.cookies.get('access_token')
    user_id = None
    
    logger.info(f"Cookie token: {token[:50] if token else 'None'}...")
    
    if token:
        from src.auth import verify_token
        user_id = verify_token(token)
        logger.info(f"Verified user_id: {user_id}")
    
    db = get_db()
    try:
        if user_id:
            # Authenticated: show user's challenges
            logger.info(f"Fetching challenges for user_id: {user_id}")
            cursor = db.execute('''
                SELECT c.*, 
                       u1.name as challenger_name, u1.short_name as challenger_short_name,
                       u2.name as challenged_name, u2.short_name as challenged_short_name
                FROM challenges c
                JOIN users u1 ON c.challenger_id = u1.id AND u1.deleted_at IS NULL
                JOIN users u2 ON c.challenged_id = u2.id AND u2.deleted_at IS NULL
                WHERE (c.challenger_id = %s OR c.challenged_id = %s)
                ORDER BY c.created_at DESC
            ''', (user_id, user_id))
        else:
            # Public: show only active challenges
            cursor = db.execute('''
                SELECT c.*, 
                       u1.name as challenger_name, u1.short_name as challenger_short_name,
                       u2.name as challenged_name, u2.short_name as challenged_short_name
                FROM challenges c
                JOIN users u1 ON c.challenger_id = u1.id
                JOIN users u2 ON c.challenged_id = u2.id
                WHERE c.status = 'active'
                ORDER BY c.created_at DESC
            ''')
        
        challenges = cursor.fetchall()
        logger.info(f"Found {len(challenges)} challenges for user {user_id}")
        
        # Categorize challenges
        result = {
            'active': [],
            'pending_received': [],
            'pending_sent': [],
            'history': []
        }
        
        for c in challenges:
            # Format dates
            if isinstance(c['start_date'], date):
                c['start_date'] = c['start_date'].isoformat()
            if isinstance(c['end_date'], date):
                c['end_date'] = c['end_date'].isoformat()
            if isinstance(c['created_at'], datetime):
                c['created_at'] = c['created_at'].isoformat()

            # Add progress data if active
            if c['status'] == 'active':
                c['progress'] = get_challenge_progress(db, c)
                result['active'].append(c)
            elif c['status'] == 'pending' and user_id:
                if c['challenged_id'] == user_id:
                    result['pending_received'].append(c)
                else:
                    result['pending_sent'].append(c)
            elif c['status'] in ['rejected', 'completed', 'cancelled']:
                if c['status'] == 'completed':
                     c['progress'] = get_challenge_progress(db, c)
                result['history'].append(c)
                
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error fetching challenges: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@challenges_bp.route('/<int:challenge_id>/accept', methods=['POST'])
@require_auth
def accept_challenge(challenge_id):
    """Accept a challenge"""
    user_id = request.user_id
    db = get_db()
    try:
        # Verify user is the challenged one
        cursor = db.execute('SELECT challenged_id FROM challenges WHERE id = %s', (challenge_id,))
        challenge = cursor.fetchone()
        
        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404
            
        if challenge['challenged_id'] != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
            
        db.execute("UPDATE challenges SET status = 'active' WHERE id = %s", (challenge_id,))
        db.commit()
        
        return jsonify({'message': 'Challenge accepted'}), 200
    finally:
        db.close()

@challenges_bp.route('/<int:challenge_id>/reject', methods=['POST'])
@require_auth
def reject_challenge(challenge_id):
    """Reject a challenge"""
    user_id = request.user_id
    db = get_db()
    try:
        cursor = db.execute('SELECT challenged_id FROM challenges WHERE id = %s', (challenge_id,))
        challenge = cursor.fetchone()
        
        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404
            
        if challenge['challenged_id'] != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
            
        db.execute("UPDATE challenges SET status = 'rejected' WHERE id = %s", (challenge_id,))
        db.commit()
        
        return jsonify({'message': 'Challenge rejected'}), 200
    finally:
        db.close()
        
@challenges_bp.route('/<int:challenge_id>', methods=['DELETE'])
@require_auth
def delete_challenge(challenge_id):
    """Delete/Cancel a challenge (only by creator if pending, or admin?)"""
    user_id = request.user_id
    db = get_db()
    try:
        cursor = db.execute('SELECT challenger_id, status FROM challenges WHERE id = %s', (challenge_id,))
        challenge = cursor.fetchone()
        
        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404
            
        if challenge['challenger_id'] != user_id:
             return jsonify({'error': 'Unauthorized'}), 403
             
        if challenge['status'] != 'pending':
             return jsonify({'error': 'Cannot delete non-pending challenge'}), 400

        db.execute("UPDATE challenges SET status = 'cancelled' WHERE id = %s", (challenge_id,))
        # OR delete permanently: db.execute("DELETE FROM challenges WHERE id = %s", (challenge_id,))
        # Keeping it cancelled is better for history
        db.commit()
        
        return jsonify({'message': 'Challenge cancelled'}), 200
    finally:
        db.close()

def get_challenge_progress(db, challenge):
    """Calculate progress for a challenge based on match statistics"""
    try:
        # Query matches of type 'Amistoso' between the two players within the date range
        # Note: We need to check both (p1=challenger AND p2=challenged) OR (p1=challenged AND p2=challenger)
        # Assuming match_statistics_unified has detailed stats.
        # If match_statistics_unified doesn't have game counts separated by player, we might need to parse the score.
        # The schema shows 'score' text column, but also 'match_results' has details?
        # Let's check 'match_statistics_unified' schema again.
        # It has: player1_id, player2_id, winner_id, valid score text.
        # Wait, 'ranking_matches' has 'games_p1', 'games_p2', 'sets_p1', 'sets_p2'.
        # But 'Amistoso' matches might come from 'schedules' -> 'match_results'?
        # The prompt says "all matches of type 'Amistoso' will count".
        
        # Let's look at match_results. It has winner_name and score.
        # match_statistics_unified is a view or table? In the schema provided it's a TABLE.
        # But looking at 'add_match_statistics_postgres.sql' (implied name) or similar, it might be populated by triggers or manually.
        # I will use a robust query on 'match_statistics_unified' assuming it is kept up to date, 
        # OR I will query 'schedules' + 'match_results'.
        # Let's use 'match_statistics_unified' as it seems designed for this.
        # PROBLEM: match_statistics_unified might not track games/sets count numerically if it just has 'score' text.
        # Valid score format is usually "6/4 6/4". 
        
        # Current implementation of match_statistics_unified:
        # columns: schedule_id, player1_id, player2_id, winner_id, match_type, match_date, score
        
        query = '''
            SELECT player1_id, player2_id, winner_id, score 
            FROM match_statistics_unified
            WHERE match_type = 'Amistoso'
            AND match_date >= %s
            AND match_date <= %s
            AND (
                (player1_id = %s AND player2_id = %s) OR 
                (player1_id = %s AND player2_id = %s)
            )
        '''
        cursor = db.execute(query, (
            challenge['start_date'], challenge['end_date'],
            challenge['challenger_id'], challenge['challenged_id'],
            challenge['challenged_id'], challenge['challenger_id']
        ))
        matches = cursor.fetchall()
        
        challenger_stats = {'victories': 0, 'games': 0, 'sets': 0}
        challenged_stats = {'victories': 0, 'games': 0, 'sets': 0}
        
        for m in matches:
            # Determine who is who in this match
            p1_is_challenger = (m['player1_id'] == challenge['challenger_id'])
            
            # Victories
            if m['winner_id'] == challenge['challenger_id']:
                challenger_stats['victories'] += 1
            elif m['winner_id'] == challenge['challenged_id']:
                challenged_stats['victories'] += 1
                
            # Parse Score for Sets and Games
            # Score format assumption: "6-0 6-0" or "6/0 6/0" or "6/4 4/6 10/7"
            score = m['score']
            if score:
                try:
                    sets = score.replace(',', ' ').split()
                    for s in sets:
                        # Clean string
                        s = s.strip()
                        if not s: continue
                        
                        # Handle tiebreak format if needed, e.g. 7-6(4)
                        # Simplified parsing: look for "/" or "-"
                        if '/' in s:
                            parts = s.split('/')
                        elif '-' in s:
                            parts = s.split('-')
                        else:
                            continue # Unknown format
                            
                        if len(parts) >= 2:
                            # Remove potential tiebreak info like (7)
                            g1_str = ''.join([c for c in parts[0] if c.isdigit()])
                            g2_str = ''.join([c for c in parts[1] if c.isdigit()])
                            
                            if g1_str and g2_str:
                                g1 = int(g1_str)
                                g2 = int(g2_str)
                                
                                # Assign to correct player
                                if p1_is_challenger:
                                    challenger_stats['games'] += g1
                                    challenged_stats['games'] += g2
                                    if g1 > g2: challenger_stats['sets'] += 1
                                    elif g2 > g1: challenged_stats['sets'] += 1
                                else:
                                    challenger_stats['games'] += g2
                                    challenged_stats['games'] += g1
                                    if g2 > g1: challenger_stats['sets'] += 1
                                    elif g1 > g2: challenged_stats['sets'] += 1
                except Exception as e:
                    logger.error(f"Error parsing score '{score}': {e}")
                    
        # Calculate final metric based on target_type
        # But we return all stats so UI can display breakdown
        
        return {
            'challenger': challenger_stats,
            'challenged': challenged_stats,
            'matches_played': len(matches)
        }

    except Exception as e:
        logger.error(f"Error calculating progress: {e}")
        return None
