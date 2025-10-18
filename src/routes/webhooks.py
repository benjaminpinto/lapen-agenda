from flask import Blueprint, request, jsonify
from src.logger import get_logger
from src.database import get_db

logger = get_logger()
webhooks_bp = Blueprint('webhooks', __name__)

@webhooks_bp.route('/mercadopago', methods=['POST'])
def mercadopago_webhook():
    """Handle Mercado Pago payment notifications"""
    try:
        data = request.json
        
        # Mercado Pago sends payment updates
        if data.get('type') == 'payment':
            payment_id = data.get('data', {}).get('id')
            
            if payment_id:
                # Fetch full payment details
                from src.payment_gateway import get_payment_gateway
                gateway = get_payment_gateway()
                
                import requests
                headers = {'Authorization': f'Bearer {gateway.access_token}'}
                response = requests.get(
                    f'{gateway.base_url}/v1/payments/{payment_id}',
                    headers=headers,
                    timeout=30,
                    verify=False
                )
                
                if response.status_code == 200:
                    payment = response.json()
                    status = payment.get('status')
                    external_ref = payment.get('external_reference')
                    
                    logger.info(f'Payment {payment_id} status: {status}')
                    
                    # Update bet status in database
                    if status == 'approved' and external_ref:
                        db = get_db()
                        db.execute(
                            'UPDATE bets SET status = ?, payment_status = ? WHERE id = ?',
                            ('confirmed', 'paid', external_ref)
                        )
                        db.commit()
                        db.close()
        
        return jsonify({'status': 'ok'}), 200
    
    except Exception as e:
        logger.error(f'Webhook error: {e}')
        return jsonify({'error': str(e)}), 500
