"""Tournament schedule (database side): sessions, blocked windows, placing / moving / swapping matches, automatic
distribution, publication and the players' unavailability. The rules live in tournament_schedule.py (pure)."""
import re
from collections import defaultdict
from datetime import date, datetime, time

from src.services import tournament_draw as draw
from src.services import tournament_schedule as sched
from src.services.tournament_draw_service import new_seed
from src.services.tournament_service import (
    DRAWN_CATEGORY_STATUSES, TERMINAL_STATUSES, TournamentError, _db_error, _iso, _same_person_and_impediments, _text,
    get_tournament, log_audit,
    parse_id,
)

GROUP_LABEL = re.compile(r'^\d+º Grupo (\w+)$')
UNIQUE_VIOLATION = '23505'
STAGE_NAMES = {'group': 'Grupos', 'knockout': 'Mata-mata'}


# --- parsing ---------------------------------------------------------------------------------------------------------

def _parse_time(value, label):
    if isinstance(value, time):
        return value
    if isinstance(value, str):
        for fmt in ('%H:%M', '%H:%M:%S'):
            try:
                return datetime.strptime(value.strip(), fmt).time()
            except ValueError:
                pass
    raise TournamentError(f'{label} inválido (use HH:MM).')


def _parse_date(value, label):
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value.strip())
        except ValueError:
            pass
    raise TournamentError(f'{label} inválida (use AAAA-MM-DD).')


def _parse_window(data):
    if not isinstance(data, dict):
        raise TournamentError('Informe a janela (quadra, data e horário).')
    return (parse_id(data.get('court_id'), 'Quadra'), _parse_date(data.get('date'), 'Data'), _parse_time(data.get('time'), 'Horário'))


def _hhmm(value):
    return value.strftime('%H:%M') if value is not None else None


def _window_json(key):
    return None if key is None else {'court_id': key[0], 'date': key[1].isoformat(), 'time': _hhmm(key[2])}


# --- loading ---------------------------------------------------------------------------------------------------------

