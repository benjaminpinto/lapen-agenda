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
        
        # Get base URL using same logic as public.py line 378
        from flask import request
        verification_url = f"{request.host_url}verify?token={verification_token}"
        
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
            subject='Confirmação de Aposta - Tigrinho LAPEN',
            recipients=[email],
            sender=current_app.config.get('MAIL_DEFAULT_SENDER') or current_app.config.get('MAIL_USERNAME') or 'lapen.ptc@gmail.com',
            html=f"""
            <h2>Confirmação de Aposta</h2>
            <p>Olá {name},</p>
            <p>Sua aposta foi realizada com sucesso!</p>
            <p><strong>Partida:</strong> {bet_details['match']}</p>
            <p><strong>Jogador:</strong> {bet_details['player']}</p>
            <p><strong>Valor:</strong> {bet_details['amount']}</p>
            <p><strong>Retorno Potencial:</strong> {bet_details['potential_return']}</p>
            <p>Boa sorte!</p>
            """
        )
        
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Failed to send bet confirmation email: {e}")
        return False

def send_winner_notification_email(email, name, match_details, payout_amount):
    """Send winner notification email"""
    try:
        mail = current_app.extensions.get('mail')
        if not mail:
            return False
        
        msg = Message(
            subject='Parabéns! Você ganhou! - Tigrinho LAPEN',
            recipients=[email],
            sender=current_app.config.get('MAIL_DEFAULT_SENDER') or current_app.config.get('MAIL_USERNAME') or 'lapen.ptc@gmail.com',
            html=f"""
            <h2>🎉 Parabéns! Você ganhou!</h2>
            <p>Olá {name},</p>
            <p>Sua aposta foi vencedora!</p>
            <p><strong>Partida:</strong> {match_details['match']}</p>
            <p><strong>Vencedor:</strong> {match_details['winner']}</p>
            <p><strong>Valor Ganho:</strong> R$ {payout_amount:.2f}</p>
            <p>O valor será creditado em sua conta em breve.</p>
            <p>Continue apostando e boa sorte!</p>
            """
        )
        
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Failed to send winner notification email: {e}")
        return False

def send_bet_settlement_email(email, name, match_details, bet_result, amount):
    """Send bet settlement confirmation email"""
    try:
        mail = current_app.extensions.get('mail')
        if not mail:
            return False
        
        subject = 'Resultado da Aposta - Tigrinho LAPEN'
        if bet_result == 'won':
            result_text = f"<p style='color: green;'><strong>✅ Sua aposta foi vencedora!</strong></p>"
            amount_text = f"<p><strong>Valor Ganho:</strong> R$ {amount:.2f}</p>"
        else:
            result_text = f"<p style='color: red;'><strong>❌ Sua aposta não foi vencedora desta vez.</strong></p>"
            amount_text = ""
        
        msg = Message(
            subject=subject,
            recipients=[email],
            sender=current_app.config.get('MAIL_DEFAULT_SENDER') or current_app.config.get('MAIL_USERNAME') or 'lapen.ptc@gmail.com',
            html=f"""
            <h2>Resultado da Aposta</h2>
            <p>Olá {name},</p>
            <p>A partida foi finalizada!</p>
            <p><strong>Partida:</strong> {match_details['match']}</p>
            <p><strong>Vencedor:</strong> {match_details['winner']}</p>
            {result_text}
            {amount_text}
            <p>Obrigado por apostar conosco!</p>
            """
        )
        
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Failed to send bet settlement email: {e}")
        return False