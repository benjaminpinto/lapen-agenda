import secrets
from datetime import datetime, timedelta
from functools import wraps

import bcrypt
import jwt
from flask import request, jsonify, current_app

from src.database import get_db


def hash_password(password):
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def generate_token(user_id):
    """Generate JWT token for user (deprecated - use generate_tokens)"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')

def generate_tokens(user_id, remember_me=False):
    """Generate access and refresh tokens"""
    access_payload = {
        'user_id': user_id,
        'type': 'access',
        'exp': datetime.utcnow() + timedelta(minutes=15)
    }
    access_token = jwt.encode(access_payload, current_app.config['SECRET_KEY'], algorithm='HS256')
    
    refresh_expiry = timedelta(days=30 if remember_me else 7)
    refresh_payload = {
        'user_id': user_id,
        'type': 'refresh',
        'exp': datetime.utcnow() + refresh_expiry
    }
    refresh_token = jwt.encode(refresh_payload, current_app.config['SECRET_KEY'], algorithm='HS256')
    
    db = get_db()
    try:
        # Delete existing refresh tokens for this user to avoid duplicates
        db.execute('DELETE FROM refresh_tokens WHERE user_id = %s', (user_id,))
        db.execute(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)',
            (user_id, refresh_token, datetime.utcnow() + refresh_expiry)
        )
        db.commit()
    finally:
        db.close()
    
    return access_token, refresh_token

def verify_refresh_token(token):
    """Verify refresh token and check if revoked"""
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        if payload.get('type') != 'refresh':
            return None
        
        db = get_db()
        try:
            cursor = db.execute('SELECT revoked FROM refresh_tokens WHERE token = %s', (token,))
            result = cursor.fetchone()
            if not result or result['revoked']:
                return None
            return payload['user_id']
        finally:
            db.close()
    except:
        return None

def revoke_refresh_token(token):
    """Revoke a refresh token"""
    db = get_db()
    try:
        db.execute('UPDATE refresh_tokens SET revoked = TRUE WHERE token = %s', (token,))
        db.commit()
    finally:
        db.close()

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
        token = request.cookies.get('access_token')
        if not token:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header[7:]
        
        if not token:
            return jsonify({'error': 'No token provided'}), 401
        
        user_id = verify_token(token)
        if not user_id:
            refresh_token = request.cookies.get('refresh_token')
            if refresh_token and verify_refresh_token(refresh_token):
                return jsonify({'error': 'Token expired', 'refresh': True}), 401
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        request.user_id = user_id
        return f(*args, **kwargs)
    
    return decorated_function

def require_approved_lapen_member(f):
    """Decorator to require approved LAPEN member"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.cookies.get('access_token')
        if not token:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header[7:]
        
        if not token:
            return jsonify({'error': 'Autenticação necessária'}), 401
        
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
        cursor = db.execute('SELECT id, email, name, short_name, phone, pix_key, is_verified, is_lapen_member, lapen_approved, lapen_requested_at, lapen_approved_at, is_admin FROM users WHERE id = %s AND deleted_at IS NULL', (user_id,))
        user = cursor.fetchone()
        return dict(user) if user else None
    finally:
        db.close()

def get_user_by_email(email):
    """Get user by email"""
    db = get_db()
    try:
        cursor = db.execute('SELECT * FROM users WHERE email = %s AND deleted_at IS NULL', (email,))
        user = cursor.fetchone()
        return dict(user) if user else None
    finally:
        db.close()