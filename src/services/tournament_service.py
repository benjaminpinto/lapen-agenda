"""Tournament module business rules: lifecycle, categories and registrations.

Independent of the ranking tables. Functions take an open DB connection and never commit
(except sync_registration_window), so routes decide the transaction boundary.
Business-rule violations raise TournamentError, which `tournament_errors` turns into JSON.
"""
import hashlib
import json
import re
import unicodedata
from datetime import date, datetime
from functools import wraps

from flask import current_app, jsonify

from src.services.tournament_schedule import person_map
from src.utils.time_utils import local_now

ACTIVE_STATUSES = ('registration_open', 'registration_closed', 'in_progress')
TERMINAL_STATUSES = ('finished', 'cancelled')
MATCH_FORMATS = ('best_of_3_super_tb', 'pro_set_8', 'single_set_6')
DRAW_FORMATS = ('knockout', 'round_robin', 'groups_knockout')
# Category statuses in which the draw is already public
DRAWN_CATEGORY_STATUSES = ('published', 'group_stage', 'knockout_stage', 'finished')
REGISTRATION_STATUSES = ('pending', 'confirmed', 'rejected', 'cancelled', 'waitlist', 'withdrawn')

TOURNAMENT_TRANSITIONS = {
    'draft': {'registration_open', 'cancelled'},
    'registration_open': {'registration_closed', 'cancelled'},
    'registration_closed': {'registration_open', 'in_progress', 'cancelled'},
    'in_progress': {'finished', 'cancelled'},
    'finished': set(),
    'cancelled': set(),
}

REGISTRATION_TRANSITIONS = {
    'pending': {'confirmed', 'rejected', 'cancelled'},
    'waitlist': {'pending', 'confirmed', 'rejected', 'cancelled'},
    'confirmed': {'cancelled', 'withdrawn'},
    'rejected': set(),
    'cancelled': set(),
    'withdrawn': set(),
}

REGISTRATION_RATE_LIMIT_PER_HOUR = 5
MAX_BATCH_SIZE = 200

SLUG_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

UNIQUE_VIOLATION = '23505'

TOURNAMENT_FIELDS = ('name', 'description', 'location', 'start_date', 'end_date', 'registration_opens_at',
                     'registration_closes_at', 'rules_text', 'contact_info', 'match_format', 'no_ad',
                     'match_tiebreak_points')
CATEGORY_FIELDS = ('name', 'max_entries', 'min_entries', 'draw_format', 'group_target_size', 'qualifiers_per_group',
                   'num_seeds', 'wo_tolerance_min', 'min_rest_min', 'sort_order')
# Changing these after the draw would invalidate it
CATEGORY_DRAW_FIELDS = ('draw_format', 'group_target_size', 'qualifiers_per_group', 'num_seeds')
REGISTRATION_CONTACT_FIELDS = ('full_name', 'display_name', 'email', 'phone', 'notes')


class TournamentError(Exception):
    def __init__(self, message, status_code=400, code=None, **extra):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.extra = extra