class State:
    """Everything the schedule needs about one tournament, read once."""

    def __init__(self, db, tournament):
        self.tournament = tournament
        tid = tournament['id']
        self.categories = db.execute(
            'SELECT id, name, draw_format, min_rest_min, status, sort_order FROM tournament_categories '
            'WHERE tournament_id = %s AND status = ANY(%s) ORDER BY sort_order, id', (tid, list(DRAWN_CATEGORY_STATUSES))).fetchall()
        self.category_by_id = {c['id']: c for c in self.categories}
        ids = list(self.category_by_id)
        self.registrations = db.execute(
            'SELECT id, category_id, user_id, email, display_name, status FROM tournament_registrations WHERE category_id = ANY(%s)', (ids,)).fetchall()
        self.reg_by_id = {r['id']: r for r in self.registrations}
        self.person_of = sched.person_map(self.registrations)
        rows = db.execute(
            'SELECT m.*, g.name AS group_name FROM tournament_matches m LEFT JOIN tournament_groups g ON g.id = m.group_id '
            'WHERE m.category_id = ANY(%s) ORDER BY m.category_id, m.stage, m.round_number, m.bracket_position', (ids,)).fetchall()
        self.rows = {r['id']: r for r in rows}
        self.sessions = self._sessions(db, tid)
        self.blocks = {(r['court_id'], r['play_date'], r['start_time']) for r in db.execute(
            'SELECT court_id, play_date, start_time FROM tournament_slot_blocks WHERE tournament_id = %s', (tid,)).fetchall()}
        self.courts = db.execute('SELECT id, name, COALESCE(active, TRUE) AS active FROM courts ORDER BY id').fetchall()
        self.court_name = {c['id']: c['name'] for c in self.courts}
        self.windows = sched.build_windows(self.sessions, self.blocks, [c['id'] for c in self.courts])
        self.valid = {w.key for w in self.windows if not w.blocked}
        self.unavailability = db.execute(
            'SELECT u.* FROM tournament_unavailability u JOIN tournament_registrations r ON r.id = u.registration_id '
            'WHERE r.category_id = ANY(%s) ORDER BY u.play_date, u.start_time NULLS FIRST, u.id', (ids,)).fetchall()
        self.unavailable = sched.unavailable_intervals(self.unavailability, self.person_of)
        self.total_rounds = defaultdict(int)
        for r in rows:
            if r['stage'] == 'knockout':
                self.total_rounds[r['category_id']] = max(self.total_rounds[r['category_id']], r['round_number'])
        self.matches = [self._match(r) for r in rows]
        self.by_id = {m['id']: m for m in self.matches}

    @staticmethod
    def _sessions(db, tid):
        sessions = db.execute('SELECT * FROM tournament_sessions WHERE tournament_id = %s ORDER BY play_date, start_time, id', (tid,)).fetchall()
        courts = defaultdict(list)
        for r in db.execute('SELECT session_id, court_id FROM tournament_session_courts WHERE session_id = ANY(%s) ORDER BY court_id',
                            ([s['id'] for s in sessions],)).fetchall():
            courts[r['session_id']].append(r['court_id'])
        return [{'id': s['id'], 'date': s['play_date'], 'start': s['start_time'], 'end': s['end_time'], 'court_ids': courts[s['id']]} for s in sessions]

    def _match(self, row):
        window = (row['court_id'], row['planned_date'], row['planned_time']) if row['court_id'] and row['planned_date'] else None
        return {'id': row['id'], 'category_id': row['category_id'], 'status': row['status'], 'stage': row['stage'],
                'entries': (row['entry1_id'], row['entry2_id']), 'window': window, 'preds': self._preds(row),
                'rest': self.category_by_id[row['category_id']]['min_rest_min'], 'round_number': row['round_number'],
                'locked': row['locked']}

    def _preds(self, row):
        """The matches that must finish before this one: the feeders of a knockout match and, for a first-round
        match taking a group's qualifier, every match of that group."""
        preds = [r['id'] for r in self.rows.values() if r['next_match_id'] == row['id']]
        if row['stage'] == 'knockout':
            for slot in (1, 2):
                label = GROUP_LABEL.match(row[f'entry{slot}_source'] or '')
                if label:
                    preds += [r['id'] for r in self.rows.values()
                              if r['stage'] == 'group' and r['category_id'] == row['category_id'] and r['group_name'] == label.group(1)]
        return sorted(set(preds))

    # naming
    def person_name(self, person):
        reg = self.reg_by_id.get(person)
        return reg['display_name'] if reg else f'#{person}'

    def side_name(self, row, slot):
        reg = self.reg_by_id.get(row[f'entry{slot}_id'])
        return reg['display_name'] if reg else (row[f'entry{slot}_source'] or 'a definir')

    def round_name(self, row):
        if row['stage'] == 'group':
            return f"Grupo {row['group_name']} · Rodada {row['round_number']}"
        name = draw.round_name(row['round_number'], self.total_rounds[row['category_id']])
        same = sum(1 for r in self.rows.values() if r['category_id'] == row['category_id'] and r['stage'] == 'knockout' and r['round_number'] == row['round_number'])
        return name if same == 1 else f"{name} {row['bracket_position']}"

    def label(self, mid):
        row = self.rows[mid]
        return f"{self.category_by_id[row['category_id']]['name']} · {self.round_name(row)} ({self.side_name(row, 1)} × {self.side_name(row, 2)})"

    def conflicts(self, matches=None):
        return sched.find_conflicts(self.matches if matches is None else matches, self.person_of, self.unavailable, self.valid)

    def schedulable(self, match):
        return match['status'] == 'pending'

    def with_windows(self, changes):
        """The matches as they would be after `changes` ({match id: window or None})."""
        return [dict(m, window=changes[m['id']]) if m['id'] in changes else m for m in self.matches]


def _load(db, tournament_id, lock=False):
    tournament = get_tournament(db, tournament_id, lock=lock)
    if lock and tournament['status'] in TERMINAL_STATUSES:
        raise TournamentError('Torneio finalizado ou cancelado não pode ser alterado.', 409, code='tournament_locked')
    return State(db, tournament)


# --- conflict messages -----------------------------------------------------------------------------------------------

def describe(state, conflict):
    ids, people = conflict['match_ids'], conflict['people']
    name = state.person_name(people[0]) if people else None
    kind = conflict['kind']
    if kind == 'overlap':
        text = f'{name} está em duas partidas ao mesmo tempo: {state.label(ids[0])} e {state.label(ids[1])}.'
    elif kind == 'order':
        before = conflict['detail']['before']
        after = ids[0] if ids[1] == before else ids[1]
        text = f'{state.label(after)} começa antes do fim de {state.label(before)}.'
    elif kind == 'rest':
        detail = conflict['detail']
        if name:
            text = f'{name} teria {max(detail["gap"], 0)} min de descanso entre {state.label(ids[0])} e {state.label(ids[1])} (mínimo {detail["needed"]}).'
        else:
            after = ids[0] if ids[1] == detail['before'] else ids[1]
            text = f'O vencedor de {state.label(detail["before"])} teria {max(detail["gap"], 0)} min de descanso antes de {state.label(after)} (mínimo {detail["needed"]}).'
    elif kind == 'unavailable':
        text = f'{name} marcou impedimento no horário de {state.label(ids[0])}.'
    else:
        text = f'{state.label(ids[0])} está numa janela que não existe ou está bloqueada.'
    return dict(conflict, message=text, people_names=[state.person_name(p) for p in people])


