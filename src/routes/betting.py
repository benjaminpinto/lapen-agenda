from flask import Blueprint, request, jsonify
from src.database import get_db
from src.auth import require_auth
from src.utils.match_utils import is_match_eligible_for_betting, get_or_create_match, update_match_pool
from src.utils.odds_calculator import calculate_odds, calculate_potential_return
from src.utils.payment_processor import create_payment_intent, confirm_payment
from src.payment_gateway import format_payment_response
from src.email_service import send_bet_confirmation_email
from src.logger import get_logger
from decimal import Decimal

logger = get_logger()

betting_bp = Blueprint('betting', __name__, url_prefix='/api/betting')

@betting_bp.route('/create-payment-intent', methods=['POST'])
@require_auth
def create_bet_payment_intent():
    """Create payment intent for bet"""
    data = request.get_json()
    
    schedule_id = data.get('schedule_id')
    player_name = data.get('player_name')
    amount = data.get('amount')
    payment_method = data.get('payment_method', 'card')
    
    # Validate required fields
    if not all([schedule_id, player_name, amount]):
        return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
    
    try:
        amount = Decimal(str(amount))
        if amount <= 0:
            return jsonify({'error': 'Valor da aposta deve ser maior que zero'}), 400
    except:
        return jsonify({'error': 'Valor da aposta inválido'}), 400
    
    # Check if match is eligible for betting
    if not is_match_eligible_for_betting(schedule_id):
        logger.info(f'Betting not eligible for schedule {schedule_id}')
        return jsonify({'error': 'Apostas encerradas - menos de 1 hora para o início da partida'}), 400
    
    # Get user email for Mercado Pago
    db = get_db()
    try:
        cursor = db.execute('SELECT email FROM users WHERE id = ?', (request.user_id,))
        user = cursor.fetchone()
        user_email = user['email'] if user else 'test@test.com'
    finally:
        db.close()
    
    # Create payment intent
    try:
        payment_result = create_payment_intent(
            amount=float(amount),
            currency='brl',
            metadata={
                'user_id': request.user_id,
                'schedule_id': schedule_id,
                'player_name': player_name,
                'type': 'bet',
                'payment_method': payment_method,
                'email': user_email
            }
        )
        
        logger.info(f'Payment result: {payment_result}')
        
        if not payment_result or not payment_result.get('success'):
            error_msg = payment_result.get('error', 'Unknown error') if payment_result else 'Payment processor returned None'
            logger.error(f'Payment intent creation failed: {payment_result}')
            return jsonify({'error': f'Erro ao processar pagamento: {error_msg}'}), 500
    except Exception as e:
        logger.error(f'Exception during payment intent creation: {str(e)}')
        return jsonify({'error': f'Erro ao processar pagamento: {str(e)}'}), 500
    
    response_data = format_payment_response(payment_result)
    if not response_data:
        return jsonify({'error': 'Erro ao formatar resposta do pagamento'}), 500
    
    return jsonify(response_data)

