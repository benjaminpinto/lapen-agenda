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
                WHERE user_id IN (SELECT id FROM users WHERE name LIKE ?)
            ''', (f'%{name}%',))
            bets_deleted = cursor.rowcount
            
            # Delete users with matching name
            cursor = db.execute('DELETE FROM users WHERE name LIKE ?', (f'%{name}%',))
            users_deleted = cursor.rowcount
            
            logger.info(f'Cleanup: deleted {users_deleted} users and {bets_deleted} bets with name "{name}"')
        else:
            # Delete bets for test users
            cursor = db.execute('''
                DELETE FROM bets 
                WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)
            ''', (f'{email_prefix}%',))
            bets_deleted = cursor.rowcount
            
            # Delete test users
            cursor = db.execute('DELETE FROM users WHERE email LIKE ?', (f'{email_prefix}%',))
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


@test_bp.route('/approve-lapen', methods=['POST'])
def approve_lapen_for_testing():
    """Approve LAPEN member for testing - only available in non-production"""
    if os.getenv('FLASK_ENV') == 'production':
        return jsonify({'error': 'Not available in production'}), 403
    
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'email required'}), 400
    
    db = get_db()
    try:
        from datetime import datetime
        
        cursor = db.execute('SELECT id FROM users WHERE email = ?', (email,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        db.execute('''
            UPDATE users
            SET lapen_approved = ?, lapen_approved_at = ?
            WHERE email = ?
        ''', (True, datetime.utcnow(), email))
        db.commit()
        
        logger.info(f'Test: LAPEN member approved for {email}')
        return jsonify({'success': True, 'message': 'LAPEN member approved'})
    
    except Exception as e:
        logger.error(f'Error approving LAPEN member: {str(e)}')
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()