def _refuse(state, added, force):
    """Raise for the conflicts an edit would add: errors always stop it, warnings stop it unless forced."""
    errors = [c for c in added if c['severity'] == sched.ERROR]
    if errors:
        raise TournamentError('Essa troca criaria um conflito.', 409, code='schedule_conflict', conflicts=[describe(state, c) for c in errors])
    warnings = [c for c in added if c['severity'] == sched.WARNING]
    if warnings and not force:
        raise TournamentError('Essa alteração cria avisos. Confirme para aplicar mesmo assim.', 409, code='needs_confirmation',
                              conflicts=[describe(state, c) for c in warnings])


# --- reading ---------------------------------------------------------------------------------------------------------

def get_schedule(db, tournament_id):
    state = _load(db, tournament_id)
    return schedule_payload(state)


def schedule_payload(state):
    t = state.tournament
    placed = sum(1 for m in state.matches if m['status'] == 'pending' and m['window'])
    pending = sum(1 for m in state.matches if m['status'] == 'pending')
    taken = {m['window'] for m in state.matches if m['window']}
    matches = []
    for m in state.matches:
        row = state.rows[m['id']]
        category = state.category_by_id[m['category_id']]
        matches.append({
            'id': m['id'], 'category_id': m['category_id'], 'category_name': category['name'], 'stage': m['stage'],
            'round_number': m['round_number'], 'round_name': state.round_name(row), 'group': row['group_name'],
            'status': m['status'], 'outcome': row['outcome'], 'score': row['score'], 'locked': m['locked'],
            'window': _window_json(m['window']),
            'sides': [{'registration_id': row[f'entry{slot}_id'], 'name': state.side_name(row, slot),
                       'defined': row[f'entry{slot}_id'] is not None} for slot in (1, 2)],
            'people': sorted(sched.people_of(m, state.person_of)),
        })
    return {
        'tournament': {'id': t['id'], 'start_date': _iso(t['start_date']), 'end_date': _iso(t['end_date']), 'status': t['status'],
                       'schedule_published_at': _iso(t['schedule_published_at'])},
        'slot_minutes': sched.SLOT_MINUTES,
        'courts': [{'id': c['id'], 'name': c['name']} for c in state.courts if c['active']],
        'sessions': [{'id': s['id'], 'date': s['date'].isoformat(), 'start': _hhmm(s['start']), 'end': _hhmm(s['end']),
                      'court_ids': s['court_ids'], 'leftover_minutes': sched.session_leftover_minutes(s),
                      'windows': sum(1 for w in state.windows if w.session_id == s['id'])} for s in state.sessions],
        'windows': [{'court_id': w.court_id, 'date': w.date.isoformat(), 'time': _hhmm(w.time), 'session_id': w.session_id, 'blocked': w.blocked}
                    for w in state.windows],
        'matches': matches,
        'conflicts': [describe(state, c) for c in state.conflicts()],
        'summary': {'pending': pending, 'placed': placed, 'unplaced': pending - placed, 'windows': len(state.valid),
                    'free_windows': sum(1 for w in state.valid if w not in taken)},
    }


# --- sessions and blocked windows ------------------------------------------------------------------------------------