@betting_bp.route('/place-bet', methods=['POST'])
@require_auth
def place_bet():
    """Place a bet after payment confirmation"""
    data = request.get_json()
    
    schedule_id = data.get('schedule_id')
    player_name = data.get('player_name')
    amount = data.get('amount')
    payment_intent_id = data.get('payment_intent_id')
    payment_method = data.get('payment_method', 'card')
    
    logger.info(f'Place bet request: schedule_id={schedule_id}, player={player_name}, amount={amount}, payment_id={payment_intent_id}, method={payment_method}')
    
    # Validate required fields
    if not all([schedule_id, player_name, amount, payment_intent_id]):
        logger.error(f'Missing required fields: schedule_id={schedule_id}, player={player_name}, amount={amount}, payment_id={payment_intent_id}')
        return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
    
    # Confirm payment was successful
    payment_confirmed = confirm_payment(payment_intent_id, payment_method)
    logger.info(f'Payment confirmation result for {payment_intent_id}: {payment_confirmed}')
    if not payment_confirmed:
        return jsonify({'error': 'Pagamento não confirmado'}), 400
    
    try:
        amount = Decimal(str(amount))
        if amount <= 0:
            return jsonify({'error': 'Valor da aposta deve ser maior que zero'}), 400
    except:
        return jsonify({'error': 'Valor da aposta inválido'}), 400
    
    # Check if match is eligible for betting
    if not is_match_eligible_for_betting(schedule_id):
        # Update betting_enabled to false for this match
        match_id = get_or_create_match(schedule_id)
        if match_id:
            db = get_db()
            try:
                db.execute('UPDATE matches SET betting_enabled = ? WHERE id = ?', (False, match_id))
                db.commit()
            except:
                pass
            finally:
                db.close()
        return jsonify({'error': 'Apostas encerradas - menos de 1 hora para o início da partida'}), 400
    
    # Get or create match
    match_id = get_or_create_match(schedule_id)
    if not match_id:
        return jsonify({'error': 'Erro ao processar partida'}), 500
    
    db = get_db()
    try:
        # Validate match and player
        cursor = db.execute('''
            SELECT s.player1_name, s.player2_name, m.betting_enabled, m.status
            FROM schedules s
            JOIN matches m ON s.id = m.schedule_id
            WHERE s.id = ? AND m.id = ?
        ''', (schedule_id, match_id))
        
        match_info = cursor.fetchone()
        if not match_info:
            return jsonify({'error': 'Partida não encontrada'}), 404
        
        if not match_info['betting_enabled']:
            return jsonify({'error': 'Apostas desabilitadas para esta partida'}), 400
        
        if match_info['status'] != 'upcoming':
            return jsonify({'error': 'Apostas fechadas para esta partida'}), 400
        
        # Validate player name
        valid_players = [match_info['player1_name'], match_info['player2_name']]
        if player_name not in valid_players:
            return jsonify({'error': 'Jogador inválido'}), 400
        
        # Check if user already has a bet on this match
        cursor = db.execute('''
            SELECT id FROM bets 
            WHERE user_id = ? AND match_id = ? AND status = 'active'
        ''', (request.user_id, match_id))
        
        if cursor.fetchone():
            return jsonify({'error': 'Você já tem uma aposta ativa nesta partida'}), 400
        
        # Create bet record with temporary potential return
        cursor = db.execute('''
            INSERT INTO bets (user_id, match_id, player_name, amount, status, potential_return, payment_id)
            VALUES (?, ?, ?, ?, 'active', 0, ?)
        ''', (request.user_id, match_id, player_name, float(amount), payment_intent_id))
        
        bet_id = cursor.lastrowid
        
        # Update match total pool
        update_match_pool(match_id, float(amount))
        
        # Recalculate potential returns for all bets on this match (including the new one)
        cursor = db.execute('''
            SELECT id, amount, player_name FROM bets 
            WHERE match_id = ? AND status = 'active'
        ''', (match_id,))
        
        all_bets = cursor.fetchall()
        potential_return = 0
        for bet in all_bets:
            new_potential_return = calculate_potential_return(match_id, bet['player_name'], bet['amount'])
            db.execute('''
                UPDATE bets SET potential_return = ? WHERE id = ?
            ''', (new_potential_return, bet['id']))
            # Store the potential return for the new bet
            if bet['id'] == bet_id:
                potential_return = new_potential_return
        
        db.commit()
        
        # Get user info for email
        cursor = db.execute('SELECT name, email FROM users WHERE id = ?', (request.user_id,))
        user = cursor.fetchone()
        
        # Send confirmation email (don't fail if email fails)
        if user:
            try:
                bet_details = {
                    'match': f"{match_info['player1_name']} vs {match_info['player2_name']}",
                    'player': player_name,
                    'amount': f"R$ {amount}",
                    'potential_return': f"R$ {potential_return}",
                    'transaction_id': payment_intent_id
                }
                send_bet_confirmation_email(user['email'], user['name'], bet_details)
            except Exception as email_error:
                logger.error(f'Failed to send bet confirmation email: {str(email_error)}')
        
        logger.info(f'Bet placed: user_id={request.user_id}, match_id={match_id}, amount={amount}, player={player_name}')
        return jsonify({
            'message': 'Aposta realizada com sucesso',
            'bet_id': bet_id,
            'amount': float(amount),
            'player': player_name,
            'potential_return': potential_return
        }), 201
        
    except Exception as e:
        logger.error(f'Error placing bet: user_id={request.user_id}, error={str(e)}')
        return jsonify({'error': f'Erro ao processar aposta: {str(e)}'}), 500
    finally:
        db.close()

