from abc import ABC, abstractmethod
import stripe
import os
from src.logger import get_logger

logger = get_logger()

class PaymentGateway(ABC):
    """Abstract payment gateway interface"""
    
    @abstractmethod
    def create_payment_intent(self, amount, currency='brl', metadata=None):
        pass
    
    @abstractmethod
    def confirm_payment(self, payment_intent_id):
        pass
    
    @abstractmethod
    def refund_payment(self, payment_intent_id, amount=None):
        pass

class StripeGateway(PaymentGateway):
    """Stripe payment gateway implementation"""
    
    def __init__(self):
        self.api_key = os.getenv('STRIPE_SECRET_KEY')
        stripe.api_key = self.api_key
        self.mock_active = os.getenv('PAYMENT_MOCK_ACTIVE', 'false').lower() == 'true'
    
    def create_payment_intent(self, amount, currency='brl', metadata=None):
        logger.info(f'Stripe: Creating card payment for {amount} {currency}')
        
        if self.mock_active:
            mock_id = f"mock_pi_{int(amount * 100)}_{hash(str(metadata))}"
            return {
                'success': True,
                'client_secret': f"mock_secret_{mock_id}",
                'payment_intent_id': mock_id
            }
        
        try:
            params = {
                'amount': int(amount * 100),
                'currency': currency,
                'payment_method_types': ['card']
            }
            
            if metadata:
                params['metadata'] = metadata
            
            intent = stripe.PaymentIntent.create(**params)
            
            return {
                'success': True,
                'client_secret': intent.client_secret,
                'payment_intent_id': intent.id,
                'payment_id': intent.id
            }
        except Exception as e:
            logger.error(f'Stripe error: {e}')
            return {'success': False, 'error': str(e)}
    
    def confirm_payment(self, payment_intent_id):
        if self.mock_active:
            return payment_intent_id.startswith('mock_pi_') or payment_intent_id.startswith('mock_card_')
        
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            return intent.status == 'succeeded'
        except Exception:
            return False
    
    def refund_payment(self, payment_intent_id, amount=None):
        if self.mock_active:
            return {'success': True, 'refund_id': f'mock_refund_{payment_intent_id}'}
        
        try:
            refund = stripe.Refund.create(
                payment_intent=payment_intent_id,
                amount=int(amount * 100) if amount else None
            )
            return {'success': True, 'refund_id': refund.id, 'status': refund.status}
        except Exception as e:
            return {'success': False, 'error': str(e)}

class MercadoPagoGateway(PaymentGateway):
    """Mercado Pago payment gateway implementation with PIX support"""
    
    def __init__(self):
        self.access_token = os.getenv('MERCADOPAGO_ACCESS_TOKEN')
        self.mock_active = os.getenv('PAYMENT_MOCK_ACTIVE', 'false').lower() == 'true'
        self.base_url = 'https://api.mercadopago.com'
        if not self.access_token and not self.mock_active:
            logger.error('Mercado Pago access token not configured')
    
    def create_payment_intent(self, amount, currency='brl', metadata=None):
        logger.info(f'Mercado Pago: Creating PIX payment for {amount} {currency}')
        
        if self.mock_active:
            mock_id = f"mp_mock_{int(amount * 100)}_{hash(str(metadata))}"
            return {
                'success': True,
                'payment_id': mock_id,
                'qr_code': 'MOCK_PIX_CODE',
                'qr_code_base64': 'MOCK_BASE64_QR',
                'ticket_url': f'https://mock.mercadopago.com/{mock_id}'
            }
        
        try:
            import requests
            
            import time
            import uuid
            
            # Generate unique idempotency key for each payment
            idempotency_key = f"{metadata.get('user_id', '')}_{metadata.get('schedule_id', '')}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}" if metadata else f"{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"
            
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json',
                'X-Idempotency-Key': idempotency_key
            }
            
            payment_data = {
                "transaction_amount": float(amount),
                "payment_method_id": "pix",
                "payer": {
                    "email": metadata.get('email', 'test_user_123456@testuser.com') if metadata else 'test_user_123456@testuser.com'
                }
            }
            
            if metadata:
                payment_data['external_reference'] = str(metadata.get('bet_id', ''))
                payment_data['description'] = metadata.get('description', 'Payment')
            
            response = requests.post(
                f'{self.base_url}/v1/payments',
                json=payment_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                payment = response.json()
                return {
                    'success': True,
                    'payment_id': payment['id'],
                    'qr_code': payment.get('point_of_interaction', {}).get('transaction_data', {}).get('qr_code'),
                    'qr_code_base64': payment.get('point_of_interaction', {}).get('transaction_data', {}).get('qr_code_base64'),
                    'ticket_url': payment.get('point_of_interaction', {}).get('transaction_data', {}).get('ticket_url')
                }
            else:
                return {'success': False, 'error': f'API error: {response.status_code} - {response.text}'}
                
        except Exception as e:
            logger.error(f'Mercado Pago error: {e}')
            return {'success': False, 'error': str(e)}
    
    def confirm_payment(self, payment_intent_id):
        if self.mock_active:
            return payment_intent_id.startswith('mp_mock_') or payment_intent_id.startswith('mock_pix_')
        
        try:
            import requests
            
            headers = {'Authorization': f'Bearer {self.access_token}'}
            response = requests.get(
                f'{self.base_url}/v1/payments/{payment_intent_id}',
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                payment = response.json()
                return payment.get('status') == 'approved'
            return False
        except Exception:
            return False
    
    def refund_payment(self, payment_intent_id, amount=None):
        if self.mock_active:
            return {'success': True, 'refund_id': f'mp_refund_{payment_intent_id}'}
        
        try:
            import requests
            
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json'
            }
            
            refund_data = {}
            if amount:
                refund_data['amount'] = float(amount)
            
            response = requests.post(
                f'{self.base_url}/v1/payments/{payment_intent_id}/refunds',
                json=refund_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 201:
                refund = response.json()
                return {'success': True, 'refund_id': refund['id']}
            else:
                return {'success': False, 'error': f'Refund failed: {response.status_code}'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

def get_payment_gateway(payment_method='card'):
    """Factory function to get payment gateway based on payment method"""
    if payment_method == 'pix':
        return MercadoPagoGateway()
    else:
        return StripeGateway()

def format_payment_response(payment_result):
    """Format payment response for frontend based on gateway"""
    if not payment_result or not payment_result.get('success'):
        return None
    
    response = {'payment_id': payment_result.get('payment_intent_id') or payment_result.get('payment_id')}
    
    # Stripe fields
    if 'client_secret' in payment_result:
        response['client_secret'] = payment_result['client_secret']
        response['payment_intent_id'] = payment_result['payment_intent_id']
    
    # Mercado Pago fields
    if 'qr_code' in payment_result:
        response['qr_code'] = payment_result['qr_code']
        response['qr_code_base64'] = payment_result['qr_code_base64']
        response['ticket_url'] = payment_result['ticket_url']
    
    return response