def _session_values(state, data, own_id=None):
    t = state.tournament
    play_date = _parse_date(data.get('date'), 'Data')
    if not t['start_date'] <= play_date <= t['end_date']:
        raise TournamentError('A data da sessão deve estar dentro do período do torneio.', 400, code='date_out_of_range')
    start, end = _parse_time(data.get('start'), 'Hora inicial'), _parse_time(data.get('end'), 'Hora final')
    if end <= start:
        raise TournamentError('A hora final deve ser depois da inicial.')
    session = {'id': own_id, 'date': play_date, 'start': start, 'end': end, 'court_ids': []}
    if sched.SLOT_MINUTES > (datetime.combine(play_date, end) - datetime.combine(play_date, start)).total_seconds() / 60:
        raise TournamentError(f'A sessão precisa ter ao menos uma janela de {sched.SLOT_MINUTES} minutos.')
    courts = data.get('court_ids')
    if not isinstance(courts, list) or not courts:
        raise TournamentError('Escolha ao menos uma quadra.')
    session['court_ids'] = sorted({parse_id(c, 'Quadra') for c in courts})
    known = {c['id'] for c in state.courts if c['active']}
    unknown = [c for c in session['court_ids'] if c not in known]
    if unknown:
        raise TournamentError('Quadra inexistente ou inativa.', 400, code='unknown_court')
    for other in state.sessions:
        if other['id'] != own_id and other['date'] == play_date and start < other['end'] and other['start'] < end \
                and set(other['court_ids']) & set(session['court_ids']):
            raise TournamentError('Já existe uma sessão nas mesmas quadras neste horário.', 409, code='session_overlap')
    return session


def _check_windows_kept(state, session_id, new_session):
    """A session may only lose windows that hold no match."""
    old = {w.key for w in state.windows if w.session_id == session_id}
    new = {w.key for w in sched.build_windows([new_session])} if new_session else set()
    lost = old - new
    used = [m for m in state.matches if m['window'] in lost]
    if used:
        raise TournamentError('Há partidas nas janelas que deixariam de existir: mova ou remova essas partidas antes.', 409,
                              code='window_in_use', matches=[{'id': m['id'], 'label': state.label(m['id'])} for m in used])
    return lost


def create_session(db, tournament_id, data, actor_id):
    state = _load(db, tournament_id, lock=True)
    session = _session_values(state, data)
    row = db.execute('INSERT INTO tournament_sessions (tournament_id, play_date, start_time, end_time) VALUES (%s, %s, %s, %s) RETURNING id',
                     (tournament_id, session['date'], session['start'], session['end'])).fetchone()
    for court in session['court_ids']:
        db.execute('INSERT INTO tournament_session_courts (session_id, court_id) VALUES (%s, %s)', (row['id'], court))
    log_audit(db, tournament_id, 'schedule_session_created', {'session_id': row['id'], 'date': session['date'], 'courts': session['court_ids']}, actor_id=actor_id)
    return get_schedule(db, tournament_id)


def update_session(db, tournament_id, session_id, data, actor_id):
    state = _load(db, tournament_id, lock=True)
    if session_id not in {s['id'] for s in state.sessions}:
        raise TournamentError('Sessão não encontrada.', 404)
    session = _session_values(state, data, own_id=session_id)
    lost = _check_windows_kept(state, session_id, session)
    db.execute('UPDATE tournament_sessions SET play_date = %s, start_time = %s, end_time = %s WHERE id = %s',
               (session['date'], session['start'], session['end'], session_id))
    db.execute('DELETE FROM tournament_session_courts WHERE session_id = %s', (session_id,))
    for court in session['court_ids']:
        db.execute('INSERT INTO tournament_session_courts (session_id, court_id) VALUES (%s, %s)', (session_id, court))
    _drop_blocks(db, tournament_id, lost)
    log_audit(db, tournament_id, 'schedule_session_updated', {'session_id': session_id}, actor_id=actor_id)
    return get_schedule(db, tournament_id)


def delete_session(db, tournament_id, session_id, actor_id):
    state = _load(db, tournament_id, lock=True)
    if session_id not in {s['id'] for s in state.sessions}:
        raise TournamentError('Sessão não encontrada.', 404)
    lost = _check_windows_kept(state, session_id, None)
    db.execute('DELETE FROM tournament_sessions WHERE id = %s', (session_id,))
    _drop_blocks(db, tournament_id, lost)
    log_audit(db, tournament_id, 'schedule_session_deleted', {'session_id': session_id}, actor_id=actor_id)
    return get_schedule(db, tournament_id)


def _drop_blocks(db, tournament_id, keys):
    for court, day, start in keys:
        db.execute('DELETE FROM tournament_slot_blocks WHERE tournament_id = %s AND court_id = %s AND play_date = %s AND start_time = %s',
                   (tournament_id, court, day, start))