@betting_bp.route('/my-bets', methods=['GET'])
@require_auth
def get_user_bets():
    """Get user's betting history"""
    db = get_db()
    try:
        cursor = db.execute('''
            SELECT b.id, b.amount, b.player_name, b.status, b.potential_return, b.created_at,
                   s.date, s.start_time, s.player1_name, s.player2_name, s.match_type,
                   c.name as court_name, m.status as match_status, m.id as match_id, s.id as schedule_id
            FROM bets b
            JOIN matches m ON b.match_id = m.id
            JOIN schedules s ON m.schedule_id = s.id
            JOIN courts c ON s.court_id = c.id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
        ''', (request.user_id,))
        
        bets = []
        for row in cursor.fetchall():
            # Serialize date/time fields
            created_at = row['created_at']
            if hasattr(created_at, 'strftime'):
                created_at = created_at.strftime('%Y-%m-%d %H:%M:%S')
            
            date = row['date']
            if hasattr(date, 'strftime'):
                date = date.strftime('%Y-%m-%d')
            
            start_time = row['start_time']
            if hasattr(start_time, 'strftime'):
                start_time = start_time.strftime('%H:%M')
            
            bet = {
                'id': row['id'],
                'amount': float(row['amount']),
                'player_name': row['player_name'],
                'status': row['status'],
                'potential_return': float(row['potential_return'] or 0),
                'created_at': created_at,
                'match': {
                    'id': row['schedule_id'],
                    'match_id': row['match_id'],
                    'date': date,
                    'start_time': start_time,
                    'player1_name': row['player1_name'],
                    'player2_name': row['player2_name'],
                    'match_type': row['match_type'],
                    'court_name': row['court_name'],
                    'status': row['match_status']
                }
            }
            bets.append(bet)
        
        logger.info(f'Fetched {len(bets)} bets for user {request.user_id}')
        return jsonify({'bets': bets})
        
    except Exception as e:
        logger.error(f'Error fetching bets for user {request.user_id}: {str(e)}')
        return jsonify({'error': f'Erro ao buscar apostas: {str(e)}'}), 500
    finally:
        db.close()

@betting_bp.route('/match/<int:match_id>/bets', methods=['GET'])
def get_match_bets(match_id):
    """Get betting statistics for a match"""
    db = get_db()
    try:
        # Get match info
        cursor = db.execute('''
            SELECT s.player1_name, s.player2_name, s.date, s.start_time,
                   m.total_pool, m.status, m.betting_enabled
            FROM matches m
            JOIN schedules s ON m.schedule_id = s.id
            WHERE m.id = ?
        ''', (match_id,))
        
        match_info = cursor.fetchone()
        if not match_info:
            return jsonify({'error': 'Partida não encontrada'}), 404
        
        # Get betting statistics (include all bet statuses for finished matches)
        cursor = db.execute('''
            SELECT player_name, COUNT(*) as bet_count, SUM(amount) as total_amount
            FROM bets
            WHERE match_id = ?
            GROUP BY player_name
        ''', (match_id,))
        
        bet_stats = {}
        for row in cursor.fetchall():
            bet_stats[row['player_name']] = {
                'bet_count': row['bet_count'],
                'total_amount': float(row['total_amount'])
            }
        
        # Calculate current odds
        odds_data = calculate_odds(match_id)
        
        # Serialize date/time fields
        date = match_info['date']
        if hasattr(date, 'strftime'):
            date = date.strftime('%Y-%m-%d')
        
        start_time = match_info['start_time']
        if hasattr(start_time, 'strftime'):
            start_time = start_time.strftime('%H:%M')
        
        return jsonify({
            'match': {
                'player1_name': match_info['player1_name'],
                'player2_name': match_info['player2_name'],
                'date': date,
                'start_time': start_time,
                'total_pool': float(match_info['total_pool']),
                'status': match_info['status'],
                'betting_enabled': match_info['betting_enabled']
            },
            'betting_stats': bet_stats,
            'odds': odds_data.get('odds', {}),
            'payout_pool': odds_data.get('payout_pool', 0)
        })
        
    except Exception as e:
        logger.error(f'Error fetching match bets for match {match_id}: {str(e)}')
        return jsonify({'error': f'Erro ao buscar estatísticas: {str(e)}'}), 500
    finally:
        db.close()

@betting_bp.route('/cancel-bet/<int:bet_id>', methods=['DELETE'])
@require_auth
def cancel_bet(bet_id):
    """Cancel a bet (only for upcoming matches)"""
    db = get_db()
    try:
        # Check if bet exists and belongs to user
        cursor = db.execute('''
            SELECT b.id, b.amount, b.match_id, m.status as match_status
            FROM bets b
            JOIN matches m ON b.match_id = m.id
            WHERE b.id = ? AND b.user_id = ? AND b.status = 'active'
        ''', (bet_id, request.user_id))
        
        bet = cursor.fetchone()
        if not bet:
            return jsonify({'error': 'Aposta não encontrada'}), 404
        
        if bet['match_status'] != 'upcoming':
            return jsonify({'error': 'Não é possível cancelar aposta de partida em andamento'}), 400
        
        # Cancel bet
        db.execute('UPDATE bets SET status = ? WHERE id = ?', ('refunded', bet_id))
        
        # Update match pool
        update_match_pool(bet['match_id'], -float(bet['amount']))
        
        db.commit()
        
        logger.info(f'Bet cancelled: bet_id={bet_id}, user_id={request.user_id}')
        return jsonify({'message': 'Aposta cancelada com sucesso'})
        
    except Exception as e:
        logger.error(f'Error cancelling bet {bet_id}: {str(e)}')
        return jsonify({'error': f'Erro ao cancelar aposta: {str(e)}'}), 500
    finally:
        db.close()