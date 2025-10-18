from src.payment_gateway import get_payment_gateway

def create_payment_intent(amount, currency='brl', metadata=None):
    """Create a payment intent using gateway based on payment method"""
    payment_method = metadata.get('payment_method', 'card') if metadata else 'card'
    gateway = get_payment_gateway(payment_method)
    return gateway.create_payment_intent(amount, currency, metadata)

def confirm_payment(payment_intent_id, payment_method='card'):
    """Confirm a payment was successful"""
    gateway = get_payment_gateway(payment_method)
    return gateway.confirm_payment(payment_intent_id)

def refund_payment(payment_intent_id, amount=None, payment_method='card'):
    """Refund a payment"""
    gateway = get_payment_gateway(payment_method)
    result = gateway.refund_payment(payment_intent_id, amount)
    
    if result['success']:
        log_payment_event(payment_intent_id, 'refund_created', result.get('status', 'succeeded'), amount or 0)
    else:
        log_payment_event(payment_intent_id, 'refund_failed', 'failed', amount or 0, result.get('error'))
    
    return result

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