"""Match schedule of a tournament: windows, people, conflicts and automatic distribution. Pure: no database, no Flask.

Vocabulary
  window     a court on a day at a start time, SLOT_MINUTES long. Identified by the key (court_id, date, time).
  session    a stretch of one day when some courts belong to the tournament, cut into windows from its start time.
  match      a dict: id, status ('pending' / 'completed'), window (key or None), entries (two registration ids or
             None), preds (ids of the matches that must finish before it), rest (minutes of rest the category asks
             for), stage, round_number, locked.
  person     registrations of one human being (same linked member or same e-mail) share a person id, so a player
             entered in two categories is never in two places at once.

Only pending matches take part in conflicts between people: a result already recorded no longer binds anybody.
Completed matches still occupy their window.

find_conflicts is the single definition of what is wrong with a schedule. distribute builds a schedule that has none
of the conflicts that distribute treats as hard (everything but the soft goals), and the tests use find_conflicts as
the judge of it.
"""
import bisect
import random
from collections import Counter, defaultdict, namedtuple
from datetime import datetime, time, timedelta
from functools import lru_cache

SLOT_MINUTES = 90
SLOT = timedelta(minutes=SLOT_MINUTES)
DEFAULT_REST_MINUTES = 60
MAX_PER_DAY = 2  # soft goal: matches of one person on one day

# Weights of the soft goals the local search minimizes (per start-time step, per idle minute, per match over the cap)
WEIGHT_TIME = 1.0
WEIGHT_IDLE = 0.1
WEIGHT_DAY = 100.0
SEARCH_ITERATIONS = 3000
SEARCH_PATIENCE = 800

ERROR, WARNING = 'error', 'warning'


class Window(namedtuple('Window', 'court_id date time session_id blocked')):
    __slots__ = ()

    @property
    def key(self):
        return (self.court_id, self.date, self.time)


@lru_cache(maxsize=None)
def window_start(key):
    return datetime.combine(key[1], key[2])


def window_end(key):
    return window_start(key) + SLOT


def build_windows(sessions, blocks=(), court_order=None):
    """Windows of the sessions, earliest first (courts in `court_order` within the same time).

    sessions: dicts with id, date, start, end, court_ids. blocks: window keys nobody can use (kept, flagged blocked).
    Only whole windows fit: what is left of a session after the last one is dropped.
    """
    blocks = set(blocks)
    rank = {court: index for index, court in enumerate(court_order or [])}
    seen, found = set(), []
    for session in sessions:
        moment = datetime.combine(session['date'], session['start'])
        end = datetime.combine(session['date'], session['end'])
        while moment + SLOT <= end:
            for court in session['court_ids']:
                key = (court, session['date'], moment.time())
                if key not in seen:
                    seen.add(key)
                    found.append(Window(court, session['date'], moment.time(), session['id'], key in blocks))
            moment += SLOT
    found.sort(key=lambda w: (window_start(w.key), rank.get(w.court_id, w.court_id), w.court_id))
    return found


