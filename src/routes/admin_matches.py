from flask import Blueprint, request, jsonify
from src.database import get_db
from src.email_service import send_winner_notification_email, send_bet_settlement_email
from decimal import Decimal

admin_matches_bp = Blueprint('admin_matches', __name__, url_prefix='/api/admin/matches')

@admin_matches_bp.route('/<int:match_id>/finish', methods=['POST'])
def finish_match(match_id):
    """Finish a match and settle all bets"""
    data = request.get_json()
    winner_name = data.get('winner_name')
    score = data.get('score', '')
    
    if not winner_name:
        return jsonify({'error': 'Nome do vencedor é obrigatório'}), 400
    
    db = get_db()
    try:
        # Check if match exists and is not already finished
        cursor = db.execute('SELECT * FROM matches WHERE id = ?', (match_id,))
        match = cursor.fetchone()
        
        if not match:
            return jsonify({'error': 'Partida não encontrada'}), 404
        
        if match['status'] == 'finished':
            return jsonify({'error': 'Partida já foi finalizada'}), 400
        
        # Get total pool and calculate winnings
        cursor = db.execute('''
            SELECT SUM(amount) as total_pool FROM bets 
            WHERE match_id = ? AND status = 'active'
        ''', (match_id,))
        
        pool_result = cursor.fetchone()
        total_pool = Decimal(str(pool_result['total_pool'] or 0))
        
        # Apply 20% house edge
        total_winnings = total_pool * Decimal('0.8')
        
        # Get winning bets
        cursor = db.execute('''
            SELECT id, amount FROM bets 
            WHERE match_id = ? AND player_name = ? AND status = 'active'
        ''', (match_id, winner_name))
        
        winning_bets = cursor.fetchall()
        
        # Calculate total winning bet amount
        total_winning_amount = sum(Decimal(str(bet['amount'])) for bet in winning_bets)
        
        # Update match status
        db.execute('UPDATE matches SET status = ? WHERE id = ?', ('finished', match_id))
        
        # Create match result record
        cursor = db.execute('''
            INSERT INTO match_results (match_id, winner_name, score, total_winnings, settled)
            VALUES (?, ?, ?, ?, ?)
        ''', (match_id, winner_name, score, float(total_winnings), True))
        
        # Get match details for emails
        cursor = db.execute('''
            SELECT s.player1_name, s.player2_name
            FROM schedules s
            JOIN matches m ON s.id = m.schedule_id
            WHERE m.id = ?
        ''', (match_id,))
        match_info = cursor.fetchone()
        match_details = {
            'match': f"{match_info['player1_name']} vs {match_info['player2_name']}",
            'winner': winner_name
        }
        
        # Settle bets and send notifications
        if total_winning_amount > 0:
            # Calculate payout ratio
            payout_ratio = total_winnings / total_winning_amount
            
            # Update winning bets and send winner emails
            for bet in winning_bets:
                payout = Decimal(str(bet['amount'])) * payout_ratio
                db.execute('''
                    UPDATE bets SET status = ?, potential_return = ? 
                    WHERE id = ?
                ''', ('won', float(payout), bet['id']))
                
                # Get user info and send winner email
                cursor = db.execute('SELECT name, email FROM users WHERE id = ?', (bet['user_id'],))
                user = cursor.fetchone()
                if user:
                    send_winner_notification_email(user['email'], user['name'], match_details, float(payout))
                    send_bet_settlement_email(user['email'], user['name'], match_details, 'won', float(payout))
        
        # Update losing bets and send settlement emails
        cursor = db.execute('''
            SELECT b.user_id, u.name, u.email
            FROM bets b
            JOIN users u ON b.user_id = u.id
            WHERE b.match_id = ? AND b.player_name != ? AND b.status = 'active'
        ''', (match_id, winner_name))
        
        losing_users = cursor.fetchall()
        
        db.execute('''
            UPDATE bets SET status = ? 
            WHERE match_id = ? AND player_name != ? AND status = 'active'
        ''', ('lost', match_id, winner_name))
        
        # Send settlement emails to losing bettors
        for user in losing_users:
            send_bet_settlement_email(user['email'], user['name'], match_details, 'lost', 0)
        
        db.commit()
        
        return jsonify({
            'message': 'Partida finalizada e apostas liquidadas',
            'total_pool': float(total_pool),
            'total_winnings': float(total_winnings),
            'winning_bets_count': len(winning_bets)
        })
        
    except Exception as e:
        db.rollback()
        return jsonify({'error': 'Erro ao finalizar partida'}), 500
    finally:
        db.close()

