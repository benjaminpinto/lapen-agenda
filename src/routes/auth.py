from flask import Blueprint, request, jsonify
from src.database import get_db
from src.auth import hash_password, verify_password, generate_token, generate_verification_token, require_auth, get_user_by_email, get_user_by_id
from src.email_service import send_verification_email, send_lapen_approval_request_email
from src.logger import get_logger
import re

logger = get_logger()

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['email', 'password', 'name']
    for field in required_fields:
        if not data.get(field):
            field_names = {'email': 'Email', 'password': 'Senha', 'name': 'Nome'}
            return jsonify({'error': f'{field_names.get(field, field)} é obrigatório'}), 400
    
    email = data['email'].lower().strip()
    password = data['password']
    name = data['name'].strip()
    phone = data.get('phone', '').strip()
    pix_key = data.get('pix_key', '').strip()
    is_lapen_member = data.get('is_lapen_member', False)
    
    # Validate email format
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        return jsonify({'error': 'Formato de email inválido'}), 400
    
    # Validate password strength
    if len(password) < 6:
        return jsonify({'error': 'A senha deve ter pelo menos 6 caracteres'}), 400
    
    # Check if user already exists
    if get_user_by_email(email):
        return jsonify({'error': 'Email já cadastrado'}), 400
    
    # Create user
    db = get_db()
    try:
        password_hash = hash_password(password)
        verification_token = generate_verification_token()
        
        from datetime import datetime
        lapen_requested_at = datetime.utcnow() if is_lapen_member else None
        
        cursor = db.execute(
            'INSERT INTO users (email, password_hash, name, phone, pix_key, verification_token, is_lapen_member, lapen_requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (email, password_hash, name, phone, pix_key, verification_token, is_lapen_member, lapen_requested_at)
        )
        db.commit()
        
        user_id = cursor.lastrowid
        if not user_id:
            cursor = db.execute('SELECT id FROM users WHERE email = ?', (email,))
            user = cursor.fetchone()
            user_id = user['id'] if user else None
            if not user_id:
                raise Exception('Failed to retrieve user ID after registration')
        token = generate_token(user_id)
        
        logger.info(f'User registered: email={email}, user_id={user_id}')
        
        # Send verification email
        try:
            email_sent = send_verification_email(email, name, verification_token)
            logger.info(f'Verification email sent to {email}: {email_sent}')
        except Exception as e:
            logger.error(f'Email sending failed for {email}: {e}')
        
        # Send admin notification if user requested LAPEN membership
        if is_lapen_member:
            try:
                admin_notified = send_lapen_approval_request_email(email, name, phone)
                logger.info(f'Admin notification sent for LAPEN request from {email}: {admin_notified}')
            except Exception as e:
                logger.error(f'Admin notification failed for {email}: {e}')
        
        message = 'Usuário cadastrado com sucesso'
        if is_lapen_member:
            message += '. Sua solicitação de membro LAPEN está pendente de aprovação.'
        
        return jsonify({
            'message': message,
            'token': token,
            'user': {
                'id': user_id,
                'email': email,
                'name': name,
                'phone': phone,
                'is_verified': False,
                'is_lapen_member': is_lapen_member,
                'lapen_approved': False
            }
        }), 201
        
    except Exception as e:
        logger.error(f'Error registering user {email}: {str(e)}')
        return jsonify({'error': f'Falha no cadastro: {str(e)}'}), 500
    finally:
        db.close()

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email e senha são obrigatórios'}), 400
    
    email = data['email'].lower().strip()
    password = data['password']
    
    user = get_user_by_email(email)
    if not user or not verify_password(password, user['password_hash']):
        logger.warning(f'Login failed for email: {email}')
        return jsonify({'error': 'Email ou senha inválidos'}), 401
    
    logger.info(f'User logged in: email={email}, user_id={user["id"]}')
    token = generate_token(user['id'])
    
    logger.info(f'User login successful: {email}')
    return jsonify({
        'message': 'Login realizado com sucesso',
        'token': token,
        'user': {
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'phone': user['phone'],
            'is_verified': user['is_verified'],
            'is_lapen_member': user.get('is_lapen_member', False),
            'lapen_approved': user.get('lapen_approved', False)
        }
    })

