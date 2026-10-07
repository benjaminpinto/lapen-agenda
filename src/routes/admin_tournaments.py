from flask import Blueprint, jsonify, request

from src.auth import require_admin_auth
from src.database import get_db
from src.services import tournament_draw_service as draw_svc
from src.services import tournament_results as results_svc
from src.services import tournament_service as svc

admin_tournaments_bp = Blueprint('admin_tournaments', __name__, url_prefix='/api/admin/tournaments')


def _body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise svc.TournamentError('Corpo da requisição inválido.')
    return data


@admin_tournaments_bp.route('', methods=['GET'])
@require_admin_auth
@svc.tournament_errors
def list_tournaments():
    with get_db() as db:
        svc.sync_registration_window(db)
        return jsonify({'tournaments': svc.list_tournaments(db)})


@admin_tournaments_bp.route('/pending-summary', methods=['GET'])
@require_admin_auth
@svc.tournament_errors
def pending_summary():
    with get_db() as db:
        svc.sync_registration_window(db)
        return jsonify(results_svc.pending_summary(db))


@admin_tournaments_bp.route('', methods=['POST'])
@require_admin_auth
@svc.tournament_errors
def create_tournament():
    data = _body()
    with get_db() as db:
        row = svc.create_tournament(db, data, request.user_id)
        db.commit()
        return jsonify({'tournament': svc.serialize_tournament(row)}), 201


@admin_tournaments_bp.route('/<int:tournament_id>', methods=['GET'])
@require_admin_auth
@svc.tournament_errors
def get_tournament(tournament_id):
    with get_db() as db:
        svc.sync_registration_window(db)
        return jsonify(svc.get_tournament_detail(db, tournament_id))


@admin_tournaments_bp.route('/<int:tournament_id>', methods=['PUT'])
@require_admin_auth
@svc.tournament_errors
def update_tournament(tournament_id):
    data = _body()
    with get_db() as db:
        row = svc.update_tournament(db, tournament_id, data, request.user_id)
        db.commit()
        return jsonify({'tournament': svc.serialize_tournament(row)})


@admin_tournaments_bp.route('/<int:tournament_id>/status', methods=['PUT'])
@require_admin_auth
@svc.tournament_errors
def change_tournament_status(tournament_id):
    data = _body()
    with get_db() as db:
        row = svc.change_status(db, tournament_id, data.get('status'), request.user_id)
        db.commit()
        return jsonify({'tournament': svc.serialize_tournament(row)})


@admin_tournaments_bp.route('/<int:tournament_id>', methods=['DELETE'])
@require_admin_auth
@svc.tournament_errors
def delete_tournament(tournament_id):
    with get_db() as db:
        svc.delete_tournament(db, tournament_id, request.user_id)
        db.commit()
        return jsonify({'success': True, 'message': 'Torneio excluído'})


@admin_tournaments_bp.route('/<int:tournament_id>/categories', methods=['POST'])
@require_admin_auth
@svc.tournament_errors
def create_category(tournament_id):
    data = _body()
    with get_db() as db:
        row = svc.create_category(db, tournament_id, data, request.user_id)
        db.commit()
        return jsonify({'category': svc.serialize_category(row)}), 201


@admin_tournaments_bp.route('/<int:tournament_id>/categories/<int:category_id>', methods=['PUT'])
@require_admin_auth
@svc.tournament_errors
def update_category(tournament_id, category_id):
    data = _body()
    with get_db() as db:
        row = svc.update_category(db, tournament_id, category_id, data, request.user_id)
        db.commit()
        return jsonify({'category': svc.serialize_category(row)})


@admin_tournaments_bp.route('/<int:tournament_id>/categories/<int:category_id>', methods=['DELETE'])
@require_admin_auth
@svc.tournament_errors
def delete_category(tournament_id, category_id):
    with get_db() as db:
        svc.delete_category(db, tournament_id, category_id, request.user_id)
        db.commit()
        return jsonify({'success': True, 'message': 'Categoria excluída'})


@admin_tournaments_bp.route('/<int:tournament_id>/registrations', methods=['GET'])
@require_admin_auth
@svc.tournament_errors
def list_registrations(tournament_id):
    with get_db() as db:
        return jsonify(svc.list_registrations(
            db, tournament_id,
            category_id=request.args.get('category_id', type=int),
            status=request.args.get('status') or None,
            query=request.args.get('q') or None,
        ))


@admin_tournaments_bp.route('/<int:tournament_id>/registrations', methods=['POST'])
@require_admin_auth
@svc.tournament_errors
def create_registration(tournament_id):
    data = _body()
    with get_db() as db:
        row = svc.create_registration_manual(db, tournament_id, data, request.user_id)
        db.commit()
        return jsonify({'registration': svc.serialize_registration(row)}), 201