def set_block(db, tournament_id, data, actor_id):
    """Block or unblock one window. Blocking an occupied window needs `unplace: true` and sends its match back to the list."""
    state = _load(db, tournament_id, lock=True)
    key = _parse_window(data)
    if key not in {w.key for w in state.windows}:
        raise TournamentError('Essa janela não existe nas sessões.', 404, code='unknown_window')
    if data.get('blocked') is False:
        _drop_blocks(db, tournament_id, [key])
    elif data.get('blocked') is True:
        holder = next((m for m in state.matches if m['window'] == key), None)
        if holder:
            if holder['status'] != 'pending' or holder['locked']:
                raise TournamentError('A partida desta janela já foi disputada ou está fixada.', 409, code='window_in_use')
            if data.get('unplace') is not True:
                raise TournamentError('Há uma partida nesta janela. Confirme para tirá-la do horário e bloquear.', 409, code='window_occupied',
                                      matches=[{'id': holder['id'], 'label': state.label(holder['id'])}])
            _clear(db, [holder['id']])
        db.execute('INSERT INTO tournament_slot_blocks (tournament_id, court_id, play_date, start_time) VALUES (%s, %s, %s, %s) '
                   'ON CONFLICT DO NOTHING', (tournament_id, *key))
    else:
        raise TournamentError('Informe blocked: true ou false.')
    log_audit(db, tournament_id, 'schedule_block' if data['blocked'] else 'schedule_unblock', {'window': _window_json(key)}, actor_id=actor_id)
    return get_schedule(db, tournament_id)


# --- placing matches -------------------------------------------------------------------------------------------------

def _clear(db, match_ids):
    if match_ids:
        db.execute('UPDATE tournament_matches SET court_id = NULL, planned_date = NULL, planned_time = NULL WHERE id = ANY(%s)', (list(match_ids),))


def _set(db, match_id, key):
    try:
        db.execute('UPDATE tournament_matches SET court_id = %s, planned_date = %s, planned_time = %s WHERE id = %s', (*key, match_id))
    except Exception as exc:
        state, constraint = _db_error(exc)
        if state == UNIQUE_VIOLATION and constraint == 'idx_tournament_matches_slot':
            raise TournamentError('Esta janela acabou de ser ocupada por outra partida.', 409, code='window_taken') from exc
        raise


def _movable(state, match_id):
    match = state.by_id.get(match_id)
    if match is None:
        raise TournamentError('Partida não encontrada neste torneio.', 404)
    if match['status'] != 'pending':
        raise TournamentError('Esta partida já foi disputada e não muda de horário.', 409, code='match_completed')
    if match['locked']:
        raise TournamentError('Esta partida está fixada. Libere-a para mudar o horário.', 409, code='match_locked')
    return match


def place_match(db, tournament_id, match_id, window, actor_id, force=False):
    """Put a match in a free window (from the list, or moved from another window)."""
    state = _load(db, tournament_id, lock=True)
    match = _movable(state, match_id)
    key = _parse_window(window)
    if key not in state.valid:
        raise TournamentError('Essa janela não existe ou está bloqueada.', 400, code='invalid_window')
    holder = next((m for m in state.matches if m['window'] == key and m['id'] != match_id), None)
    if holder:
        raise TournamentError('Essa janela já tem uma partida. Use trocar para trocar as duas de lugar.', 409, code='window_taken')
    if match['window'] == key:
        return get_schedule(db, tournament_id)
    before = state.conflicts()
    after = state.conflicts(state.with_windows({match_id: key}))
    _refuse(state, sched.new_conflicts(before, after), force)
    _clear(db, [match_id])
    _set(db, match_id, key)
    log_audit(db, tournament_id, 'schedule_placed', {'match_id': match_id, 'from': _window_json(match['window']), 'to': _window_json(key)}, actor_id=actor_id)
    return get_schedule(db, tournament_id)


def swap_matches(db, tournament_id, match_id, other_id, actor_id, force=False):
    """Exchange the windows of two matches. If one has none, the other loses its window and that one takes it."""
    state = _load(db, tournament_id, lock=True)
    if match_id == other_id:
        raise TournamentError('Escolha duas partidas diferentes.')
    first, second = _movable(state, match_id), _movable(state, other_id)
    if first['window'] is None and second['window'] is None:
        raise TournamentError('Nenhuma das duas partidas tem horário para trocar.')
    before = state.conflicts()
    after = state.conflicts(state.with_windows({match_id: second['window'], other_id: first['window']}))
    _refuse(state, sched.new_conflicts(before, after), force)
    _clear(db, [match_id, other_id])
    if second['window']:
        _set(db, match_id, second['window'])
    if first['window']:
        _set(db, other_id, first['window'])
    log_audit(db, tournament_id, 'schedule_swapped', {'match_id': match_id, 'other_id': other_id,
                                                        'first': _window_json(first['window']), 'second': _window_json(second['window'])}, actor_id=actor_id)
    return get_schedule(db, tournament_id)


