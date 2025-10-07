import stripe
import os
from flask import current_app

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

def create_payment_intent(amount, currency='brl', metadata=None):
    """Create a Stripe payment intent or mock payment"""
    if os.environ.get('STRIPE_MOCK_ACTIVE', 'false').lower() == 'true':
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
            'client_secret': intent.client_secret,
            'payment_intent_id': intent.id
        }
    except stripe.error.StripeError as e:
        return {
            'success': False,
            'error': str(e)
        }

def confirm_payment(payment_intent_id):
    """Confirm a payment was successful"""
    if os.environ.get('STRIPE_MOCK_ACTIVE', 'false').lower() == 'true':
        # Mock payment confirmation - always return True for mock payments
        return payment_intent_id.startswith('mock_pi_')
    
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        return intent.status == 'succeeded'
    except stripe.error.StripeError:
        return False

def refund_payment(payment_intent_id, amount=None):
    """Refund a payment"""
    try:
        refund = stripe.Refund.create(
            payment_intent=payment_intent_id,
            amount=int(amount * 100) if amount else None
        )
        return {
            'success': True,
            'refund_id': refund.id
        }
    except stripe.error.StripeError as e:
        return {
            'success': False,
            'error': str(e)
        }