@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_current_user():
    user = get_user_by_id(request.user_id)
    if not user:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    
    return jsonify({'user': user})

@auth_bp.route('/verify', methods=['POST'])
def verify_email():
    data = request.get_json()
    token = data.get('token')
    
    if not token:
        return jsonify({'error': 'Token de verificação é obrigatório'}), 400
    
    db = get_db()
    try:
        cursor = db.execute('SELECT id FROM users WHERE verification_token = ?', (token,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'Token de verificação inválido'}), 400
        
        db.execute('UPDATE users SET is_verified = ?, verification_token = NULL WHERE id = ?', 
                  (True, user['id']))
        db.commit()
        
        logger.info(f'Email verified for user {user["id"]}')
        return jsonify({'message': 'Email verificado com sucesso'})
        
    except Exception as e:
        logger.error(f'Error verifying email with token {token}: {str(e)}')
        return jsonify({'error': f'Falha na verificação: {str(e)}'}), 500
    finally:
        db.close()

@auth_bp.route('/change-password', methods=['POST'])
@require_auth
def change_password():
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({'error': 'Senha atual e nova senha são obrigatórias'}), 400
    
    if len(new_password) < 6:
        return jsonify({'error': 'A nova senha deve ter pelo menos 6 caracteres'}), 400
    
    user = get_user_by_id(request.user_id)
    if not user or not verify_password(current_password, user['password_hash']):
        return jsonify({'error': 'Senha atual incorreta'}), 400
    
    db = get_db()
    try:
        new_password_hash = hash_password(new_password)
        db.execute('UPDATE users SET password_hash = ? WHERE id = ?', 
                  (new_password_hash, request.user_id))
        db.commit()
        
        logger.info(f'Password changed for user {request.user_id}')
        return jsonify({'message': 'Senha alterada com sucesso'})
        
    except Exception as e:
        logger.error(f'Error changing password for user {request.user_id}: {str(e)}')
        return jsonify({'error': f'Falha ao alterar senha: {str(e)}'}), 500
    finally:
        db.close()

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    from src.email_service import send_password_reset_email
    from datetime import datetime, timedelta
    
    data = request.get_json()
    email = data.get('email', '').lower().strip()
    
    if not email:
        return jsonify({'error': 'Email é obrigatório'}), 400
    
    user = get_user_by_email(email)
    if not user:
        return jsonify({'message': 'Se o email existir, um link de recuperação será enviado'}), 200
    
    db = get_db()
    try:
        reset_token = generate_verification_token()
        reset_expires = datetime.utcnow() + timedelta(hours=1)
        
        db.execute('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
                  (reset_token, reset_expires, user['id']))
        db.commit()
        
        send_password_reset_email(email, user['name'], reset_token)
        logger.info(f'Password reset requested for {email}')
        
        return jsonify({'message': 'Se o email existir, um link de recuperação será enviado'}), 200
    except Exception as e:
        logger.error(f'Error in forgot password for {email}: {str(e)}')
        return jsonify({'error': 'Erro ao processar solicitação'}), 500
    finally:
        db.close()

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    from datetime import datetime
    
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('password')
    
    if not token or not new_password:
        return jsonify({'error': 'Token e senha são obrigatórios'}), 400
    
    if len(new_password) < 6:
        return jsonify({'error': 'A senha deve ter pelo menos 6 caracteres'}), 400
    
    db = get_db()
    try:
        cursor = db.execute('SELECT id, reset_token_expires FROM users WHERE reset_token = ?', (token,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'Token inválido'}), 400
        
        expires = user['reset_token_expires']
        if isinstance(expires, str):
            expires = datetime.fromisoformat(expires.replace('Z', '+00:00'))
        
        if datetime.utcnow() > expires:
            return jsonify({'error': 'Token expirado'}), 400
        
        new_password_hash = hash_password(new_password)
        db.execute('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
                  (new_password_hash, user['id']))
        db.commit()
        
        logger.info(f'Password reset successful for user {user["id"]}')
        return jsonify({'message': 'Senha redefinida com sucesso'}), 200
    except Exception as e:
        logger.error(f'Error resetting password: {str(e)}')
        return jsonify({'error': 'Erro ao redefinir senha'}), 500
    finally:
        db.close()