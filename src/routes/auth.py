from flask import Blueprint, request, jsonify
from src.database import get_db
from src.auth import hash_password, verify_password, generate_token, generate_verification_token, require_auth, get_user_by_email, get_user_by_id
from src.email_service import send_verification_email
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
        
        cursor = db.execute(
            'INSERT INTO users (email, password_hash, name, phone, verification_token) VALUES (?, ?, ?, ?, ?)',
            (email, password_hash, name, phone, verification_token)
        )
        db.commit()
        
        user_id = cursor.lastrowid
        token = generate_token(user_id)
        
        logger.info(f'User registered: email={email}, user_id={user_id}')
        
        # Send verification email
        try:
            email_sent = send_verification_email(email, name, verification_token)
            logger.info(f'Verification email sent to {email}: {email_sent}')
        except Exception as e:
            logger.error(f'Email sending failed for {email}: {e}')
        
        return jsonify({
            'message': 'Usuário cadastrado com sucesso',
            'token': token,
            'user': {
                'id': user_id,
                'email': email,
                'name': name,
                'phone': phone,
                'is_verified': False
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': 'Falha no cadastro'}), 500
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
    
    return jsonify({
        'message': 'Login realizado com sucesso',
        'token': token,
        'user': {
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'phone': user['phone'],
            'is_verified': user['is_verified']
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
        
        return jsonify({'message': 'Email verificado com sucesso'})
        
    except Exception as e:
        return jsonify({'error': 'Falha na verificação'}), 500
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
        
        return jsonify({'message': 'Senha alterada com sucesso'})
        
    except Exception as e:
        return jsonify({'error': 'Falha ao alterar senha'}), 500
    finally:
        db.close()