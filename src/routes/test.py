from flask import Blueprint, request, jsonify
from src.database import get_db
from src.logger import get_logger
import os

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