def unplace_match(db, tournament_id, match_id, actor_id):
    state = _load(db, tournament_id, lock=True)
    match = _movable(state, match_id)
    if match['window'] is None:
        return get_schedule(db, tournament_id)
    _clear(db, [match_id])
    log_audit(db, tournament_id, 'schedule_removed', {'match_id': match_id, 'from': _window_json(match['window'])}, actor_id=actor_id)
    return get_schedule(db, tournament_id)


def set_lock(db, tournament_id, match_id, locked, actor_id):
    """Pin a placed match so the automatic distribution (and manual moves) leave it alone."""
    state = _load(db, tournament_id, lock=True)
    match = state.by_id.get(match_id)
    if match is None:
        raise TournamentError('Partida não encontrada neste torneio.', 404)
    if not isinstance(locked, bool):
        raise TournamentError('Informe locked: true ou false.')
    if match['status'] != 'pending':
        raise TournamentError('Esta partida já foi disputada.', 409, code='match_completed')
    if locked and match['window'] is None:
        raise TournamentError('Só dá para fixar uma partida que já tem horário.', 409, code='not_planned')
    db.execute('UPDATE tournament_matches SET locked = %s WHERE id = %s', (locked, match_id))
    log_audit(db, tournament_id, 'schedule_locked' if locked else 'schedule_unlocked', {'match_id': match_id}, actor_id=actor_id)
    return get_schedule(db, tournament_id)


# --- publication -----------------------------------------------------------------------------------------------------

def set_published(db, tournament_id, published, actor_id):
    state = _load(db, tournament_id, lock=True)
    if published and not any(m['window'] for m in state.matches):
        raise TournamentError('Não há partidas com horário para publicar.', 409, code='nothing_to_publish')
    db.execute('UPDATE tournaments SET schedule_published_at = ' + ('CURRENT_TIMESTAMP' if published else 'NULL') + ' WHERE id = %s', (tournament_id,))
    log_audit(db, tournament_id, 'schedule_published' if published else 'schedule_unpublished', actor_id=actor_id)
    return get_schedule(db, tournament_id)


# --- automatic distribution ------------------------------------------------------------------------------------------

def _reason_text(state, reason):
    kind, detail = reason['kind'], reason['detail']
    if kind == 'no_window':
        return 'Não há janela livre nas sessões escolhidas (depois do que esta partida exige).'
    if kind == 'pred_unplaced':
        return f'Depende de {state.label(detail)}, que não coube.'
    if kind == 'pred':
        return f'Não cabe depois de {state.label(detail)} com o descanso necessário.'
    if kind == 'succ':
        return f'Não cabe antes de {state.label(detail)}.'
    if kind == 'person':
        return f'{state.person_name(detail)} já joga (ou ficaria sem o descanso mínimo) nas janelas que sobraram.'
    if kind == 'unavailable':
        return f'{state.person_name(detail)} marcou impedimento nas janelas que sobraram.'
    if kind == 'earliest':
        return 'As janelas livres são anteriores ao horário de partida escolhido.'
    return kind


def _options(state, options):
    if not isinstance(options, dict):
        raise TournamentError('Corpo da requisição inválido.')
    categories = options.get('category_ids')
    if categories is not None:
        if not isinstance(categories, list):
            raise TournamentError('category_ids deve ser uma lista.')
        categories = {parse_id(c, 'Categoria') for c in categories}
        if not categories <= set(state.category_by_id):
            raise TournamentError('Categoria inexistente ou sem sorteio publicado.', 404)
    stage = options.get('stage')
    if stage not in (None, 'group', 'knockout'):
        raise TournamentError('Fase inválida: use group ou knockout.')
    round_number = options.get('round_number')
    if round_number is not None:
        round_number = parse_id(round_number, 'Rodada')
        if stage != 'knockout':
            raise TournamentError('A rodada só vale para o mata-mata.')
    sessions = options.get('session_ids')
    if sessions is not None:
        if not isinstance(sessions, list):
            raise TournamentError('session_ids deve ser uma lista.')
        sessions = {parse_id(s, 'Sessão') for s in sessions}
        if not sessions <= {s['id'] for s in state.sessions}:
            raise TournamentError('Sessão inexistente.', 404)
    earliest = options.get('from')
    if earliest not in (None, ''):
        try:
            earliest = datetime.fromisoformat(earliest)
        except (TypeError, ValueError):
            raise TournamentError('Data e hora de partida inválidas (use AAAA-MM-DDTHH:MM).')
        if earliest.tzinfo is not None:
            raise TournamentError('A data e hora devem ser em horário local, sem fuso.')
    else:
        earliest = None
    seed = options.get('rng_seed')
    if seed is not None and (not isinstance(seed, int) or isinstance(seed, bool) or seed < 0):
        raise TournamentError('rng_seed inválido.')
    return {'categories': categories, 'stage': stage, 'round_number': round_number, 'sessions': sessions, 'earliest': earliest,
            'redo': options.get('redo') is True, 'seed': new_seed() if seed is None else seed}