@admin_tournaments_bp.route('/<int:tournament_id>/registrations/batch', methods=['POST'])
@require_admin_auth
@svc.tournament_errors
def batch_registrations(tournament_id):
    data = _body()
    with get_db() as db:
        result = svc.batch_update_registrations(
            db, tournament_id, data.get('ids'), data.get('status'), data.get('rejection_reason'), request.user_id)
        db.commit()
        return jsonify(result)


@admin_tournaments_bp.route('/<int:tournament_id>/registrations/<int:registration_id>', methods=['PATCH'])
@require_admin_auth
@svc.tournament_errors
def update_registration(tournament_id, registration_id):
    data = _body()
    with get_db() as db:
        row = svc.update_registration(db, tournament_id, registration_id, data, request.user_id)
        if row['status'] == 'withdrawn':
            results_svc.apply_withdrawal(db, tournament_id, registration_id, request.user_id)
        db.commit()
        return jsonify({'registration': svc.serialize_registration(row)})


# --- draw ---------------------------------------------------------------------------------------------

DRAW_URL = '/<int:tournament_id>/categories/<int:category_id>/draw'


@admin_tournaments_bp.route(DRAW_URL, methods=['GET'])
@require_admin_auth
@svc.tournament_errors
def get_draw(tournament_id, category_id):
    with get_db() as db:
        return jsonify(draw_svc.get_draw(db, tournament_id, category_id))


@admin_tournaments_bp.route(DRAW_URL, methods=['POST'])
@require_admin_auth
@svc.tournament_errors
def generate_draw(tournament_id, category_id):
    with get_db() as db:
        result = draw_svc.generate_draw(db, tournament_id, category_id, request.user_id)
        db.commit()
        return jsonify(result)


@admin_tournaments_bp.route(DRAW_URL, methods=['PUT'])
@require_admin_auth
@svc.tournament_errors
def swap_draw_entries(tournament_id, category_id):
    pair = _body().get('swap')
    if not isinstance(pair, list) or len(pair) != 2:
        raise svc.TournamentError('Informe os dois inscritos a trocar em "swap".')
    first, second = (svc.parse_id(value, 'Inscrito') for value in pair)
    with get_db() as db:
        result = draw_svc.swap_entries(db, tournament_id, category_id, first, second, request.user_id)
        db.commit()
        return jsonify(result)


@admin_tournaments_bp.route(DRAW_URL + '/publish', methods=['POST'])
@require_admin_auth
@svc.tournament_errors
def publish_draw(tournament_id, category_id):
    with get_db() as db:
        result = draw_svc.publish_draw(db, tournament_id, category_id, request.user_id)
        db.commit()
        return jsonify(result)


@admin_tournaments_bp.route(DRAW_URL, methods=['DELETE'])
@require_admin_auth
@svc.tournament_errors
def undo_draw(tournament_id, category_id):
    with get_db() as db:
        draw_svc.undo_draw(db, tournament_id, category_id, request.user_id)
        db.commit()
        return jsonify({'success': True, 'message': 'Sorteio desfeito'})


# --- results ------------------------------------------------------------------------------------------

RESULT_URL = '/<int:tournament_id>/matches/<int:match_id>/result'


@admin_tournaments_bp.route(RESULT_URL, methods=['PUT'])
@require_admin_auth
@svc.tournament_errors
def record_result(tournament_id, match_id):
    data = _body()
    with get_db() as db:
        result = results_svc.record_result(db, tournament_id, match_id, data, request.user_id)
        db.commit()
        return jsonify(result)


@admin_tournaments_bp.route(RESULT_URL, methods=['PATCH'])
@require_admin_auth
@svc.tournament_errors
def correct_result(tournament_id, match_id):
    data = _body()
    with get_db() as db:
        result = results_svc.correct_result(db, tournament_id, match_id, data, request.user_id)
        db.commit()
        return jsonify(result)


@admin_tournaments_bp.route(RESULT_URL, methods=['DELETE'])
@require_admin_auth
@svc.tournament_errors
def annul_result(tournament_id, match_id):
    with get_db() as db:
        result = results_svc.annul_result(db, tournament_id, match_id, request.user_id)
        db.commit()
        return jsonify(result)


@admin_tournaments_bp.route('/<int:tournament_id>/categories/<int:category_id>/standings', methods=['GET'])
@require_admin_auth
@svc.tournament_errors
def get_standings(tournament_id, category_id):
    with get_db() as db:
        return jsonify(results_svc.get_standings(db, tournament_id, category_id))


@admin_tournaments_bp.route('/<int:tournament_id>/groups/<int:group_id>/tiebreak', methods=['PUT'])
@require_admin_auth
@svc.tournament_errors
def set_group_tiebreak(tournament_id, group_id):
    data = _body()
    with get_db() as db:
        result = results_svc.set_group_tiebreak(db, tournament_id, group_id, data.get('order'), request.user_id)
        db.commit()
        return jsonify(result)
