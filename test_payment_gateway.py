#!/usr/bin/env python3
"""Test script for payment gateway abstraction"""

import os
from dotenv import load_dotenv

load_dotenv()

from src.payment_gateway import get_payment_gateway, StripeGateway, PayPalGateway

def test_gateway_factory():
    """Test gateway factory function"""
    print("Testing payment gateway factory...")
    
    # Test default (Stripe)
    os.environ['PAYMENT_GATEWAY'] = 'stripe'
    gateway = get_payment_gateway()
    assert isinstance(gateway, StripeGateway), "Should return StripeGateway"
    print("✓ Stripe gateway loaded")
    
    # Test PayPal
    os.environ['PAYMENT_GATEWAY'] = 'paypal'
    gateway = get_payment_gateway()
    assert isinstance(gateway, PayPalGateway), "Should return PayPalGateway"
    print("✓ PayPal gateway loaded")
    
    # Test unknown (should default to Stripe)
    os.environ['PAYMENT_GATEWAY'] = 'unknown'
    gateway = get_payment_gateway()
    assert isinstance(gateway, StripeGateway), "Should default to StripeGateway"
    print("✓ Unknown gateway defaults to Stripe")

def test_stripe_payment_intent():
    """Test Stripe payment intent creation"""
    print("\nTesting Stripe payment intent creation...")
    
    os.environ['PAYMENT_GATEWAY'] = 'stripe'
    os.environ['STRIPE_MOCK_ACTIVE'] = 'true'
    
    gateway = get_payment_gateway()
    
    # Test BRL payment with PIX
    result = gateway.create_payment_intent(
        amount=100.00,
        currency='brl',
        metadata={'test': 'pix_payment'}
    )
    
    assert result['success'], "Payment intent should succeed"
    assert 'client_secret' in result, "Should return client_secret"
    assert 'payment_intent_id' in result, "Should return payment_intent_id"
    print(f"✓ Payment intent created: {result['payment_intent_id']}")
    
    # Test payment confirmation
    is_confirmed = gateway.confirm_payment(result['payment_intent_id'])
    assert is_confirmed, "Mock payment should be confirmed"
    print("✓ Payment confirmed")
    
    # Test refund
    refund_result = gateway.refund_payment(result['payment_intent_id'], amount=50.00)
    assert refund_result['success'], "Refund should succeed"
    print(f"✓ Refund created: {refund_result['refund_id']}")

def test_payment_processor():
    """Test payment processor functions"""
    print("\nTesting payment processor...")
    
    from src.utils.payment_processor import create_payment_intent, confirm_payment, refund_payment
    
    os.environ['PAYMENT_GATEWAY'] = 'stripe'
    os.environ['STRIPE_MOCK_ACTIVE'] = 'true'
    
    # Create payment
    result = create_payment_intent(50.00, 'brl', {'test': 'processor'})
    assert result['success'], "Should create payment"
    print(f"✓ Payment processor created intent: {result['payment_intent_id']}")
    
    # Confirm payment
    confirmed = confirm_payment(result['payment_intent_id'])
    assert confirmed, "Should confirm payment"
    print("✓ Payment processor confirmed payment")
    
    # Refund payment
    refund_result = refund_payment(result['payment_intent_id'], 25.00)
    assert refund_result['success'], "Should refund payment"
    print("✓ Payment processor refunded payment")

if __name__ == '__main__':
    print("=" * 60)
    print("Payment Gateway Test Suite")
    print("=" * 60)
    
    try:
        test_gateway_factory()
        test_stripe_payment_intent()
        test_payment_processor()
        
        print("\n" + "=" * 60)
        print("✓ All tests passed!")
        print("=" * 60)
        print("\nPayment gateway abstraction is working correctly.")
        print("PIX payments are enabled for BRL currency.")
        print("\nTo switch gateways, set PAYMENT_GATEWAY in .env:")
        print("  - PAYMENT_GATEWAY=stripe (default, supports PIX)")
        print("  - PAYMENT_GATEWAY=paypal (not yet implemented)")
        
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        exit(1)
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