def distribute_preview(db, tournament_id, options):
    """A proposal for where to put the matches in scope. Writes nothing."""
    state = _load(db, tournament_id)
    opts = _options(state, options)
    targets = [m['id'] for m in state.matches
               if m['status'] == 'pending' and not m['locked']
               and (opts['categories'] is None or m['category_id'] in opts['categories'])
               and (opts['stage'] is None or m['stage'] == opts['stage'])
               and (opts['round_number'] is None or m['round_number'] == opts['round_number'])
               and (m['window'] is None or opts['redo'])]
    windows = [w for w in state.windows if not w.blocked and (opts['sessions'] is None or w.session_id in opts['sessions'])]
    result = sched.distribute(state.matches, windows, state.person_of, state.unavailable, targets, earliest=opts['earliest'], rng_seed=opts['seed'])
    assignments = result['assignments']
    changes = {mid: assignments.get(mid) for mid in targets}
    added = sched.new_conflicts(state.conflicts(), state.conflicts(state.with_windows(changes)))
    load = defaultdict(int)
    for mid in targets:
        for person in sched.people_of(state.by_id[mid], state.person_of):
            load[person] += 1
    busiest = max(load.items(), key=lambda item: (item[1], -item[0]), default=None)
    feasibility = sched.feasibility(state.matches, windows, targets, opts['earliest'])
    if feasibility['shortfall']:
        feasibility['hint'] = f"Faltam {feasibility['shortfall']} janelas: acrescente uma sessão ou mais quadras."
    if busiest:
        feasibility['busiest'] = {'name': state.person_name(busiest[0]), 'matches': busiest[1]}
    return {
        'rng_seed': opts['seed'],
        'assignments': [dict(_window_json(key), match_id=mid, previous=_window_json(state.by_id[mid]['window']), label=state.label(mid))
                        for mid, key in assignments.items()],
        'unassign': [mid for mid in targets if state.by_id[mid]['window'] and mid not in assignments],
        'unplaced': [{'match_id': mid, 'label': state.label(mid), 'reasons': [_reason_text(state, r) for r in reasons]}
                     for mid, reasons in result['unplaced'].items()],
        'metrics': result['metrics'], 'feasibility': feasibility,
        'conflicts': [describe(state, c) for c in added],
    }


def apply_assignments(db, tournament_id, data, actor_id):
    """Write a proposal. Every window is checked again, because the schedule may have changed since it was made."""
    state = _load(db, tournament_id, lock=True)
    if not isinstance(data, dict) or not isinstance(data.get('assignments'), list):
        raise TournamentError('Informe as partidas e janelas da proposta.')
    unassign = data.get('unassign') or []
    if not isinstance(unassign, list):
        raise TournamentError('unassign deve ser uma lista.')
    changes = {}
    for item in data['assignments']:
        mid = parse_id(item.get('match_id') if isinstance(item, dict) else None, 'Partida')
        if mid in changes:
            raise TournamentError('A proposta repete uma partida.')
        _movable(state, mid)
        key = _parse_window(item)
        if key not in state.valid:
            raise TournamentError('A proposta usa uma janela que não existe mais ou foi bloqueada.', 409, code='stale_proposal')
        changes[mid] = key
    for raw in unassign:
        mid = parse_id(raw, 'Partida')
        _movable(state, mid)
        if mid in changes:
            raise TournamentError('A proposta repete uma partida.')
        changes[mid] = None
    if len({k for k in changes.values() if k}) != sum(1 for k in changes.values() if k):
        raise TournamentError('A proposta usa a mesma janela duas vezes.', 409, code='stale_proposal')
    for m in state.matches:
        if m['window'] and m['id'] not in changes and m['window'] in changes.values():
            raise TournamentError('A proposta ficou desatualizada: uma janela foi ocupada por outra partida. Gere de novo.', 409, code='stale_proposal')
    added = sched.new_conflicts(state.conflicts(), state.conflicts(state.with_windows(changes)))
    if added:
        raise TournamentError('A proposta ficou desatualizada e criaria conflitos. Gere de novo.', 409, code='stale_proposal',
                              conflicts=[describe(state, c) for c in added])
    _clear(db, list(changes))
    for mid, key in changes.items():
        if key:
            _set(db, mid, key)
    log_audit(db, tournament_id, 'schedule_applied', {'placed': sum(1 for k in changes.values() if k), 'removed': sum(1 for k in changes.values() if not k)},
              actor_id=actor_id)
    return get_schedule(db, tournament_id)


