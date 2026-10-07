from flask import Blueprint, jsonify, request

from src.auth import get_optional_user
from src.database import get_db
from src.services import tournament_public as public
from src.services import tournament_service as svc

tournaments_bp = Blueprint('tournaments', __name__, url_prefix='/api/tournaments')

PENDING_MESSAGE = ('Inscrição recebida! O organizador entrará em contato pelo telefone informado. '
                   'Quando for confirmada, seu nome aparecerá na lista de inscritos.')
WAITLIST_MESSAGE = ('Inscrição recebida na lista de espera: a categoria está lotada. '
                    'Se abrir vaga, o organizador entrará em contato pelo telefone informado.')


def _client_ip():
    forwarded = request.headers.get('X-Forwarded-For', '').split(',')[0].strip()
    return forwarded or request.remote_addr


@tournaments_bp.route('/<slug>/registrations', methods=['POST'])
@svc.tournament_errors
def register(slug):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise svc.TournamentError('Corpo da requisição inválido.')

    user = get_optional_user()
    with get_db() as db:
        result = svc.submit_registration(db, slug, data, user, svc.hash_client_ip(_client_ip()))
        db.commit()

    row = result['registration']
    # Never echo contact data back: only what the sign-up page needs to confirm
    registration = None if row is None else {
        'id': row['id'], 'category_id': row['category_id'],
        'display_name': row['display_name'], 'status': row['status'],
    }
    return jsonify({
        'message': WAITLIST_MESSAGE if result['waitlisted'] else PENDING_MESSAGE,
        'waitlisted': result['waitlisted'],
        'registration': registration,
    }), 201


# --- reading: the tracking screen --------------------------------------------------------------------------

def _read(fn):
    """Run a read with a connection. Registrations whose deadline passed are closed first (no scheduler on serverless)."""
    with get_db() as db:
        svc.sync_registration_window(db)
        return jsonify(fn(db))


@tournaments_bp.route('', methods=['GET'])
@svc.tournament_errors
def overview():
    return _read(public.get_overview)


@tournaments_bp.route('/<slug>', methods=['GET'])
@svc.tournament_errors
def tournament(slug):
    return _read(lambda db: public.get_tournament(db, slug))


@tournaments_bp.route('/<slug>/categories/<int:category_id>', methods=['GET'])
@svc.tournament_errors
def category(slug, category_id):
    return _read(lambda db: public.get_category(db, slug, category_id))


@tournaments_bp.route('/<slug>/matches', methods=['GET'])
@svc.tournament_errors
def matches(slug):
    return _read(lambda db: public.list_matches(
        db, slug, request.args.get('view'), request.args.get('category', type=int), request.args.get('stage') or None))
