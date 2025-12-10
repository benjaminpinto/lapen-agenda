import jwt
import bcrypt
import secrets
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, current_app
from src.database import get_db

def hash_password(password):
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def generate_token(user_id):
    """Generate JWT token for user"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')

def verify_token(token):
    """Verify JWT token and return user_id"""
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def generate_verification_token():
    """Generate random verification token"""
    return secrets.token_urlsafe(32)

def require_auth(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'No token provided'}), 401
        
        if token.startswith('Bearer '):
            token = token[7:]
        
        user_id = verify_token(token)
        if not user_id:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Add user to request context
        request.user_id = user_id
        return f(*args, **kwargs)
    
    return decorated_function

def require_approved_lapen_member(f):
    """Decorator to require approved LAPEN member"""
    @wraps(f)
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
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        if not user.get('is_lapen_member'):
            return jsonify({'error': 'Apenas membros LAPEN podem realizar esta ação'}), 403
        
        if not user.get('lapen_approved'):
            return jsonify({'error': 'Sua solicitação de membro LAPEN está pendente de aprovação'}), 403
        
        request.user_id = user_id
        return f(*args, **kwargs)
    
    return decorated_function

def get_user_by_id(user_id):
    """Get user by ID"""
    db = get_db()
    try:
        cursor = db.execute('SELECT id, email, name, short_name, phone, pix_key, is_verified, is_lapen_member, lapen_approved, lapen_requested_at, lapen_approved_at, is_admin FROM users WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        return dict(user) if user else None
    finally:
        db.close()

def get_user_by_email(email):
    """Get user by email"""
    db = get_db()
    try:
        cursor = db.execute('SELECT * FROM users WHERE email = %s', (email,))
        user = cursor.fetchone()
        return dict(user) if user else None
    finally:
        db.close()