@admin_matches_bp.route('/<int:match_id>/cancel', methods=['POST'])
def cancel_match(match_id):
    """Cancel a match and refund all bets"""
    import os
    import stripe
    
    db = get_db()
    try:
        # Check if match exists
        cursor = db.execute('SELECT * FROM matches WHERE id = ?', (match_id,))
        match = cursor.fetchone()
        
        if not match:
            return jsonify({'error': 'Partida não encontrada'}), 404
        
        if match['status'] == 'finished':
            return jsonify({'error': 'Não é possível cancelar partida finalizada'}), 400
        
        # Get all active bets for this match
        cursor = db.execute('''
            SELECT b.id, b.user_id, b.amount, b.payment_intent_id
            FROM bets b
            WHERE b.match_id = ? AND b.status = 'active'
        ''', (match_id,))
        
        active_bets = cursor.fetchall()
        refunded_count = 0
        failed_refunds = 0
        
        # Process refunds for each bet
        for bet in active_bets:
            refund_status = 'pending'
            stripe_refund_id = None
            failure_reason = None
            
            try:
                # Check if mock mode is active
                if os.getenv('STRIPE_MOCK_ACTIVE', 'false').lower() == 'true':
                    # Mock refund - always succeed
                    refund_status = 'succeeded'
                    stripe_refund_id = f'mock_refund_{bet["id"]}'
                else:
                    # Real Stripe refund
                    stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
                    refund = stripe.Refund.create(
                        payment_intent=bet['payment_intent_id'],
                        amount=int(float(bet['amount']) * 100)  # Convert to cents
                    )
                    refund_status = refund.status
                    stripe_refund_id = refund.id
                    
                if refund_status == 'succeeded':
                    refunded_count += 1
                else:
                    failed_refunds += 1
                    
            except Exception as refund_error:
                refund_status = 'failed'
                failure_reason = str(refund_error)
                failed_refunds += 1
            
            # Record refund attempt
            db.execute('''
                INSERT INTO refunds (bet_id, user_id, amount, stripe_refund_id, status, failure_reason)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (bet['id'], bet['user_id'], bet['amount'], stripe_refund_id, refund_status, failure_reason))
        
        # Update match status
        db.execute('UPDATE matches SET status = ? WHERE id = ?', ('cancelled', match_id))
        
        # Update bet status
        db.execute('''
            UPDATE bets SET status = ? 
            WHERE match_id = ? AND status = 'active'
        ''', ('refunded', match_id))
        
        db.commit()
        
        return jsonify({
            'message': 'Partida cancelada',
            'refunded_bets': refunded_count,
            'failed_refunds': failed_refunds,
            'total_bets': len(active_bets)
        })
        
    except Exception as e:
        db.rollback()
        return jsonify({'error': 'Erro ao cancelar partida'}), 500
    finally:
        db.close()

@admin_matches_bp.route('/<int:match_id>/report', methods=['GET'])
def get_match_report(match_id):
    """Get comprehensive match report with all betting details"""
    db = get_db()
    try:
        # Get match info
        cursor = db.execute('''
            SELECT s.player1_name, s.player2_name, s.date, s.start_time,
                   mr.winner_name, mr.score, mr.total_winnings, m.status
            FROM matches m
            JOIN schedules s ON m.schedule_id = s.id
            LEFT JOIN match_results mr ON m.id = mr.match_id
            WHERE m.id = ?
        ''', (match_id,))
        
        match_info = cursor.fetchone()
        if not match_info:
            return jsonify({'error': 'Partida não encontrada'}), 404
        
        # Get all bets with user info and refund status
        cursor = db.execute('''
            SELECT b.id, b.amount, b.player_name, b.status, b.potential_return,
                   u.name as user_name, u.email as user_email,
                   r.status as refund_status, r.failure_reason
            FROM bets b
            JOIN users u ON b.user_id = u.id
            LEFT JOIN refunds r ON b.id = r.bet_id
            WHERE b.match_id = ?
            ORDER BY b.player_name, b.amount DESC
        ''', (match_id,))
        
        bets = []
        total_pool = 0
        total_bettors = 0
        
        for row in cursor.fetchall():
            bet = {
                'id': row['id'],
                'amount': float(row['amount']),
                'player_name': row['player_name'],
                'status': row['status'],
                'potential_return': float(row['potential_return'] or 0),
                'user_name': row['user_name'],
                'user_email': row['user_email'],
                'refund_status': row['refund_status'],
                'refund_failure_reason': row['failure_reason']
            }
            bets.append(bet)
            total_pool += bet['amount']
            total_bettors += 1
        
        return jsonify({
            'match': {
                'player1_name': match_info['player1_name'],
                'player2_name': match_info['player2_name'],
                'date': match_info['date'],
                'start_time': match_info['start_time'],
                'status': match_info['status']
            },
            'bets': bets,
            'summary': {
                'winner': match_info['winner_name'],
                'score': match_info['score'],
                'total_pool': total_pool,
                'total_bettors': total_bettors,
                'total_winnings': float(match_info['total_winnings'] or 0)
            }
        })
        
    except Exception as e:
        return jsonify({'error': 'Erro ao gerar relatório'}), 500
    finally:
        db.close()

@admin_matches_bp.route('/<int:match_id>/result', methods=['GET'])
def get_match_result(match_id):
    """Get match result information"""
    db = get_db()
    try:
        cursor = db.execute('SELECT winner_name, score FROM match_results WHERE match_id = ?', (match_id,))
        result = cursor.fetchone()
        
        if not result:
            return jsonify({'error': 'Resultado não encontrado'}), 404
        
        return jsonify({
            'winner_name': result['winner_name'],
            'score': result['score']
        })
        
    except Exception as e:
        return jsonify({'error': 'Erro ao buscar resultado'}), 500
    finally:
        db.close()

@admin_matches_bp.route('/reports', methods=['GET'])
def get_betting_reports():
    """Get betting reports and statistics"""
    db = get_db()
    try:
        # Get match statistics with proper pool calculation
        cursor = db.execute('''
            SELECT 
                m.status,
                COUNT(*) as match_count,
                COALESCE(SUM(pool_totals.total_pool), 0) as total_pool,
                COALESCE(AVG(pool_totals.total_pool), 0) as avg_pool
            FROM matches m
            LEFT JOIN (
                SELECT match_id, SUM(amount) as total_pool
                FROM bets 
                GROUP BY match_id
            ) pool_totals ON m.id = pool_totals.match_id
            GROUP BY m.status
        ''')
        
        match_stats = {}
        for row in cursor.fetchall():
            match_stats[row['status']] = {
                'count': row['match_count'],
                'total_pool': float(row['total_pool'] or 0),
                'avg_pool': float(row['avg_pool'] or 0)
            }
        
        # Get bet statistics
        cursor = db.execute('''
            SELECT 
                b.status,
                COUNT(*) as bet_count,
                SUM(b.amount) as total_amount,
                SUM(COALESCE(b.potential_return, 0)) as total_returns
            FROM bets b
            GROUP BY b.status
        ''')
        
        bet_stats = {}
        for row in cursor.fetchall():
            bet_stats[row['status']] = {
                'count': row['bet_count'],
                'total_amount': float(row['total_amount'] or 0),
                'total_returns': float(row['total_returns'] or 0)
            }
        
        # Get additional analytics
        cursor = db.execute('''
            SELECT COUNT(DISTINCT user_id) as unique_bettors
            FROM bets
        ''')
        unique_bettors = cursor.fetchone()['unique_bettors']
        
        return jsonify({
            'match_statistics': match_stats,
            'bet_statistics': bet_stats,
            'analytics': {
                'unique_bettors': unique_bettors,
                'house_edge': 0.2
            }
        })
        
    except Exception as e:
        return jsonify({'error': 'Erro ao gerar relatórios'}), 500
    finally:
        db.close()