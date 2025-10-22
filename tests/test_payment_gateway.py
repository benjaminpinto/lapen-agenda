import unittest
from unittest.mock import Mock, patch, MagicMock
from src.payment_gateway import MercadoPagoGateway, format_payment_response


class TestMercadoPagoGateway(unittest.TestCase):
    
    @patch.dict('os.environ', {'PAYMENT_MOCK_ACTIVE': 'true'})
    def test_create_payment_mock_mode(self):
        """Test payment creation in mock mode"""
        gateway = MercadoPagoGateway()
        
        result = gateway.create_payment_intent(
            amount=100.0,
            metadata={'bet_id': '123', 'email': 'test@test.com'}
        )
        
        self.assertTrue(result['success'])
        self.assertIn('payment_id', result)
        self.assertIn('qr_code', result)
        self.assertEqual(result['qr_code'], 'MOCK_PIX_CODE')
    
    @patch.dict('os.environ', {'PAYMENT_MOCK_ACTIVE': 'false', 'MERCADOPAGO_ACCESS_TOKEN': 'test_token', 'FLASK_ENV': 'development'})
    @patch('src.payment_gateway.requests')
    def test_create_payment_success(self, mock_requests):
        """Test successful payment creation"""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            'id': 12345,
            'point_of_interaction': {
                'transaction_data': {
                    'qr_code': 'PIX_CODE',
                    'qr_code_base64': 'BASE64_QR',
                    'ticket_url': 'https://mp.com/ticket'
                }
            }
        }
        mock_requests.post.return_value = mock_response
        
        gateway = MercadoPagoGateway()
        result = gateway.create_payment_intent(
            amount=100.0,
            metadata={'bet_id': '123', 'email': 'test@test.com', 'device_id': 'device123'}
        )
        
        self.assertTrue(result['success'])
        self.assertEqual(result['payment_id'], 12345)
        self.assertEqual(result['qr_code'], 'PIX_CODE')
    
    @patch.dict('os.environ', {'PAYMENT_MOCK_ACTIVE': 'false', 'MERCADOPAGO_ACCESS_TOKEN': 'test_token', 'FLASK_ENV': 'development'})
    @patch('src.payment_gateway.requests')
    def test_create_payment_with_external_reference(self, mock_requests):
        """Test payment includes external_reference"""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            'id': 12345,
            'point_of_interaction': {'transaction_data': {}}
        }
        mock_requests.post.return_value = mock_response
        
        gateway = MercadoPagoGateway()
        gateway.create_payment_intent(
            amount=100.0,
            metadata={'bet_id': 'bet_123', 'email': 'test@test.com'}
        )
        
        call_args = mock_requests.post.call_args
        payment_data = call_args[1]['json']
        self.assertIn('external_reference', payment_data)
        self.assertEqual(payment_data['external_reference'], 'bet_123')
    
    @patch.dict('os.environ', {'PAYMENT_MOCK_ACTIVE': 'false', 'MERCADOPAGO_ACCESS_TOKEN': 'test_token', 'FLASK_ENV': 'development'})
    @patch('src.payment_gateway.requests')
    def test_create_payment_with_device_id(self, mock_requests):
        """Test payment includes device ID in header"""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            'id': 12345,
            'point_of_interaction': {'transaction_data': {}}
        }
        mock_requests.post.return_value = mock_response
        
        gateway = MercadoPagoGateway()
        gateway.create_payment_intent(
            amount=100.0,
            metadata={'bet_id': '123', 'email': 'test@test.com', 'device_id': 'device_abc'}
        )
        
        call_args = mock_requests.post.call_args
        headers = call_args[1]['headers']
        self.assertIn('X-meli-session-id', headers)
        self.assertEqual(headers['X-meli-session-id'], 'device_abc')
    
    @patch.dict('os.environ', {'PAYMENT_MOCK_ACTIVE': 'false', 'MERCADOPAGO_ACCESS_TOKEN': 'test_token', 'FLASK_ENV': 'development'})
    @patch('src.payment_gateway.requests')
    def test_create_payment_failure(self, mock_requests):
        """Test payment creation failure"""
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.text = 'Bad request'
        mock_requests.post.return_value = mock_response
        
        gateway = MercadoPagoGateway()
        result = gateway.create_payment_intent(
            amount=100.0,
            metadata={'bet_id': '123', 'email': 'test@test.com'}
        )
        
        self.assertFalse(result['success'])
        self.assertIn('error', result)
    
    @patch.dict('os.environ', {'PAYMENT_MOCK_ACTIVE': 'true'})
    def test_confirm_payment_mock(self):
        """Test payment confirmation in mock mode"""
        gateway = MercadoPagoGateway()
        
        self.assertTrue(gateway.confirm_payment('mp_mock_12345'))
        self.assertTrue(gateway.confirm_payment('mock_pix_67890'))
        self.assertFalse(gateway.confirm_payment('invalid_id'))
    
    def test_format_payment_response_mercadopago(self):
        """Test formatting Mercado Pago response"""
        payment_result = {
            'success': True,
            'payment_id': 12345,
            'qr_code': 'PIX_CODE',
            'qr_code_base64': 'BASE64',
            'ticket_url': 'https://mp.com/ticket'
        }
        
        result = format_payment_response(payment_result)
        
        self.assertEqual(result['payment_id'], 12345)
        self.assertEqual(result['qr_code'], 'PIX_CODE')
        self.assertEqual(result['qr_code_base64'], 'BASE64')
        self.assertEqual(result['ticket_url'], 'https://mp.com/ticket')
    
    def test_format_payment_response_failure(self):
        """Test formatting failed payment response"""
        payment_result = {'success': False, 'error': 'Payment failed'}
        
        result = format_payment_response(payment_result)
        
        self.assertIsNone(result)


if __name__ == '__main__':
    unittest.main()
