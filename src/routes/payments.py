from flask import Blueprint, request, jsonify
import stripe
import os
from src.database import get_db
from src.logger import get_logger

logger = get_logger()

payments_bp = Blueprint('payments', __name__, url_prefix='/api/payments')

@payments_bp.route('/webhook', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhook events"""
    payload = request.get_data()
    sig_header = request.headers.get('Stripe-Signature')
    endpoint_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
    
    if not endpoint_secret:
        return jsonify({'error': 'Webhook secret not configured'}), 400
    
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except ValueError:
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError:
        return jsonify({'error': 'Invalid signature'}), 400
    
    # Handle payment success
    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        handle_payment_success(payment_intent)
    
    # Handle payment failure
    elif event['type'] == 'payment_intent.payment_failed':
        payment_intent = event['data']['object']
        handle_payment_failure(payment_intent)
    
    return jsonify({'status': 'success'})

def handle_payment_success(payment_intent):
    """Handle successful payment"""
    
    payment_id = payment_intent['id']
    
    db = get_db()
    try:
        # Update bet status if exists
        db.execute('''
            UPDATE bets SET status = 'confirmed' 
            WHERE payment_id = ? AND status = 'pending'
        ''', (payment_id,))
        
        # Log payment success
        db.execute('''
            INSERT INTO payment_logs (payment_id, event_type, status, amount, metadata)
            VALUES (?, 'payment_success', 'succeeded', ?, ?)
        ''', (payment_id, payment_intent.get('amount', 0) / 100, str(payment_intent.get('metadata', {}))))
        
        db.commit()
        logger.info(f'Payment success handled: {payment_id}')
    except Exception as e:
        logger.error(f'Error handling payment success {payment_id}: {e}')
        db.rollback()
    finally:
        db.close()

def handle_payment_failure(payment_intent):
    """Handle failed payment"""
    
    payment_id = payment_intent['id']
    
    db = get_db()
    try:
        # Update bet status
        db.execute('''
            UPDATE bets SET status = 'failed' 
            WHERE payment_id = ? AND status = 'pending'
        ''', (payment_id,))
        
        # Log payment failure
        db.execute('''
            INSERT INTO payment_logs (payment_id, event_type, status, amount, error_message)
            VALUES (?, 'payment_failed', 'failed', ?, ?)
        ''', (payment_id, payment_intent.get('amount', 0) / 100, payment_intent.get('last_payment_error', {}).get('message', 'Unknown error')))
        
        db.commit()
        logger.warning(f'Payment failure handled: {payment_id}')
    except Exception as e:
        logger.error(f'Error handling payment failure {payment_id}: {e}')
        db.rollback()
    finally:
        db.close()

@payments_bp.route('/<string:payment_id>/status', methods=['GET'])
def check_payment_status(payment_id):
    """Check payment status (Mercado Pago PIX only)"""
    from src.payment_gateway import MercadoPagoGateway
    import requests
    
    try:
        gateway = MercadoPagoGateway()
        headers = {'Authorization': f'Bearer {gateway.access_token}'}
        response = requests.get(
            f'{gateway.base_url}/v1/payments/{payment_id}',
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            payment = response.json()
            status = payment.get('status')
            logger.info(f'Payment {payment_id}: status={status}, detail={payment.get("status_detail")}')
            return jsonify({'status': status})
        
        return jsonify({'error': f'API error: {response.status_code}'}), 500
    except Exception as e:
        logger.error(f'Error checking payment {payment_id}: {e}')
        return jsonify({'error': str(e)}), 500

@payments_bp.route('/history/<int:user_id>', methods=['GET'])
def get_payment_history(user_id):
    """Get payment history for a user"""
    db = get_db()
    try:
        cursor = db.execute('''
            SELECT b.payment_id, b.amount, b.status, b.created_at,
                   s.player1_name, s.player2_name, s.date, s.start_time
            FROM bets b
            JOIN matches m ON b.match_id = m.id
            JOIN schedules s ON m.schedule_id = s.id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
        ''', (user_id,))
        
        payments = []
        for row in cursor.fetchall():
            payments.append({
                'payment_id': row['payment_id'],
                'amount': float(row['amount']),
                'status': row['status'],
                'created_at': row['created_at'],
                'match': f"{row['player1_name']} vs {row['player2_name']}",
                'match_date': row['date'],
                'match_time': row['start_time']
            })
        
        logger.info(f'Fetched payment history for user {user_id}: {len(payments)} payments')
        return jsonify({'payments': payments})
    except Exception as e:
        logger.error(f'Error fetching payment history for user {user_id}: {str(e)}')
        return jsonify({'error': f'Error fetching payment history: {str(e)}'}), 500
    finally:
        db.close()