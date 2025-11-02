import os
from flask_mail import Mail, Message
from flask import current_app

def send_mail(msg):
    """Send email or log in development mode"""
    if os.getenv('FLASK_ENV') == 'development':
        print(f"\n{'='*60}")
        print("[DEV MODE] Email NOT sent - Logging only:")
        print(f"To: {', '.join(msg.recipients)}")
        print(f"Subject: {msg.subject}")
        print(f"{'='*60}\n")
        return
    
    mail = current_app.extensions.get('mail')
    if mail:
        mail.send(msg)

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
        base_url = os.getenv('FRONTEND_URL')
        if base_url:
            if not base_url.endswith('/'):
                base_url += '/'
        else:
            from flask import request
            base_url = request.host_url
            if os.getenv('FLASK_ENV') == 'development' and ':5001' in base_url:
                base_url = base_url.replace(':5001', ':5173')
        
        verification_url = f"{base_url}verify?token={verification_token}"
        
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
        
        send_mail(msg)
        return True
    except Exception as e:
        print(f"Failed to send verification email: {e}")
        return False

def send_bet_confirmation_email(email, name, bet_details):
    """Send bet confirmation email"""
    try:
        potential_return_html = ""
        if bet_details.get('potential_return') and bet_details['potential_return'] != 'R$ 0' and bet_details['potential_return'] != 'R$ 0.00':
            potential_return_html = f"<p><strong>Retorno Potencial:</strong> {bet_details['potential_return']}</p>"
        
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
            {potential_return_html}
            <p><strong>ID da Transação:</strong> {bet_details['transaction_id']}</p>
            <p>Boa sorte!</p>
            """
        )
        
        send_mail(msg)
        return True
    except Exception as e:
        print(f"Failed to send bet confirmation email: {e}")
        return False

def send_winner_notification_email(email, name, match_details, payout_amount):
    """Send winner notification email"""
    try:
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
        
        send_mail(msg)
        return True
    except Exception as e:
        print(f"Failed to send winner notification email: {e}")
        return False

def send_bet_settlement_email(email, name, match_details, bet_result, amount):
    """Send bet settlement confirmation email"""
    try:
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
        
        send_mail(msg)
        return True
    except Exception as e:
        print(f"Failed to send bet settlement email: {e}")
        return False

def send_lapen_approval_request_email(user_email, user_name, user_phone):
    """Send notification to admin when a user requests LAPEN member approval"""
    try:
        admin_email = current_app.config.get('MAIL_DEFAULT_SENDER')
        if not admin_email:
            return False
        
        msg = Message(
            subject='Nova Solicitação de Membro LAPEN',
            recipients=[admin_email],
            sender=admin_email,
            html=f"""
            <h2>Nova Solicitação de Membro LAPEN</h2>
            <p>Um novo usuário solicitou aprovação como membro LAPEN:</p>
            <p><strong>Nome:</strong> {user_name}</p>
            <p><strong>Email:</strong> {user_email}</p>
            <p><strong>Telefone:</strong> {user_phone or 'Não informado'}</p>
            <p>Acesse o painel administrativo para aprovar ou rejeitar esta solicitação.</p>
            """
        )
        
        send_mail(msg)
        return True
    except Exception as e:
        print(f"Failed to send LAPEN approval request email: {e}")
        return False

def send_password_reset_email(email, name, reset_token):
    """Send password reset email"""
    try:
        base_url = os.getenv('FRONTEND_URL')
        if base_url:
            if not base_url.endswith('/'):
                base_url += '/'
        else:
            from flask import request
            base_url = request.host_url
            if os.getenv('FLASK_ENV') == 'development' and ':5001' in base_url:
                base_url = base_url.replace(':5001', ':5173')
        
        reset_url = f"{base_url}reset-password?token={reset_token}"
        
        msg = Message(
            subject='Recuperação de Senha - Agenda LAPEN',
            recipients=[email],
            sender=current_app.config['MAIL_DEFAULT_SENDER'],
            html=f"""
            <h2>Recuperação de Senha</h2>
            <p>Olá {name},</p>
            <p>Recebemos uma solicitação para redefinir sua senha.</p>
            <p>Clique no link abaixo para criar uma nova senha:</p>
            <p><a href="{reset_url}">Redefinir Senha</a></p>
            <p>Este link expira em 1 hora.</p>
            <p>Se você não solicitou esta recuperação, ignore este email.</p>
            """
        )
        
        send_mail(msg)
        return True
    except Exception as e:
        print(f"Failed to send password reset email: {e}")
        return False

def send_lapen_approval_notification_email(user_email, user_name):
    """Send notification to user when LAPEN membership is approved"""
    try:
        msg = Message(
            subject='Membro LAPEN Aprovado - Agenda LAPEN',
            recipients=[user_email],
            sender=current_app.config.get('MAIL_DEFAULT_SENDER'),
            html=f"""
            <h2>🎉 Parabéns! Você foi aprovado como Membro LAPEN</h2>
            <p>Olá {user_name},</p>
            <p>Sua solicitação para se tornar membro LAPEN foi aprovada!</p>
            <p>Agora você tem acesso a todos os benefícios e funcionalidades exclusivas para membros LAPEN.</p>
            <p>Acesse a plataforma e aproveite!</p>
            <p>Bem-vindo(a) à LAPEN!</p>
            """
        )
        
        send_mail(msg)
        return True
    except Exception as e:
        print(f"Failed to send LAPEN approval notification email: {e}")
        return False