from flask import Blueprint, request, jsonify
from src.database import get_db
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
        
        # Settle bets
        if total_winning_amount > 0:
            # Calculate payout ratio
            payout_ratio = total_winnings / total_winning_amount
            
            # Update winning bets
            for bet in winning_bets:
                payout = Decimal(str(bet['amount'])) * payout_ratio
                db.execute('''
                    UPDATE bets SET status = ?, potential_return = ? 
                    WHERE id = ?
                ''', ('won', float(payout), bet['id']))
        
        # Update losing bets
        db.execute('''
            UPDATE bets SET status = ? 
            WHERE match_id = ? AND player_name != ? AND status = 'active'
        ''', ('lost', match_id, winner_name))
        
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
    db = get_db()
    try:
        # Check if match exists
        cursor = db.execute('SELECT * FROM matches WHERE id = ?', (match_id,))
        match = cursor.fetchone()
        
        if not match:
            return jsonify({'error': 'Partida não encontrada'}), 404
        
        if match['status'] == 'finished':
            return jsonify({'error': 'Não é possível cancelar partida finalizada'}), 400
        
        # Update match status
        db.execute('UPDATE matches SET status = ? WHERE id = ?', ('cancelled', match_id))
        
        # Refund all active bets
        cursor = db.execute('''
            UPDATE bets SET status = ? 
            WHERE match_id = ? AND status = 'active'
        ''', ('refunded', match_id))
        
        refunded_count = cursor.rowcount
        
        db.commit()
        
        return jsonify({
            'message': 'Partida cancelada e apostas reembolsadas',
            'refunded_bets': refunded_count
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
                   mr.winner_name, mr.score, mr.total_winnings
            FROM matches m
            JOIN schedules s ON m.schedule_id = s.id
            LEFT JOIN match_results mr ON m.id = mr.match_id
            WHERE m.id = ?
        ''', (match_id,))
        
        match_info = cursor.fetchone()
        if not match_info:
            return jsonify({'error': 'Partida não encontrada'}), 404
        
        # Get all bets with user info
        cursor = db.execute('''
            SELECT b.id, b.amount, b.player_name, b.status, b.potential_return,
                   u.name as user_name, u.email as user_email
            FROM bets b
            JOIN users u ON b.user_id = u.id
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
                'user_email': row['user_email']
            }
            bets.append(bet)
            total_pool += bet['amount']
            total_bettors += 1
        
        return jsonify({
            'match': {
                'player1_name': match_info['player1_name'],
                'player2_name': match_info['player2_name'],
                'date': match_info['date'],
                'start_time': match_info['start_time']
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
        # Get match statistics
        cursor = db.execute('''
            SELECT 
                m.status,
                COUNT(*) as match_count,
                SUM(m.total_pool) as total_pool,
                AVG(m.total_pool) as avg_pool
            FROM matches m
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
                SUM(b.potential_return) as total_returns
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
        
        return jsonify({
            'match_statistics': match_stats,
            'bet_statistics': bet_stats
        })
        
    except Exception as e:
        return jsonify({'error': 'Erro ao gerar relatórios'}), 500
    finally:
        db.close()