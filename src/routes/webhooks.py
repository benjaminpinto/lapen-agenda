import hashlib
import hmac
import os

from flask import Blueprint, request, jsonify
from src.logger import get_logger
from src.database import get_db

logger = get_logger()
webhooks_bp = Blueprint('webhooks', __name__)


def _verify_mercadopago_signature(signature_header, request_id, payment_id, secret):
    """Verify Mercado Pago webhook signature.

    MP signs `id:<payment_id>;request-id:<request_id>;ts:<ts>;` with HMAC-SHA256.
    Header format: `ts=<unix_ts>,v1=<hex_digest>`.
    """
    if not signature_header or not secret:
        return False
    parts = {}
    for piece in signature_header.split(','):
        if '=' in piece:
            k, v = piece.split('=', 1)
            parts[k.strip()] = v.strip()
    ts = parts.get('ts')
    received = parts.get('v1')
    if not ts or not received:
        return False
    manifest = f'id:{payment_id};request-id:{request_id};ts:{ts};'
    expected = hmac.new(secret.encode('utf-8'), manifest.encode('utf-8'), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received)


@webhooks_bp.route('/mercadopago', methods=['POST'])
def mercadopago_webhook():
    """Handle Mercado Pago payment notifications.

    Signature verification: required in production. In local dev (FLASK_ENV=development
    or ENVIRONMENT=local) verification is skipped to allow tunnel testing without secret.
    """
    try:
        data = request.json

        if data.get('type') != 'payment':
            return jsonify({'status': 'ok'}), 200

        payment_id = data.get('data', {}).get('id')
        if not payment_id:
            return jsonify({'status': 'ok'}), 200

        is_local = os.getenv('FLASK_ENV') == 'development' or os.getenv('ENVIRONMENT') == 'local'
        secret = os.getenv('MERCADOPAGO_WEBHOOK_SECRET')

        if not is_local:
            if not secret:
                logger.error('MERCADOPAGO_WEBHOOK_SECRET not configured in production')
                return jsonify({'error': 'Webhook secret not configured'}), 500
            signature_header = request.headers.get('x-signature') or request.headers.get('X-Signature')
            request_id = request.headers.get('x-request-id') or request.headers.get('X-Request-Id') or ''
            if not _verify_mercadopago_signature(signature_header, request_id, payment_id, secret):
                logger.warning(f'MP webhook signature verification failed for payment {payment_id}')
                return jsonify({'error': 'Invalid signature'}), 401

        from src.payment_gateway import get_payment_gateway
        gateway = get_payment_gateway()

        import requests
        headers = {'Authorization': f'Bearer {gateway.access_token}'}
        response = requests.get(
            f'{gateway.base_url}/v1/payments/{payment_id}',
            headers=headers,
            timeout=30,
            verify=not is_local
        )

        if response.status_code == 200:
            payment = response.json()
            status = payment.get('status')
            external_ref = payment.get('external_reference')

            logger.info(f'Payment {payment_id} status: {status}')

            # Status guard: only flip pending bets. Stops replay/duplicate webhooks
            # from overwriting a bet that is already won/lost/refunded.
            if status == 'approved' and external_ref:
                db = get_db()
                db.execute(
                    "UPDATE bets SET status = 'confirmed', payment_status = 'paid' "
                    "WHERE id = %s AND status = 'pending'",
                    (external_ref,)
                )
                db.commit()
                db.close()

        return jsonify({'status': 'ok'}), 200

    except Exception as e:
        logger.error(f'Webhook error: {e}')
        return jsonify({'error': str(e)}), 500
