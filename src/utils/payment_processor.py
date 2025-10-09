import stripe
import os
from flask import current_app

# Set Stripe API key
stripe.api_key = os.getenv('STRIPE_SECRET_KEY') or os.environ.get('STRIPE_SECRET_KEY')

def create_payment_intent(amount, currency='brl', metadata=None):
    """Create a Stripe payment intent or mock payment"""
    from src.logger import get_logger
    logger = get_logger()
    
    mock_active = (os.getenv('STRIPE_MOCK_ACTIVE') or os.environ.get('STRIPE_MOCK_ACTIVE', 'false')).lower() == 'true'
    logger.info(f'Stripe mock active: {mock_active}, API key set: {bool(stripe.api_key)}')
    
    if mock_active:
        # Mock payment for development
        mock_id = f"mock_pi_{int(amount * 100)}_{hash(str(metadata))}"
        return {
            'success': True,
            'client_secret': f"mock_secret_{mock_id}",
            'payment_intent_id': mock_id
        }
    
    try:
        intent = stripe.PaymentIntent.create(
            amount=int(amount * 100),  # Stripe uses cents
            currency=currency,
            metadata=metadata or {},
            automatic_payment_methods={'enabled': True}
        )
        return {
            'success': True,
            'client_secret': getattr(intent, 'client_secret', None),
            'payment_intent_id': intent.id
        }
    except stripe.error.StripeError as e:
        return {
            'success': False,
            'error': str(e)
        }

def confirm_payment(payment_intent_id):
    """Confirm a payment was successful"""
    mock_active = (os.getenv('STRIPE_MOCK_ACTIVE') or os.environ.get('STRIPE_MOCK_ACTIVE', 'false')).lower() == 'true'
    if mock_active:
        # Mock payment confirmation - always return True for mock payments
        return payment_intent_id.startswith('mock_pi_')
    
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        return intent.status == 'succeeded'
    except stripe.error.StripeError:
        return False

def refund_payment(payment_intent_id, amount=None):
    """Refund a payment"""
    mock_active = (os.getenv('STRIPE_MOCK_ACTIVE') or os.environ.get('STRIPE_MOCK_ACTIVE', 'false')).lower() == 'true'
    if mock_active:
        # Mock refund for development
        return {
            'success': True,
            'refund_id': f'mock_refund_{payment_intent_id}'
        }
    
    try:
        refund = stripe.Refund.create(
            payment_intent=payment_intent_id,
            amount=int(amount * 100) if amount else None
        )
        
        # Log refund
        log_payment_event(payment_intent_id, 'refund_created', refund.status, amount or 0)
        
        return {
            'success': True,
            'refund_id': refund.id,
            'status': refund.status
        }
    except stripe.error.StripeError as e:
        # Log refund failure
        log_payment_event(payment_intent_id, 'refund_failed', 'failed', amount or 0, str(e))
        return {
            'success': False,
            'error': str(e)
        }

def log_payment_event(payment_id, event_type, status, amount, error_message=None, metadata=None):
    """Log payment events to database"""
    try:
        from src.database import get_db
        from src.logger import get_logger
        
        logger = get_logger()
        db = get_db()
        
        db.execute('''
            INSERT INTO payment_logs (payment_id, event_type, status, amount, error_message, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (payment_id, event_type, status, amount, error_message, str(metadata) if metadata else None))
        
        db.commit()
        db.close()
        logger.info(f'Payment event logged: {payment_id} - {event_type} - {status}')
    except Exception as e:
        from src.logger import get_logger
        logger = get_logger()
        logger.error(f'Error logging payment event {payment_id}: {e}')