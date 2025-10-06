import os
from flask_mail import Mail, Message
from flask import current_app

def init_mail(app):
    """Initialize Flask-Mail with app configuration"""
    app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
    app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'true').lower() == 'true'
    app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
    app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
    app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER') or os.environ.get('MAIL_USERNAME')
    print(f"Mail config - Username: {app.config['MAIL_USERNAME']}, Sender: {app.config['MAIL_DEFAULT_SENDER']}")
    
    return Mail(app)

def send_verification_email(email, name, verification_token):
    """Send email verification"""
    try:
        print(f"Attempting to send email to {email}")
        print(f"Default sender: {current_app.config.get('MAIL_DEFAULT_SENDER')}")
        mail = current_app.extensions.get('mail')
        if not mail:
            print("Mail extension not found")
            return False
        
        verification_url = f"{os.environ.get('FRONTEND_URL', 'http://localhost:5173')}/verify?token={verification_token}"
        
        msg = Message(
            subject='Confirme sua conta Agenda LAPEN',
            recipients=[email],
            sender=current_app.config['MAIL_DEFAULT_SENDER'],
            html=f"""
            <h2>Bem-vindo(a) à Agenda LAPEN, {name}!</h2>
            <p>Clique no link abaixo para verificar seu endereço de email:</p>
            <p><a href="{verification_url}">Verificar Email</a></p>
            <p>Se você não criou esta conta, ignore este email.</p>
            """
        )
        
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Failed to send verification email: {e}")
        return False

def send_bet_confirmation_email(email, name, bet_details):
    """Send bet confirmation email"""
    try:
        mail = current_app.extensions.get('mail')
        if not mail:
            return False
        
        msg = Message(
            subject='Bet Confirmation - Agenda LAPEN',
            recipients=[email],
            html=f"""
            <h2>Bet Confirmation</h2>
            <p>Hi {name},</p>
            <p>Your bet has been placed successfully!</p>
            <p><strong>Match:</strong> {bet_details['match']}</p>
            <p><strong>Player:</strong> {bet_details['player']}</p>
            <p><strong>Amount:</strong> ${bet_details['amount']}</p>
            <p><strong>Potential Return:</strong> ${bet_details['potential_return']}</p>
            <p>Good luck!</p>
            """
        )
        
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Failed to send bet confirmation email: {e}")
        return False