def tournament_errors(fn):
    """Turn TournamentError into a JSON error response (the route's DB context rolls back first)."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except TournamentError as exc:
            body = {'error': exc.message}
            if exc.code:
                body['code'] = exc.code
            body.update(exc.extra)
            return jsonify(body), exc.status_code
    return wrapper


# --- parsing -------------------------------------------------------------------

def _text(value, label, max_len, required=False, min_len=0, multiline=False):
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise TournamentError(f'{label} é obrigatório.')
        return None
    if not isinstance(value, str):
        raise TournamentError(f'{label} inválido.')
    value = value.strip() if multiline else ' '.join(value.split())
    if len(value) < min_len:
        raise TournamentError(f'{label} deve ter ao menos {min_len} caracteres.')
    if len(value) > max_len:
        raise TournamentError(f'{label} deve ter no máximo {max_len} caracteres.')
    return value


def _int(value, label, minimum, maximum, default=None):
    if value is None or value == '':
        return default
    if isinstance(value, bool):
        raise TournamentError(f'{label} inválido.')
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise TournamentError(f'{label} inválido.')
    if number < minimum or number > maximum:
        raise TournamentError(f'{label} deve estar entre {minimum} e {maximum}.')
    return number


def parse_id(value, label):
    """A required positive integer id coming from a request body."""
    number = _int(value, label, 1, 2**31 - 1)
    if number is None:
        raise TournamentError(f'Informe {label.lower()}.')
    return number


def _date(value, label):
    if isinstance(value, date):
        return value
    if value is None or value == '':
        raise TournamentError(f'{label} é obrigatória.')
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise TournamentError(f'{label} inválida (use AAAA-MM-DD).')


def _datetime(value, label):
    if isinstance(value, datetime):
        return value
    if value is None or value == '':
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        raise TournamentError(f'{label} inválida (use AAAA-MM-DDTHH:MM).')
    if parsed.tzinfo is not None:
        raise TournamentError(f'{label} deve ser em horário local, sem fuso.')
    return parsed


def _iso(value):
    return value.isoformat() if value is not None else None


def slugify(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii').lower()
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')[:100] or 'torneio'


# --- database helpers ------------------------------------------------------------

def _db_error(exc):
    """(SQLSTATE, constraint or index name) of a driver exception."""
    diag = getattr(exc, 'diag', None)
    return (getattr(exc, 'pgcode', None) or getattr(exc, 'sqlstate', None),
            getattr(diag, 'constraint_name', None))


def _write(db, sql, params, unique_messages):
    """Run a write and return its first row, mapping known unique violations to HTTP 409."""
    try:
        return db.execute(sql, params).fetchone()
    except Exception as exc:
        state, constraint = _db_error(exc)
        if state == UNIQUE_VIOLATION and constraint in unique_messages:
            code, message = unique_messages[constraint]
            raise TournamentError(message, 409, code=code) from exc
        raise


def log_audit(db, tournament_id, action, payload=None, category_id=None, actor_id=None):
    db.execute(
        'INSERT INTO tournament_audit_log (tournament_id, category_id, action, payload, actor_user_id) '
        'VALUES (%s, %s, %s, %s::jsonb, %s)',
        (tournament_id, category_id, action, json.dumps(payload, default=str) if payload is not None else None, actor_id)
    )


def hash_client_ip(ip):
    """Salted hash so the rate limiter never stores the raw address."""
    if not ip:
        return None
    return hashlib.sha256(f"{current_app.config['SECRET_KEY']}:{ip}".encode()).hexdigest()


# --- serializers (admin: includes contact data, never ip_hash) ----------------------

def serialize_tournament(row):
    return {
        'id': row['id'], 'name': row['name'], 'slug': row['slug'],
        'description': row['description'], 'location': row['location'],
        'start_date': _iso(row['start_date']), 'end_date': _iso(row['end_date']),
        'registration_opens_at': _iso(row['registration_opens_at']),
        'registration_closes_at': _iso(row['registration_closes_at']),
        'rules_text': row['rules_text'], 'contact_info': row['contact_info'],
        'match_format': row['match_format'], 'no_ad': row['no_ad'],
        'match_tiebreak_points': row['match_tiebreak_points'], 'status': row['status'],
        'schedule_published_at': _iso(row['schedule_published_at']),
        'created_at': _iso(row['created_at']), 'updated_at': _iso(row['updated_at']),
    }


def serialize_category(row, counts=None):
    data = {key: row[key] for key in ('id', 'tournament_id', 'name', 'max_entries', 'min_entries', 'draw_format',
                                      'group_target_size', 'qualifiers_per_group', 'num_seeds', 'wo_tolerance_min',
                                      'min_rest_min', 'status', 'sort_order')}
    if counts is not None:
        data['counts'] = counts
    return data


def serialize_registration(row):
    return {
        'id': row['id'], 'category_id': row['category_id'], 'user_id': row['user_id'],
        'is_member': row['user_id'] is not None,
        'full_name': row['full_name'], 'display_name': row['display_name'],
        'email': row['email'], 'phone': row['phone'], 'notes': row['notes'],
        'status': row['status'], 'seed': row['seed'], 'rejection_reason': row['rejection_reason'],
        'terms_accepted_at': _iso(row['terms_accepted_at']), 'data_consent_at': _iso(row['data_consent_at']),
        'reviewed_at': _iso(row['reviewed_at']), 'created_at': _iso(row['created_at']),
    }


# --- tournaments -------------------------------------------------------------------

def get_tournament(db, tournament_id, lock=False):
    row = db.execute(
        f"SELECT * FROM tournaments WHERE id = %s{' FOR UPDATE' if lock else ''}", (tournament_id,)
    ).fetchone()
    if not row:
        raise TournamentError('Torneio não encontrado.', 404)
    return row


def _other_active_tournament(db, exclude_id=None):
    return db.execute(
        'SELECT id, name, slug FROM tournaments WHERE status = ANY(%s) AND id <> COALESCE(%s, -1) LIMIT 1',
        (list(ACTIVE_STATUSES), exclude_id)
    ).fetchone()


def _has_completed_matches(db, tournament_id):
    return db.execute(
        "SELECT 1 FROM tournament_matches m JOIN tournament_categories c ON c.id = m.category_id "
        "WHERE c.tournament_id = %s AND m.status = 'completed' LIMIT 1", (tournament_id,)
    ).fetchone() is not None


def _tournament_values(data, current=None):
    current = current or {}

    def pick(key):
        return data[key] if key in data else current.get(key)

    values = {
        'name': _text(pick('name'), 'Nome', 255, required=True, min_len=3),
        'description': _text(pick('description'), 'Descrição', 5000, multiline=True),
        'location': _text(pick('location'), 'Local', 255),
        'start_date': _date(pick('start_date'), 'Data de início'),
        'end_date': _date(pick('end_date'), 'Data de término'),
        'registration_opens_at': _datetime(pick('registration_opens_at'), 'Abertura das inscrições'),
        'registration_closes_at': _datetime(pick('registration_closes_at'), 'Encerramento das inscrições'),
        'rules_text': _text(pick('rules_text'), 'Regulamento', 20000, multiline=True),
        'contact_info': _text(pick('contact_info'), 'Contato', 1000, multiline=True),
        'match_format': pick('match_format') or 'best_of_3_super_tb',
        'no_ad': pick('no_ad') if pick('no_ad') is not None else True,
        'match_tiebreak_points': _int(pick('match_tiebreak_points'), 'Pontos do match tie-break', 1, 20, default=10),
    }
    if values['match_format'] not in MATCH_FORMATS:
        raise TournamentError('Formato de partida inválido.')
    if not isinstance(values['no_ad'], bool):
        raise TournamentError('Sem vantagem deve ser verdadeiro ou falso.')
    if values['end_date'] < values['start_date']:
        raise TournamentError('A data de término não pode ser anterior à de início.')
    opens, closes = values['registration_opens_at'], values['registration_closes_at']
    if opens and closes and closes <= opens:
        raise TournamentError('O encerramento das inscrições deve ser depois da abertura.')
    return values


def create_tournament(db, data, actor_id):
    values = _tournament_values(data)
    slug = data.get('slug')
    if slug:
        if not isinstance(slug, str) or not SLUG_RE.match(slug) or len(slug) > 120:
            raise TournamentError('Endereço (slug) inválido: use letras minúsculas, números e hífens.')
    else:
        base = slug = slugify(values['name'])
        suffix = 2
        while db.execute('SELECT 1 FROM tournaments WHERE slug = %s', (slug,)).fetchone():
            slug = f'{base}-{suffix}'
            suffix += 1

    columns = ('slug',) + TOURNAMENT_FIELDS
    row = _write(
        db,
        f"INSERT INTO tournaments ({', '.join(columns)}) VALUES ({', '.join(['%s'] * len(columns))}) RETURNING *",
        [slug] + [values[field] for field in TOURNAMENT_FIELDS],
        {'tournaments_slug_key': ('slug_taken', 'Já existe um torneio com este endereço (slug).')},
    )
    log_audit(db, row['id'], 'tournament_created', {'name': row['name'], 'slug': row['slug']}, actor_id=actor_id)
    return row


def update_tournament(db, tournament_id, data, actor_id):
    current = get_tournament(db, tournament_id, lock=True)
    if current['status'] in TERMINAL_STATUSES:
        raise TournamentError('Torneio finalizado ou cancelado não pode ser alterado.', 409)

    values = _tournament_values(data, current)
    if values['match_format'] != current['match_format'] and _has_completed_matches(db, tournament_id):
        raise TournamentError('O formato de partida não pode mudar depois do primeiro resultado.', 409, code='format_locked')

    changed = {key: value for key, value in values.items() if value != current[key]}
    if not changed:
        return current
    assignments = ', '.join(f'{key} = %s' for key in changed)
    row = db.execute(
        f'UPDATE tournaments SET {assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING *',
        list(changed.values()) + [tournament_id]
    ).fetchone()
    log_audit(db, tournament_id, 'tournament_updated', {'fields': sorted(changed)}, actor_id=actor_id)
    return row


def _require_registration_window_ahead(tournament):
    closes = tournament['registration_closes_at']
    if closes and closes <= local_now():
        raise TournamentError('O encerramento das inscrições já passou: ajuste a data antes de abrir.', 409,
                              code='registration_window_past')


def change_status(db, tournament_id, target, actor_id):
    tournament = get_tournament(db, tournament_id, lock=True)
    current = tournament['status']
    if target not in TOURNAMENT_TRANSITIONS:
        raise TournamentError('Status inválido.')
    if target not in TOURNAMENT_TRANSITIONS[current]:
        raise TournamentError(f'Não é possível passar de "{current}" para "{target}".', 409, code='invalid_transition')

    categories = db.execute('SELECT id, status FROM tournament_categories WHERE tournament_id = %s', (tournament_id,)).fetchall()
    drawn = [c for c in categories if c['status'] in DRAWN_CATEGORY_STATUSES]

    if target == 'registration_open':
        if current == 'draft':
            if not categories:
                raise TournamentError('Cadastre ao menos uma categoria antes de abrir as inscrições.', 409, code='no_categories')
            other = _other_active_tournament(db, tournament_id)
            if other:
                raise TournamentError(
                    f'Finalize ou cancele o torneio "{other["name"]}" antes de abrir inscrições.', 409,
                    code='active_tournament_exists', active_tournament=dict(other))
        elif drawn:
            raise TournamentError('As inscrições só podem ser reabertas enquanto nenhuma chave estiver publicada.', 409,
                                  code='draw_published')
        _require_registration_window_ahead(tournament)
    elif target == 'in_progress' and not drawn:
        raise TournamentError('Publique o sorteio de ao menos uma categoria antes de iniciar o torneio.', 409, code='no_draw')
    elif target == 'finished' and (not categories or any(c['status'] != 'finished' for c in categories)):
        raise TournamentError('Finalize todas as categorias antes de encerrar o torneio.', 409, code='categories_unfinished')

    row = _write(
        db, 'UPDATE tournaments SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING *',
        (target, tournament_id),
        {'idx_tournaments_single_active': ('active_tournament_exists', 'Já existe um torneio ativo.')},
    )
    log_audit(db, tournament_id, 'status_changed', {'from': current, 'to': target}, actor_id=actor_id)
    return row


def delete_tournament(db, tournament_id, actor_id):
    tournament = get_tournament(db, tournament_id, lock=True)
    if tournament['status'] != 'draft':
        raise TournamentError('Só torneios em rascunho podem ser excluídos. Cancele ou finalize os demais.', 409,
                              code='not_draft')
    db.execute('DELETE FROM tournaments WHERE id = %s', (tournament_id,))


def sync_registration_window(db, now=None):
    """Lazily close registrations whose deadline passed (there is no scheduler in a serverless deploy)."""
    rows = db.execute(
        "UPDATE tournaments SET status = 'registration_closed', updated_at = CURRENT_TIMESTAMP "
        "WHERE status = 'registration_open' AND registration_closes_at IS NOT NULL AND registration_closes_at <= %s "
        "RETURNING id", (now or local_now(),)
    ).fetchall()
    for row in rows:
        log_audit(db, row['id'], 'registration_auto_closed')
    if rows:
        db.commit()
    return len(rows)


def list_tournaments(db):
    rows = db.execute('''
        SELECT t.*,
               (SELECT COUNT(*) FROM tournament_categories c WHERE c.tournament_id = t.id) AS categories_count,
               (SELECT COUNT(*) FROM tournament_registrations r JOIN tournament_categories c ON c.id = r.category_id
                 WHERE c.tournament_id = t.id AND r.status = 'pending') AS pending_registrations
        FROM tournaments t
        ORDER BY CASE WHEN t.status = ANY(%s) THEN 0 ELSE 1 END, t.start_date DESC, t.id DESC
    ''', (list(ACTIVE_STATUSES),)).fetchall()
    return [dict(serialize_tournament(r), categories_count=r['categories_count'],
                 pending_registrations=r['pending_registrations']) for r in rows]


def get_tournament_detail(db, tournament_id):
    tournament = get_tournament(db, tournament_id)
    categories = db.execute(
        'SELECT * FROM tournament_categories WHERE tournament_id = %s ORDER BY sort_order, id', (tournament_id,)
    ).fetchall()
    counts = category_counts(db, tournament_id)
    return {
        'tournament': serialize_tournament(tournament),
        'categories': [serialize_category(c, counts.get(c['id'])) for c in categories],
    }


# --- categories -------------------------------------------------------------------

def category_counts(db, tournament_id):
    """{category_id: {status: n}} with every status present."""
    rows = db.execute('''
        SELECT c.id AS category_id, r.status, COUNT(r.id) AS n
        FROM tournament_categories c LEFT JOIN tournament_registrations r ON r.category_id = c.id
        WHERE c.tournament_id = %s GROUP BY c.id, r.status
    ''', (tournament_id,)).fetchall()
    counts = {}
    for row in rows:
        bucket = counts.setdefault(row['category_id'], {status: 0 for status in REGISTRATION_STATUSES})
        if row['status']:
            bucket[row['status']] = row['n']
    return counts


def get_category(db, tournament_id, category_id, lock=False):
    row = db.execute(
        f"SELECT * FROM tournament_categories WHERE id = %s AND tournament_id = %s{' FOR UPDATE' if lock else ''}",
        (category_id, tournament_id)
    ).fetchone()
    if not row:
        raise TournamentError('Categoria não encontrada.', 404)
    return row


def _category_values(data, current=None):
    current = current or {}

    def pick(key):
        return data[key] if key in data else current.get(key)

    draw_format = pick('draw_format') or 'knockout'
    if draw_format not in DRAW_FORMATS:
        raise TournamentError('Formato de chave inválido.')
    grouped = draw_format == 'groups_knockout'
    values = {
        'name': _text(pick('name'), 'Nome da categoria', 255, required=True),
        'draw_format': draw_format,
        'min_entries': _int(pick('min_entries'), 'Mínimo de inscritos', 2, 256, default=6 if grouped else 4),
        'max_entries': _int(pick('max_entries'), 'Máximo de inscritos', 2, 256),
        'group_target_size': None,
        'qualifiers_per_group': None,
        'num_seeds': _int(pick('num_seeds'), 'Cabeças de chave', 0, 16, default=0),
        'wo_tolerance_min': _int(pick('wo_tolerance_min'), 'Tolerância de W.O.', 0, 120, default=15),
        'min_rest_min': _int(pick('min_rest_min'), 'Descanso mínimo', 0, 240, default=60),
        'sort_order': _int(pick('sort_order'), 'Ordem', 0, 10000),
    }
    if grouped:
        size = _int(pick('group_target_size'), 'Tamanho do grupo', 3, 4)
        qualifiers = _int(pick('qualifiers_per_group'), 'Classificados por grupo', 1, 2)
        if size is None or qualifiers is None:
            raise TournamentError('Grupos + mata-mata exige o tamanho do grupo (3 ou 4) e os classificados por grupo (1 ou 2).')
        values['group_target_size'], values['qualifiers_per_group'] = size, qualifiers
        if values['min_entries'] < 6:
            raise TournamentError('Grupos + mata-mata exige no mínimo 6 inscritos (dois grupos de 3).')
    if values['max_entries'] is not None and values['max_entries'] < values['min_entries']:
        raise TournamentError('O máximo de inscritos não pode ser menor que o mínimo.')
    if values['max_entries'] is not None and values['num_seeds'] > values['max_entries']:
        raise TournamentError('Cabeças de chave não pode ser maior que o máximo de inscritos.')
    return values


CATEGORY_UNIQUE = {
    'tournament_categories_tournament_id_name_key': ('category_name_taken', 'Já existe uma categoria com este nome neste torneio.'),
}


def create_category(db, tournament_id, data, actor_id):
    tournament = get_tournament(db, tournament_id, lock=True)
    if tournament['status'] in ('in_progress',) + TERMINAL_STATUSES:
        raise TournamentError('Não é possível criar categorias neste estágio do torneio.', 409, code='tournament_locked')
    values = _category_values(data)
    if values['sort_order'] is None:
        values['sort_order'] = db.execute(
            'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM tournament_categories WHERE tournament_id = %s',
            (tournament_id,)).fetchone()['next']
    row = _write(
        db,
        f"INSERT INTO tournament_categories (tournament_id, {', '.join(CATEGORY_FIELDS)}) "
        f"VALUES (%s, {', '.join(['%s'] * len(CATEGORY_FIELDS))}) RETURNING *",
        [tournament_id] + [values[field] for field in CATEGORY_FIELDS], CATEGORY_UNIQUE,
    )
    log_audit(db, tournament_id, 'category_created', {'name': row['name']}, row['id'], actor_id)
    return row


def update_category(db, tournament_id, category_id, data, actor_id):
    tournament = get_tournament(db, tournament_id, lock=True)
    if tournament['status'] in TERMINAL_STATUSES:
        raise TournamentError('Torneio finalizado ou cancelado não pode ser alterado.', 409, code='tournament_locked')
    current = get_category(db, tournament_id, category_id, lock=True)
    values = _category_values(data, current)

    changed = {key: value for key, value in values.items() if value != current[key]}
    locked = [key for key in changed if key in CATEGORY_DRAW_FIELDS]
    if locked and current['status'] != 'awaiting_draw':
        raise TournamentError('Desfaça o sorteio da categoria antes de mudar o formato da chave ou os cabeças de chave.', 409,
                              code='draw_exists')
    if 'max_entries' in changed and values['max_entries'] is not None:
        confirmed = category_counts(db, tournament_id).get(category_id, {}).get('confirmed', 0)
        if values['max_entries'] < confirmed:
            raise TournamentError(f'Já há {confirmed} inscrições confirmadas: o máximo não pode ser menor.', 409,
                                  code='below_confirmed')
    if 'num_seeds' in changed:
        top_seed = db.execute(
            "SELECT COALESCE(MAX(seed), 0) AS top FROM tournament_registrations "
            "WHERE category_id = %s AND status NOT IN ('rejected', 'cancelled', 'withdrawn')", (category_id,)
        ).fetchone()['top']
        if values['num_seeds'] < top_seed:
            raise TournamentError(f'O cabeça de chave {top_seed} já está atribuído: remova-o antes de reduzir.', 409,
                                  code='seed_assigned')
    if not changed:
        return current

    assignments = ', '.join(f'{key} = %s' for key in changed)
    row = _write(db, f'UPDATE tournament_categories SET {assignments} WHERE id = %s RETURNING *',
                 list(changed.values()) + [category_id], CATEGORY_UNIQUE)
    log_audit(db, tournament_id, 'category_updated', {'fields': sorted(changed)}, category_id, actor_id)
    return row


def delete_category(db, tournament_id, category_id, actor_id):
    category = get_category(db, tournament_id, category_id, lock=True)
    if category['status'] != 'awaiting_draw':
        raise TournamentError('Categoria com sorteio feito não pode ser excluída.', 409, code='draw_exists')
    if db.execute('SELECT 1 FROM tournament_registrations WHERE category_id = %s LIMIT 1', (category_id,)).fetchone():
        raise TournamentError('A categoria tem inscrições. Cancele ou mova as inscrições antes de excluir.', 409,
                              code='has_registrations')
    db.execute('DELETE FROM tournament_categories WHERE id = %s', (category_id,))
    log_audit(db, tournament_id, 'category_deleted', {'name': category['name']}, actor_id=actor_id)


# --- registrations -------------------------------------------------------------------

REGISTRATION_UNIQUE = {
    'idx_tournament_reg_unique_email': ('duplicate_email', 'Já existe uma inscrição ativa com este e-mail nesta categoria.'),
    'idx_tournament_reg_unique_user': ('duplicate_member', 'Este membro já possui inscrição ativa nesta categoria.'),
    'idx_tournament_reg_unique_seed': ('seed_taken', 'Este cabeça de chave já está atribuído a outro inscrito.'),
}


def _registration_fields(data, current=None):
    current = current or {}

    def pick(key):
        return data[key] if key in data else current.get(key)

    full_name = _text(pick('full_name'), 'Nome completo', 255, required=True, min_len=3)
    display_name = _text(pick('display_name'), 'Nome de exibição', 100) or ' '.join(full_name.split()[:2])
    email = _text(pick('email'), 'E-mail', 255, required=True)
    if not EMAIL_RE.match(email):
        raise TournamentError('E-mail inválido.')
    phone = _text(pick('phone'), 'Telefone', 30, required=True)
    digits = re.sub(r'\D', '', phone)
    if not 10 <= len(digits) <= 13:
        raise TournamentError('Telefone inválido: informe DDD e número.')
    return {
        'full_name': full_name, 'display_name': display_name, 'email': email.lower(), 'phone': digits,
        'notes': _text(pick('notes'), 'Observações', 500, multiline=True),
    }


def _resolve_member(db, user_id):
    """The user a registration may be linked to: an approved LAPEN member."""
    user = db.execute(
        'SELECT id, lapen_approved, is_lapen_member FROM users WHERE id = %s AND deleted_at IS NULL', (user_id,)
    ).fetchone()
    if not user:
        raise TournamentError('Usuário não encontrado.', 404)
    if not (user['is_lapen_member'] and user['lapen_approved']):
        raise TournamentError('Só é possível vincular membros LAPEN aprovados.', 400, code='not_approved_member')
    return user['id']


def _confirmed_count(db, category_id, exclude_registration_id=None):
    return db.execute(
        "SELECT COUNT(*) AS n FROM tournament_registrations WHERE category_id = %s AND status = 'confirmed' "
        "AND id <> COALESCE(%s, -1)", (category_id, exclude_registration_id)
    ).fetchone()['n']


def _ensure_capacity(db, category, exclude_registration_id=None):
    """Caller must hold the category row lock."""
    if category['max_entries'] is not None and _confirmed_count(db, category['id'], exclude_registration_id) >= category['max_entries']:
        raise TournamentError(f'Categoria lotada ({category["max_entries"]} vagas confirmadas).', 409, code='category_full')


def _get_registration(db, tournament_id, registration_id, lock=False):
    row = db.execute(
        'SELECT r.*, c.status AS category_status FROM tournament_registrations r '
        'JOIN tournament_categories c ON c.id = r.category_id '
        f"WHERE r.id = %s AND c.tournament_id = %s{' FOR UPDATE OF r' if lock else ''}",
        (registration_id, tournament_id)
    ).fetchone()
    if not row:
        raise TournamentError('Inscrição não encontrada.', 404)
    return row


def _check_registration_transition(current, target, category_status):
    if target not in REGISTRATION_STATUSES:
        raise TournamentError('Status de inscrição inválido.')
    if target not in REGISTRATION_TRANSITIONS[current]:
        raise TournamentError(f'Não é possível passar a inscrição de "{current}" para "{target}".', 409, code='invalid_transition')
    if target == 'withdrawn':
        if category_status not in DRAWN_CATEGORY_STATUSES:
            raise TournamentError('A desistência só vale depois da publicação da chave. Antes disso, cancele a inscrição.', 409,
                                  code='draw_not_published')
    elif category_status != 'awaiting_draw' and (current == 'confirmed' or target in ('confirmed', 'pending')):
        raise TournamentError('O sorteio desta categoria já foi feito: use desistência para quem está na chave.', 409,
                              code='draw_exists')


def create_registration_manual(db, tournament_id, data, actor_id):
    tournament = get_tournament(db, tournament_id)
    if tournament['status'] in TERMINAL_STATUSES + ('in_progress',):
        raise TournamentError('Não é possível inscrever neste estágio do torneio.', 409, code='tournament_locked')
    category = get_category(db, tournament_id, parse_id(data.get('category_id'), 'Categoria'), lock=True)
    if category['status'] != 'awaiting_draw':
        raise TournamentError('O sorteio desta categoria já foi feito.', 409, code='draw_exists')

    fields = _registration_fields(data)
    status = data.get('status', 'confirmed')
    if status not in ('pending', 'confirmed'):
        raise TournamentError('Status inicial deve ser "pending" ou "confirmed".')
    if status == 'confirmed':
        _ensure_capacity(db, category)
    user_id = _resolve_member(db, data['user_id']) if data.get('user_id') else None

    row = _write(
        db,
        'INSERT INTO tournament_registrations (category_id, user_id, full_name, display_name, email, phone, notes, status, '
        'terms_accepted_at, data_consent_at, reviewed_at) '
        'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '
        "CASE WHEN %s = 'confirmed' THEN CURRENT_TIMESTAMP END) RETURNING *",
        (category['id'], user_id, fields['full_name'], fields['display_name'], fields['email'], fields['phone'],
         fields['notes'], status, status), REGISTRATION_UNIQUE,
    )
    log_audit(db, tournament_id, 'registration_created_manual',
              {'registration_id': row['id'], 'status': status, 'linked': user_id is not None}, category['id'], actor_id)
    return row


def update_registration(db, tournament_id, registration_id, patch, actor_id):
    reg = _get_registration(db, tournament_id, registration_id)
    category = get_category(db, tournament_id, reg['category_id'], lock=True)  # serializes capacity checks
    reg = _get_registration(db, tournament_id, registration_id, lock=True)
    new = dict(reg)
    category_id = reg['category_id']

    # Move to another category of the same tournament
    target_id = _int(patch['category_id'], 'Categoria', 1, 2**31 - 1) if 'category_id' in patch else None
    if target_id is not None and target_id != reg['category_id']:
        target = get_category(db, tournament_id, target_id, lock=True)
        if reg['status'] not in ('pending', 'confirmed', 'waitlist'):
            raise TournamentError('Só inscrições ativas podem mudar de categoria.', 409, code='invalid_transition')
        if category['status'] != 'awaiting_draw' or target['status'] != 'awaiting_draw':
            raise TournamentError('Só é possível mover entre categorias que ainda não foram sorteadas.', 409, code='draw_exists')
        if reg['status'] == 'confirmed':
            _ensure_capacity(db, target)
        category, category_id = target, target['id']
        new['category_id'], new['seed'] = category_id, None

    # Contact fields
    if any(key in patch for key in REGISTRATION_CONTACT_FIELDS):
        new.update(_registration_fields(patch, reg))

    # Member link (None unlinks)
    if 'user_id' in patch:
        new['user_id'] = _resolve_member(db, patch['user_id']) if patch['user_id'] is not None else None

    # Review status
    if 'status' in patch and patch['status'] != reg['status']:
        target_status = patch['status']
        _check_registration_transition(reg['status'], target_status, category['status'])
        if target_status == 'confirmed':
            _ensure_capacity(db, category, exclude_registration_id=registration_id)
        new['status'] = target_status
        new['reviewed_at'] = 'now'
        new['rejection_reason'] = _text(patch.get('rejection_reason'), 'Motivo', 500) if target_status == 'rejected' else None
        if target_status in ('rejected', 'cancelled'):
            new['seed'] = None

    # Seed (cabeça de chave)
    if 'seed' in patch:
        seed = _int(patch['seed'], 'Cabeça de chave', 1, 16)
        if seed is not None:
            if new['status'] != 'confirmed':
                raise TournamentError('Só inscrições confirmadas podem ser cabeça de chave.', 409, code='not_confirmed')
            if category['status'] != 'awaiting_draw':
                raise TournamentError('O sorteio já foi feito: os cabeças de chave não podem mais mudar.', 409, code='draw_exists')
            if category['num_seeds'] == 0:
                raise TournamentError('Defina o número de cabeças de chave na categoria antes de atribuí-los.', 409, code='no_seeds_configured')
            if seed > category['num_seeds']:
                raise TournamentError(f'A categoria tem apenas {category["num_seeds"]} cabeças de chave.', 409, code='seed_out_of_range')
        elif category['status'] != 'awaiting_draw' and reg['seed'] is not None:
            raise TournamentError('O sorteio já foi feito: os cabeças de chave não podem mais mudar.', 409, code='draw_exists')
        new['seed'] = seed

    changes = {key: new[key] for key in new
               if key in ('category_id', 'user_id', 'status', 'seed', 'rejection_reason') + REGISTRATION_CONTACT_FIELDS
               and new[key] != reg[key]}
    if new.get('reviewed_at') == 'now':
        changes['reviewed_at'] = None  # placeholder, written as CURRENT_TIMESTAMP below
    if not changes:
        return reg

    assignments = ', '.join('reviewed_at = CURRENT_TIMESTAMP' if key == 'reviewed_at' else f'{key} = %s' for key in changes)
    params = [value for key, value in changes.items() if key != 'reviewed_at'] + [registration_id]
    row = _write(db, f'UPDATE tournament_registrations SET {assignments} WHERE id = %s RETURNING *', params, REGISTRATION_UNIQUE)
    log_audit(db, tournament_id, 'registration_updated',
              {'registration_id': registration_id, 'changes': {k: [reg[k], row[k]] for k in changes if k != 'reviewed_at' and k not in ('email', 'phone', 'full_name')},
               'fields': sorted(changes)},
              category_id, actor_id)
    return row


def batch_update_registrations(db, tournament_id, ids, status, reason, actor_id):
    if status not in ('confirmed', 'rejected', 'cancelled'):
        raise TournamentError('Ação em lote deve ser confirmar, recusar ou cancelar.')
    if not isinstance(ids, list) or not ids or len(ids) > MAX_BATCH_SIZE:
        raise TournamentError(f'Informe de 1 a {MAX_BATCH_SIZE} inscrições.')
    updated, failed = [], []
    for raw_id in ids:
        db.execute('SAVEPOINT batch_item')
        try:
            registration_id = parse_id(raw_id, 'Inscrição')
            update_registration(db, tournament_id, registration_id, {'status': status, 'rejection_reason': reason}, actor_id)
            db.execute('RELEASE SAVEPOINT batch_item')
            updated.append(registration_id)
        except TournamentError as exc:
            db.execute('ROLLBACK TO SAVEPOINT batch_item')
            failed.append({'id': raw_id, 'error': exc.message, 'code': exc.code})
    return {'updated': updated, 'failed': failed}


def list_registrations(db, tournament_id, category_id=None, status=None, query=None):
    get_tournament(db, tournament_id)
    if status and status not in REGISTRATION_STATUSES:
        raise TournamentError('Status de inscrição inválido.')
    conditions, params = ['c.tournament_id = %s'], [tournament_id]
    if category_id:
        conditions.append('r.category_id = %s')
        params.append(category_id)
    if status:
        conditions.append('r.status = %s')
        params.append(status)
    if query:
        like = '%' + query.strip().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        conditions.append('(unaccent(LOWER(r.full_name)) LIKE unaccent(LOWER(%s)) OR unaccent(LOWER(r.display_name)) LIKE unaccent(LOWER(%s)) '
                          'OR LOWER(r.email) LIKE LOWER(%s) OR r.phone LIKE %s)')
        params.extend([like] * 4)
    rows = db.execute(
        'SELECT r.* FROM tournament_registrations r JOIN tournament_categories c ON c.id = r.category_id '
        f"WHERE {' AND '.join(conditions)} ORDER BY r.created_at, r.id", params
    ).fetchall()
    counts = category_counts(db, tournament_id)
    also_in, unavailable = _same_person_and_impediments(db, tournament_id, [r['id'] for r in rows])
    return {
        'registrations': [dict(serialize_registration(r), also_in=also_in.get(r['id'], []), unavailability_count=unavailable.get(r['id'], 0)) for r in rows],
        'counts': {str(cid): bucket for cid, bucket in counts.items()},
    }


def _same_person_and_impediments(db, tournament_id, registration_ids):
    """For the admin list: the other live registrations of the same person (same member or e-mail) and the impedimentos marked."""
    live = db.execute(
        "SELECT r.id, r.category_id, r.user_id, r.email, c.name AS category_name FROM tournament_registrations r "
        "JOIN tournament_categories c ON c.id = r.category_id WHERE c.tournament_id = %s AND r.status NOT IN ('rejected', 'cancelled')",
        (tournament_id,)).fetchall()
    people = person_map(live)
    groups = {}
    for r in live:
        groups.setdefault(people[r['id']], []).append(r)
    also_in = {rid: [{'registration_id': o['id'], 'category_id': o['category_id'], 'category_name': o['category_name']}
                     for o in groups[people[rid]] if o['id'] != rid]
               for rid in registration_ids if rid in people}
    counts = {row['registration_id']: row['n'] for row in db.execute(
        'SELECT registration_id, COUNT(*) AS n FROM tournament_unavailability WHERE registration_id = ANY(%s) GROUP BY registration_id',
        (registration_ids,)).fetchall()}
    return also_in, counts


# --- public registration ----------------------------------------------------------------

def submit_registration(db, slug, data, user, ip_hash):
    """Public sign-up. Returns {'registration': row | None, 'waitlisted': bool}."""
    if data.get('website'):  # honeypot: pretend it worked, store nothing
        return {'registration': None, 'waitlisted': False}

    sync_registration_window(db)
    tournament = db.execute('SELECT * FROM tournaments WHERE slug = %s AND status <> %s', (slug, 'draft')).fetchone()
    if not tournament:
        raise TournamentError('Torneio não encontrado.', 404)
    if tournament['status'] != 'registration_open':
        raise TournamentError('As inscrições deste torneio estão encerradas.', 409, code='registration_closed')
    opens = tournament['registration_opens_at']
    if opens and local_now() < opens:  # the deadline needs no check: sync_registration_window already closed expired ones
        raise TournamentError(f'As inscrições abrem em {opens.strftime("%d/%m/%Y às %H:%M")}.', 409, code='registration_not_started')

    category = get_category(db, tournament['id'], parse_id(data.get('category_id'), 'Categoria'), lock=True)
    if category['status'] != 'awaiting_draw':
        raise TournamentError('As inscrições desta categoria estão encerradas.', 409, code='registration_closed')

    fields = _registration_fields(data)
    if data.get('accepted_terms') is not True:
        raise TournamentError('É preciso aceitar o regulamento para se inscrever.')
    if data.get('data_consent') is not True:
        raise TournamentError('É preciso autorizar o uso dos dados para se inscrever.')

    if ip_hash:
        recent = db.execute(
            "SELECT COUNT(*) AS n FROM tournament_registrations "
            "WHERE ip_hash = %s AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'", (ip_hash,)
        ).fetchone()['n']
        if recent >= REGISTRATION_RATE_LIMIT_PER_HOUR:
            raise TournamentError('Muitas inscrições deste dispositivo. Tente novamente mais tarde.', 429, code='rate_limited')

    full = category['max_entries'] is not None and _confirmed_count(db, category['id']) >= category['max_entries']
    status = 'waitlist' if full else 'pending'
    member_id = user['id'] if user and user.get('is_lapen_member') and user.get('lapen_approved') else None

    row = _write(
        db,
        'INSERT INTO tournament_registrations (category_id, user_id, full_name, display_name, email, phone, notes, status, '
        'terms_accepted_at, data_consent_at, ip_hash) '
        'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, %s) RETURNING *',
        (category['id'], member_id, fields['full_name'], fields['display_name'], fields['email'], fields['phone'],
         fields['notes'], status, ip_hash), REGISTRATION_UNIQUE,
    )
    return {'registration': row, 'waitlisted': full}