# --- unavailability of the players -------------------------------------------------------------------------------------

MAX_IMPEDIMENTS = 60


def _registration(db, tournament_id, registration_id):
    row = db.execute(
        'SELECT r.id, r.display_name, r.category_id, c.name AS category_name FROM tournament_registrations r '
        'JOIN tournament_categories c ON c.id = r.category_id WHERE r.id = %s AND c.tournament_id = %s', (registration_id, tournament_id)).fetchone()
    if not row:
        raise TournamentError('Inscrição não encontrada neste torneio.', 404)
    return row


def _impediment_json(row):
    return {'id': row['id'], 'date': row['play_date'].isoformat(), 'start': _hhmm(row['start_time']), 'end': _hhmm(row['end_time']),
            'whole_day': row['start_time'] is None, 'note': row['note']}


def _impediments_payload(db, tournament_id, registration):
    items = db.execute('SELECT * FROM tournament_unavailability WHERE registration_id = %s ORDER BY play_date, start_time NULLS FIRST, id',
                       (registration['id'],)).fetchall()
    also_in, _ = _same_person_and_impediments(db, tournament_id, [registration['id']])
    return {'registration': {'id': registration['id'], 'display_name': registration['display_name'], 'category_name': registration['category_name']},
            'items': [_impediment_json(r) for r in items], 'also_in': also_in.get(registration['id'], [])}


def get_unavailability(db, tournament_id, registration_id):
    get_tournament(db, tournament_id)
    return _impediments_payload(db, tournament_id, _registration(db, tournament_id, registration_id))


def _impediment_values(tournament, items):
    if not isinstance(items, list):
        raise TournamentError('Informe a lista de impedimentos.')
    if len(items) > MAX_IMPEDIMENTS:
        raise TournamentError(f'No máximo {MAX_IMPEDIMENTS} impedimentos por inscrição.')
    found = []
    for item in items:
        if not isinstance(item, dict):
            raise TournamentError('Impedimento inválido.')
        day = _parse_date(item.get('date'), 'Data do impedimento')
        if not tournament['start_date'] <= day <= tournament['end_date']:
            raise TournamentError('A data do impedimento deve estar dentro do período do torneio.', 400, code='date_out_of_range')
        start, end = item.get('start'), item.get('end')
        if start in (None, '') and end in (None, ''):
            start = end = None
        elif start in (None, '') or end in (None, ''):
            raise TournamentError('Informe o início e o fim, ou deixe os dois vazios para o dia todo.')
        else:
            start, end = _parse_time(start, 'Hora inicial'), _parse_time(end, 'Hora final')
            if end <= start:
                raise TournamentError('A hora final do impedimento deve ser depois da inicial.')
        row = (day, start, end, _text(item.get('note'), 'Observação', 200))
        if row not in found:
            found.append(row)
    return found


def set_unavailability(db, tournament_id, registration_id, items, actor_id):
    """Replace the impedimentos of a registration. They count for every registration of the same person."""
    tournament = get_tournament(db, tournament_id, lock=True)
    if tournament['status'] in TERMINAL_STATUSES:
        raise TournamentError('Torneio finalizado ou cancelado não pode ser alterado.', 409, code='tournament_locked')
    registration = _registration(db, tournament_id, registration_id)
    values = _impediment_values(tournament, items)
    db.execute('DELETE FROM tournament_unavailability WHERE registration_id = %s', (registration_id,))
    for day, start, end, note in values:
        db.execute('INSERT INTO tournament_unavailability (registration_id, play_date, start_time, end_time, note) VALUES (%s, %s, %s, %s, %s)',
                   (registration_id, day, start, end, note))
    log_audit(db, tournament_id, 'unavailability_set', {'registration_id': registration_id, 'count': len(values)}, registration['category_id'], actor_id)
    return _impediments_payload(db, tournament_id, registration)
