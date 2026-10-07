import hmac
import os
import re

from flask import Blueprint, request, jsonify

from src.database import get_db
from src.logger import get_logger
from src.services import tournament_seed
from src.services.tournament_service import TournamentError

logger = get_logger()

test_bp = Blueprint('test', __name__, url_prefix='/api/test')


@test_bp.route('/cleanup', methods=['DELETE'])
def cleanup_test_data():
    """Delete test data by email prefix or name - only available in non-production"""
    if os.getenv('FLASK_ENV') == 'production':
        return jsonify({'error': 'Not available in production'}), 403
    
    email_prefix = request.args.get('email_prefix', '')
    name = request.args.get('name', '')
    
    if not email_prefix and not name:
        return jsonify({'error': 'email_prefix or name required'}), 400
    
    db = get_db()
    try:
        if name:
            # Delete bets for users with matching name
            cursor = db.execute('''
                DELETE FROM bets 
                WHERE user_id IN (SELECT id FROM users WHERE name LIKE %s)
            ''', (f'%{name}%',))
            bets_deleted = cursor.rowcount
            
            # Delete users with matching name
            cursor = db.execute('DELETE FROM users WHERE name LIKE %s', (f'%{name}%',))
            users_deleted = cursor.rowcount
            
            logger.info(f'Cleanup: deleted {users_deleted} users and {bets_deleted} bets with name "{name}"')
        else:
            # Delete bets for test users
            cursor = db.execute('''
                DELETE FROM bets 
                WHERE user_id IN (SELECT id FROM users WHERE email LIKE %s)
            ''', (f'{email_prefix}%',))
            bets_deleted = cursor.rowcount
            
            # Delete test users
            cursor = db.execute('DELETE FROM users WHERE email LIKE %s', (f'{email_prefix}%',))
            users_deleted = cursor.rowcount
            
            logger.info(f'Cleanup: deleted {users_deleted} users and {bets_deleted} bets with prefix "{email_prefix}"')
        
        db.commit()
        
        return jsonify({
            'message': 'Test data cleaned up',
            'users_deleted': users_deleted,
            'bets_deleted': bets_deleted
        })
    
    except Exception as e:
        logger.error(f'Error cleaning up test data: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


# --- tournament fixtures ------------------------------------------------------------------------------------------
# These can create admin users and rewrite tournaments, and end-to-end tests run against preview deployments, so beyond
# "not production" they need a shared secret: E2E_TEST_SECRET in the environment and the same value in X-Test-Secret.

def _forbidden():
    if os.getenv('FLASK_ENV') == 'production':
        return jsonify({'error': 'Not available in production'}), 403
    secret = os.getenv('E2E_TEST_SECRET')
    if not secret or not hmac.compare_digest(request.headers.get('X-Test-Secret', ''), secret):
        return jsonify({'error': 'Forbidden'}), 403
    return None


@test_bp.route('/tournaments/seed', methods=['POST'])
def seed_tournament():
    """Create (or recreate) a tournament in a known state: registration_open, before_draw, before_schedule (draw
    published, no sessions yet), groups_in_progress (scheduled and published), tie_pending, knockout_in_progress
    or finished."""
    denied = _forbidden()
    if denied:
        return denied
    data = request.get_json(silent=True) or {}
    try:
        with get_db() as db:
            result = tournament_seed.seed_tournament(db, data.get('state'), data.get('slug'))
            db.commit()
        return jsonify(result), 201
    except TournamentError as exc:
        return jsonify({'error': exc.message, 'code': exc.code}), exc.status_code


@test_bp.route('/tournaments/cleanup', methods=['DELETE'])
def cleanup_tournaments():
    """Delete the tournaments whose slug starts with the prefix (it must start with "e2e-") and the test users."""
    denied = _forbidden()
    if denied:
        return denied
    prefix = request.args.get('prefix', 'e2e-')
    if not prefix.startswith('e2e-'):
        return jsonify({'error': 'O prefixo deve começar com "e2e-".'}), 400
    with get_db() as db:
        removed = tournament_seed.cleanup(db, prefix)
        db.commit()
    return jsonify(removed)


@test_bp.route('/users', methods=['POST'])
def create_test_user():
    """A verified user for logging in during end-to-end tests. The random password comes back in the response."""
    denied = _forbidden()
    if denied:
        return denied
    data = request.get_json(silent=True) or {}
    label = str(data.get('label', ''))
    if not re.fullmatch(r'[a-z0-9-]{1,40}', label):
        return jsonify({'error': 'label deve ter letras minúsculas, números e hífens.'}), 400
    with get_db() as db:
        user = tournament_seed.create_user(db, label, bool(data.get('is_admin')), bool(data.get('is_lapen_member')), bool(data.get('lapen_approved')))
        db.commit()
    return jsonify(user), 201
