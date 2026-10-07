from flask import Blueprint, jsonify, request

from src.auth import require_admin_auth
from src.database import get_db
from src.services import tournament_schedule_service as schedule
from src.services import tournament_service as svc

admin_tournament_schedule_bp = Blueprint('admin_tournament_schedule', __name__, url_prefix='/api/admin/tournaments')


def _body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise svc.TournamentError('Corpo da requisição inválido.')
    return data


def _write(fn, *args, **kwargs):
    """Run a schedule change in one transaction and answer with the schedule as it is afterwards."""
    with get_db() as db:
        result = fn(db, *args, **kwargs)
        db.commit()
        return jsonify(result)


@admin_tournament_schedule_bp.route('/<int:tournament_id>/schedule', methods=['GET'])
@require_admin_auth
@svc.tournament_errors
def get_schedule(tournament_id):
    with get_db() as db:
        return jsonify(schedule.get_schedule(db, tournament_id))


@admin_tournament_schedule_bp.route('/<int:tournament_id>/schedule/sessions', methods=['POST'])
@require_admin_auth
@svc.tournament_errors
def create_session(tournament_id):
    response = _write(schedule.create_session, tournament_id, _body(), request.user_id)
    response.status_code = 201
    return response


@admin_tournament_schedule_bp.route('/<int:tournament_id>/schedule/sessions/<int:session_id>', methods=['PUT'])
@require_admin_auth
@svc.tournament_errors
def update_session(tournament_id, session_id):
    return _write(schedule.update_session, tournament_id, session_id, _body(), request.user_id)


@admin_tournament_schedule_bp.route('/<int:tournament_id>/schedule/sessions/<int:session_id>', methods=['DELETE'])
@require_admin_auth
@svc.tournament_errors
def delete_session(tournament_id, session_id):
    return _write(schedule.delete_session, tournament_id, session_id, request.user_id)


@admin_tournament_schedule_bp.route('/<int:tournament_id>/schedule/blocks', methods=['PUT'])
@require_admin_auth
@svc.tournament_errors
def set_block(tournament_id):
    return _write(schedule.set_block, tournament_id, _body(), request.user_id)


@admin_tournament_schedule_bp.route('/<int:tournament_id>/schedule/place', methods=['POST'])
@require_admin_auth
@svc.tournament_errors
def place(tournament_id):
    data = _body()
    return _write(schedule.place_match, tournament_id, svc.parse_id(data.get('match_id'), 'Partida'), data, request.user_id,
                  force=data.get('force') is True)


@admin_tournament_schedule_bp.route('/<int:tournament_id>/schedule/swap', methods=['POST'])
@require_admin_auth
@svc.tournament_errors
def swap(tournament_id):
    data = _body()
    return _write(schedule.swap_matches, tournament_id, svc.parse_id(data.get('match_id'), 'Partida'),
                  svc.parse_id(data.get('other_match_id'), 'Outra partida'), request.user_id, force=data.get('force') is True)


@admin_tournament_schedule_bp.route('/<int:tournament_id>/schedule/matches/<int:match_id>', methods=['DELETE'])
@require_admin_auth
@svc.tournament_errors
def unplace(tournament_id, match_id):
    return _write(schedule.unplace_match, tournament_id, match_id, request.user_id)


@admin_tournament_schedule_bp.route('/<int:tournament_id>/schedule/matches/<int:match_id>/lock', methods=['PUT'])
@require_admin_auth
@svc.tournament_errors
def lock(tournament_id, match_id):
    return _write(schedule.set_lock, tournament_id, match_id, _body().get('locked'), request.user_id)


@admin_tournament_schedule_bp.route('/<int:tournament_id>/schedule/publish', methods=['POST'])
@require_admin_auth
@svc.tournament_errors
def publish(tournament_id):
    return _write(schedule.set_published, tournament_id, True, request.user_id)


@admin_tournament_schedule_bp.route('/<int:tournament_id>/schedule/unpublish', methods=['POST'])
@require_admin_auth
@svc.tournament_errors
def unpublish(tournament_id):
    return _write(schedule.set_published, tournament_id, False, request.user_id)


@admin_tournament_schedule_bp.route('/<int:tournament_id>/schedule/distribute', methods=['POST'])
@require_admin_auth
@svc.tournament_errors
def distribute(tournament_id):
    with get_db() as db:
        return jsonify(schedule.distribute_preview(db, tournament_id, _body()))


@admin_tournament_schedule_bp.route('/<int:tournament_id>/schedule/apply', methods=['POST'])
@require_admin_auth
@svc.tournament_errors
def apply(tournament_id):
    return _write(schedule.apply_assignments, tournament_id, _body(), request.user_id)


@admin_tournament_schedule_bp.route('/<int:tournament_id>/registrations/<int:registration_id>/unavailability', methods=['GET'])
@require_admin_auth
@svc.tournament_errors
def get_unavailability(tournament_id, registration_id):
    with get_db() as db:
        return jsonify(schedule.get_unavailability(db, tournament_id, registration_id))


@admin_tournament_schedule_bp.route('/<int:tournament_id>/registrations/<int:registration_id>/unavailability', methods=['PUT'])
@require_admin_auth
@svc.tournament_errors
def set_unavailability(tournament_id, registration_id):
    return _write(schedule.set_unavailability, tournament_id, registration_id, _body().get('items'), request.user_id)