def session_leftover_minutes(session):
    """Minutes at the end of the session that do not make a whole window."""
    span = datetime.combine(session['date'], session['end']) - datetime.combine(session['date'], session['start'])
    return int(span.total_seconds() // 60) % SLOT_MINUTES


# --- people ----------------------------------------------------------------------------------------------------------

def person_map(registrations):
    """{registration id: person id}. Registrations are the same person when they share a linked member or an e-mail
    (transitively). The person id is the smallest registration id of the group, so it is stable."""
    parent = {}

    def find(node):
        parent.setdefault(node, node)
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    def union(a, b):
        root_a, root_b = find(a), find(b)
        if root_a != root_b:
            parent[root_b] = root_a

    for reg in registrations:
        node = ('r', reg['id'])
        find(node)
        if reg.get('user_id'):
            union(node, ('u', reg['user_id']))
        if reg.get('email'):
            union(node, ('e', reg['email'].strip().lower()))

    groups = defaultdict(list)
    for reg in registrations:
        groups[find(('r', reg['id']))].append(reg['id'])
    return {rid: min(ids) for ids in groups.values() for rid in ids}


def unavailable_intervals(rows, person_of):
    """{person: [(start, end)]} from unavailability rows (registration_id, play_date, start_time, end_time).
    A row without times blocks the whole day. Rows of different registrations of one person add up."""
    found = defaultdict(list)
    for row in rows:
        person = person_of.get(row['registration_id'])
        if person is None:
            continue
        if row['start_time'] is None:
            start = datetime.combine(row['play_date'], time.min)
            end = start + timedelta(days=1)
        else:
            start = datetime.combine(row['play_date'], row['start_time'])
            end = datetime.combine(row['play_date'], row['end_time'])
        found[person].append((start, end))
    return dict(found)


def people_of(match, person_of):
    return frozenset(person_of[e] for e in match['entries'] if e is not None and e in person_of)


def _rest(a, b):
    return timedelta(minutes=max(a['rest'], b['rest']))


# --- conflicts -------------------------------------------------------------------------------------------------------

def find_conflicts(matches, person_of, unavailable, valid_windows=None):
    """Everything wrong with the placed matches, as dicts {kind, severity, match_ids, people, detail}.

      invalid_window  error    placed where no usable window exists (valid_windows is the set of keys that do)
      overlap         error    one person in two matches at the same time
      order           error    a match starting before the ones that feed it have finished
      rest            warning  less rest than the category asks for (between a person's matches, or between a match
                               and the ones that feed it: the winner would play again too soon)
      unavailable     warning  a person playing when they said they cannot
    """
    found = []
    by_id = {m['id']: m for m in matches}
    placed = [m for m in matches if m['window']]

    if valid_windows is not None:
        for m in placed:
            if m['window'] not in valid_windows:
                found.append(dict(kind='invalid_window', severity=ERROR, match_ids=[m['id']], people=[], detail={}))

    pending = [m for m in placed if m['status'] == 'pending']
    by_person = defaultdict(list)
    for m in pending:
        for person in people_of(m, person_of):
            by_person[person].append(m)

    for person, group in by_person.items():
        group.sort(key=lambda m: (window_start(m['window']), m['id']))
        for index, first in enumerate(group):
            for second in group[index + 1:]:
                gap = window_start(second['window']) - window_end(first['window'])
                ids = sorted((first['id'], second['id']))
                if gap < timedelta(0):
                    found.append(dict(kind='overlap', severity=ERROR, match_ids=ids, people=[person], detail={}))
                elif gap < _rest(first, second):
                    found.append(dict(kind='rest', severity=WARNING, match_ids=ids, people=[person],
                                      detail={'gap': int(gap.total_seconds() // 60), 'needed': int(_rest(first, second).total_seconds() // 60)}))
        for m in group:
            for start, end in unavailable.get(person, ()):
                if window_start(m['window']) < end and start < window_end(m['window']):
                    found.append(dict(kind='unavailable', severity=WARNING, match_ids=[m['id']], people=[person], detail={}))
                    break

    for m in pending:
        for pred_id in m['preds']:
            pred = by_id.get(pred_id)
            if pred is None or pred['status'] != 'pending' or not pred['window']:
                continue
            gap = window_start(m['window']) - window_end(pred['window'])
            ids = sorted((pred['id'], m['id']))
            if gap < timedelta(0):
                found.append(dict(kind='order', severity=ERROR, match_ids=ids, people=[], detail={'before': pred['id']}))
            elif gap < _rest(pred, m):
                found.append(dict(kind='rest', severity=WARNING, match_ids=ids, people=[],
                                  detail={'before': pred['id'], 'gap': int(gap.total_seconds() // 60), 'needed': int(_rest(pred, m).total_seconds() // 60)}))

    found.sort(key=lambda c: (c['severity'] != ERROR, c['kind'], c['match_ids'], c['people']))
    return found


def conflict_signature(conflict):
    return (conflict['kind'], tuple(conflict['match_ids']), tuple(conflict['people']))


def new_conflicts(before, after):
    """Conflicts in `after` that were not already in `before`."""
    known = {conflict_signature(c) for c in before}
    return [c for c in after if conflict_signature(c) not in known]


# --- distribution ----------------------------------------------------------------------------------------------------

class _Planner:
    """The state of a distribution: who is where, and the one test (check) that says whether a match may go to a window.

    Constraints (hard): the window is free; not before `earliest`; after the matches that feed it, with their rest;
    before the matches it feeds, with rest; no person in two places, with the rest between their matches; no person
    in a time they cannot play. `cap` (matches per person per day) is soft: tried first, relaxed if nothing fits."""

    def __init__(self, matches, person_of, unavailable, earliest):
        self.by_id = {m['id']: m for m in matches}
        self.people = {m['id']: people_of(m, person_of) for m in matches}
        self.unavailable = unavailable
        self.earliest = earliest
        self.succs = defaultdict(list)
        for m in matches:
            for pred in m['preds']:
                self.succs[pred].append(m['id'])
        self.assign = {}               # pending matches that are placed -> window key
        self.occupied = {}             # window key -> match id (completed matches too)
        self.by_person = defaultdict(set)

    def place(self, mid, key):
        self.occupied[key] = mid
        if self.by_id[mid]['status'] == 'pending':
            self.assign[mid] = key
            for person in self.people[mid]:
                self.by_person[person].add(mid)

    def unplace(self, mid, key):
        del self.occupied[key]
        if mid in self.assign:
            del self.assign[mid]
            for person in self.people[mid]:
                self.by_person[person].discard(mid)

    def lower_bound(self, mid):
        """Earliest start allowed by the matches that feed this one."""
        bound = self.earliest
        m = self.by_id[mid]
        for pred_id in m['preds']:
            pred = self.by_id.get(pred_id)
            if pred is not None and pred['status'] == 'pending' and pred_id in self.assign:
                moment = window_end(self.assign[pred_id]) + _rest(pred, m)
                bound = moment if bound is None else max(bound, moment)
        return bound

    def check(self, mid, key, cap=None, tally=None):
        m = self.by_id[mid]
        start, end = window_start(key), window_end(key)

        def fail(kind, detail=None):
            if tally is not None:
                tally[(kind, detail)] += 1
            return False

        if self.earliest is not None and start < self.earliest:
            return fail('earliest')
        for pred_id in m['preds']:
            pred = self.by_id.get(pred_id)
            if pred is not None and pred['status'] == 'pending' and pred_id in self.assign \
                    and start < window_end(self.assign[pred_id]) + _rest(pred, m):
                return fail('pred', pred_id)
        for succ_id in self.succs.get(mid, ()):
            succ = self.by_id[succ_id]
            if succ['status'] == 'pending' and succ_id in self.assign and end + _rest(m, succ) > window_start(self.assign[succ_id]):
                return fail('succ', succ_id)
        for person in self.people[mid]:
            same_day = 0
            for other_id in self.by_person[person]:
                if other_id == mid:
                    continue
                other = self.by_id[other_id]
                rest = _rest(m, other)
                other_key = self.assign[other_id]
                if not (end + rest <= window_start(other_key) or window_end(other_key) + rest <= start):
                    return fail('person', person)
                same_day += other_key[1] == key[1]
            for blocked_start, blocked_end in self.unavailable.get(person, ()):
                if start < blocked_end and blocked_start < end:
                    return fail('unavailable', person)
            if cap is not None and same_day >= cap:
                return fail('daily', person)
        return True

    def person_cost(self, person):
        days = defaultdict(list)
        for mid in self.by_person[person]:
            key = self.assign[mid]
            days[key[1]].append((window_start(key), window_end(key)))
        cost = 0.0
        for spans in days.values():
            spans.sort()
            cost += WEIGHT_DAY * max(0, len(spans) - MAX_PER_DAY)
            for (_, first_end), (second_start, _) in zip(spans, spans[1:]):
                cost += WEIGHT_IDLE * (second_start - first_end).total_seconds() / 60
        return cost


def _reasons(tally, free_after):
    if not free_after:
        return [{'kind': 'no_window', 'detail': None, 'count': 0}]
    return [{'kind': kind, 'detail': detail, 'count': count} for (kind, detail), count in tally.most_common(3)]


def distribute(matches, windows, person_of, unavailable, targets, *, earliest=None, rng_seed=0, improve=True):
    """Place the `targets` (ids of pending matches) in free windows.

    matches: every match of the tournament (the others, placed or not, are context: placed ones stay where they are).
    windows: Window tuples that may be used (blocked ones already removed). earliest: nothing before this moment.
    Returns {'assignments': {match id: key}, 'unplaced': {match id: [reasons]}, 'metrics': {...}}.
    Same inputs and rng_seed always give the same answer.
    """
    rng = random.Random(rng_seed)
    targets = set(targets)
    planner = _Planner(matches, person_of, unavailable, earliest)
    for m in matches:
        if m['window'] and m['id'] not in targets:
            planner.place(m['id'], m['window'])

    usable = [w.key for w in windows]
    starts = [window_start(key) for key in usable]

    # Phases in order (groups, then knockout rounds), the most constrained players first inside a round
    load = Counter(person for mid in targets for person in planner.people[mid])
    buckets = defaultdict(list)
    for mid in targets:
        m = planner.by_id[mid]
        buckets[(0 if m['stage'] == 'group' else 1, m['round_number'])].append(mid)
    order = []
    for bucket in sorted(buckets):
        ids = sorted(buckets[bucket])
        rng.shuffle(ids)
        ids.sort(key=lambda mid: -max((load[p] for p in planner.people[mid]), default=0))
        order += ids

    unplaced = {}
    for mid in order:
        broken = [p for p in planner.by_id[mid]['preds'] if p in unplaced]
        if broken:
            unplaced[mid] = [{'kind': 'pred_unplaced', 'detail': broken[0], 'count': 0}]
            continue
        bound = planner.lower_bound(mid)
        first = bisect.bisect_left(starts, bound) if bound is not None else 0
        chosen = None
        for cap in (MAX_PER_DAY, None):
            for key in usable[first:]:
                if key not in planner.occupied and planner.check(mid, key, cap):
                    chosen = key
                    break
            if chosen:
                break
        if chosen:
            planner.place(mid, chosen)
        else:
            tally = Counter()
            free_after = [key for key in usable[first:] if key not in planner.occupied]
            for key in free_after:
                planner.check(mid, key, None, tally)
            unplaced[mid] = _reasons(tally, free_after)

    if improve:
        _improve(planner, [mid for mid in order if mid in planner.assign], usable, rng)

    assignments = {mid: planner.assign[mid] for mid in order if mid in planner.assign}
    return {'assignments': assignments, 'unplaced': unplaced, 'metrics': metrics(planner, assignments)}


def _improve(planner, movable, usable, rng):
    """Hill climbing: swap two placed matches, or move one to a free window, keeping only what lowers the cost."""
    if not movable or not usable:
        return
    step_of = {moment: index for index, moment in enumerate(sorted({window_start(key) for key in usable}))}

    def affected_cost(mids):
        persons = {p for mid in mids for p in planner.people[mid]}
        return sum(planner.person_cost(p) for p in persons) + WEIGHT_TIME * sum(step_of.get(window_start(planner.assign[mid]), 0) for mid in mids)

    stale = 0
    for _ in range(SEARCH_ITERATIONS):
        if stale >= SEARCH_PATIENCE:
            break
        stale += 1
        first = rng.choice(movable)
        old_first = planner.assign[first]
        if rng.random() < 0.5 and len(movable) > 1:
            second = rng.choice(movable)
            if second == first:
                continue
            old_second = planner.assign[second]
            mids = [first, second]
            before = affected_cost(mids)
            planner.unplace(first, old_first)
            planner.unplace(second, old_second)
            if planner.check(first, old_second):
                planner.place(first, old_second)
                if planner.check(second, old_first):
                    planner.place(second, old_first)
                    if affected_cost(mids) < before - 1e-9:
                        stale = 0
                        continue
                    planner.unplace(second, old_first)
                planner.unplace(first, old_second)
            planner.place(first, old_first)
            planner.place(second, old_second)
        else:
            key = rng.choice(usable)
            if key in planner.occupied:
                continue
            before = affected_cost([first])
            planner.unplace(first, old_first)
            if planner.check(first, key):
                planner.place(first, key)
                if affected_cost([first]) < before - 1e-9:
                    stale = 0
                    continue
                planner.unplace(first, key)
            planner.place(first, old_first)


def metrics(planner, assignments):
    """How good a distribution is: when it ends, the longest wait of a person between two matches of a day, the most
    matches a person plays in a day."""
    ends = [window_end(key) for key in assignments.values()]
    max_wait, max_day = 0, 0
    for person, mids in planner.by_person.items():
        days = defaultdict(list)
        for mid in mids:
            key = planner.assign[mid]
            days[key[1]].append((window_start(key), window_end(key)))
        for spans in days.values():
            spans.sort()
            max_day = max(max_day, len(spans))
            for (_, first_end), (second_start, _) in zip(spans, spans[1:]):
                max_wait = max(max_wait, int((second_start - first_end).total_seconds() // 60))
    return {'placed': len(assignments), 'ends_at': max(ends).isoformat() if ends else None,
            'max_wait_minutes': max_wait, 'max_matches_per_person_day': max_day}


def feasibility(matches, windows, targets, earliest=None):
    """Quick answer before distributing: are there enough free windows, and who is the busiest person."""
    targets = set(targets)
    taken = {m['window'] for m in matches if m['window'] and m['id'] not in targets}
    free = [w for w in windows if w.key not in taken and (earliest is None or window_start(w.key) >= earliest)]
    return {'matches': len(targets), 'windows': len(free), 'shortfall': max(0, len(targets) - len(free)),
            'time_steps': len({window_start(w.key) for w in free})}
