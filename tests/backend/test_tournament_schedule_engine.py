"""Tournament schedule engine: windows, people, conflicts and distribution. Pure: no database."""
import os
import random
import sys
from datetime import date, datetime, time, timedelta

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from src.services import tournament_schedule as sched
from src.services.tournament_draw import round_robin_rounds
from src.services.tournament_schedule import (
    ERROR, WARNING, build_windows, distribute, feasibility, find_conflicts, new_conflicts, person_map, session_leftover_minutes,
    unavailable_intervals, window_end, window_start,
)

DAY1, DAY2 = date(2030, 5, 4), date(2030, 5, 5)


def session(day=DAY1, start=time(8, 0), end=time(17, 0), courts=(1, 2), sid=1):
    return {'id': sid, 'date': day, 'start': start, 'end': end, 'court_ids': list(courts)}


def match(mid, entries=(None, None), window=None, status='pending', preds=(), rest=60, stage='group', round_number=1,
          category_id=1, locked=False):
    return {'id': mid, 'category_id': category_id, 'status': status, 'entries': tuple(entries), 'window': window,
            'preds': list(preds), 'rest': rest, 'stage': stage, 'round_number': round_number, 'locked': locked}


def at(court, hour, minute=0, day=DAY1):
    return (court, day, time(hour, minute))


def kinds(conflicts):
    return sorted(c['kind'] for c in conflicts)


# --- windows ---------------------------------------------------------------------------------------------------------

def test_windows_are_90_minutes_from_the_start_and_only_whole_ones_fit():
    windows = build_windows([session(start=time(8, 0), end=time(17, 0), courts=(1, 2))], court_order=[1, 2])
    assert [w.time for w in windows if w.court_id == 1] == [time(8), time(9, 30), time(11), time(12, 30), time(14), time(15, 30)]
    assert len(windows) == 12
    assert [w.court_id for w in windows[:4]] == [1, 2, 1, 2]  # same time: courts in order
    # 8:00 to 16:30 is 8h30: 5 whole windows, 60 minutes left over
    short = session(end=time(16, 30))
    assert len(build_windows([short], court_order=[1, 2])) == 10 and session_leftover_minutes(short) == 60
    assert session_leftover_minutes(session()) == 0


def test_windows_flag_blocked_ones_and_two_sessions_leave_a_lunch_break():
    morning = session(start=time(8), end=time(12, 30), courts=(1,), sid=1)
    afternoon = session(start=time(14), end=time(17), courts=(1,), sid=2)
    windows = build_windows([morning, afternoon], blocks=[at(1, 9, 30)])
    assert [(w.time, w.blocked) for w in windows] == [
        (time(8), False), (time(9, 30), True), (time(11), False), (time(14), False), (time(15, 30), False)]
    assert not any(w.time == time(12, 30) for w in windows)


def test_overlapping_sessions_do_not_duplicate_a_window():
    windows = build_windows([session(courts=(1,), sid=1), session(start=time(9, 30), end=time(13), courts=(1,), sid=2)])
    keys = [w.key for w in windows]
    assert len(keys) == len(set(keys))


# --- people ----------------------------------------------------------------------------------------------------------

def test_same_member_or_same_email_is_the_same_person_transitively():
    regs = [
        {'id': 5, 'user_id': 10, 'email': 'a@x.com'},
        {'id': 6, 'user_id': None, 'email': 'A@X.com '},       # same e-mail as 5
        {'id': 7, 'user_id': 10, 'email': 'other@x.com'},      # same member as 5
        {'id': 8, 'user_id': None, 'email': 'other@x.com'},    # same e-mail as 7, so same chain
        {'id': 9, 'user_id': None, 'email': 'solo@x.com'},
        {'id': 11, 'user_id': None, 'email': None},
    ]
    people = person_map(regs)
    assert people[5] == people[6] == people[7] == people[8] == 5
    assert people[9] == 9 and people[11] == 11


def test_unavailability_whole_day_and_range_add_up_per_person():
    people = {1: 1, 2: 1, 3: 3}
    rows = [
        {'registration_id': 1, 'play_date': DAY1, 'start_time': None, 'end_time': None},
        {'registration_id': 2, 'play_date': DAY2, 'start_time': time(8), 'end_time': time(12)},
        {'registration_id': 99, 'play_date': DAY1, 'start_time': None, 'end_time': None},  # unknown registration
    ]
    found = unavailable_intervals(rows, people)
    assert set(found) == {1}
    assert (datetime(2030, 5, 4), datetime(2030, 5, 5)) in found[1]
    assert (datetime(2030, 5, 5, 8), datetime(2030, 5, 5, 12)) in found[1]


# --- conflicts -------------------------------------------------------------------------------------------------------

def test_the_same_person_twice_at_once_is_an_error():
    people = {1: 1, 2: 2, 3: 1, 4: 4}
    matches = [match(1, (1, 2), at(1, 8)), match(2, (3, 4), at(2, 9, 30))]  # 9:30 starts 90 min after 8:00: no overlap
    assert find_conflicts(matches, people, {}) == [dict(kind='rest', severity=WARNING, match_ids=[1, 2], people=[1], detail={'gap': 0, 'needed': 60})]
    matches[1]['window'] = at(2, 8)  # same time on another court
    only = find_conflicts(matches, people, {})
    assert [(c['kind'], c['severity'], c['match_ids'], c['people']) for c in only] == [('overlap', ERROR, [1, 2], [1])]


def test_rest_is_the_larger_of_the_two_categories_and_a_gap_of_exactly_the_rest_is_fine():
    people = {1: 1, 2: 2, 3: 1, 4: 4}
    # 8:00-9:30, next at 10:30 = 60 min of rest
    ok = [match(1, (1, 2), at(1, 8)), match(2, (3, 4), at(1, 10, 30))]
    assert find_conflicts(ok, people, {}) == []
    stricter = [match(1, (1, 2), at(1, 8)), match(2, (3, 4), at(1, 10, 30), rest=90)]
    assert kinds(find_conflicts(stricter, people, {})) == ['rest']
    assert find_conflicts(stricter, people, {})[0]['detail'] == {'gap': 60, 'needed': 90}


def test_rest_conflict_is_not_hidden_behind_a_nearer_match_with_a_smaller_rest():
    people = {1: 1, 2: 2, 3: 1, 4: 4, 5: 1, 6: 6}
    matches = [match(1, (1, 2), at(1, 8), rest=30), match(2, (3, 4), at(1, 10), rest=30), match(3, (5, 6), at(1, 11, 30), rest=180)]
    found = find_conflicts(matches, people, {})
    assert sorted(c['match_ids'] for c in found if c['kind'] == 'rest') == [[1, 3], [2, 3]]


def test_completed_matches_never_conflict_with_people_but_still_occupy_windows():
    people = {1: 1, 2: 2, 3: 1, 4: 4}
    matches = [match(1, (1, 2), at(1, 8), status='completed'), match(2, (3, 4), at(2, 8))]
    assert find_conflicts(matches, people, {}) == []


def test_unavailability_is_a_warning_on_any_overlap_with_the_window():
    people = {1: 1, 2: 2}
    blocked = {1: [(datetime(2030, 5, 4, 9), datetime(2030, 5, 4, 10))]}
    # windows that merely touch the blocked 9:00-10:00 (7:30-9:00 before it, 10:00-11:30 after it) are fine
    for hour, minute, expected in [(8, 0, ['unavailable']), (9, 30, ['unavailable']), (10, 0, []), (7, 30, [])]:
        found = find_conflicts([match(1, (1, 2), at(1, hour, minute))], people, blocked)
        assert kinds(found) == expected, (hour, minute)
    assert all(c['severity'] == WARNING for c in find_conflicts([match(1, (1, 2), at(1, 8))], people, blocked))


def test_a_match_before_the_ones_that_feed_it_is_an_error_and_a_short_gap_is_a_warning():
    feeder = match(1, (1, 2), at(1, 10, 30))
    later = match(2, (None, None), at(1, 9), preds=[1], stage='knockout', round_number=2)
    found = find_conflicts([feeder, later], {1: 1, 2: 2}, {})
    assert [(c['kind'], c['severity'], c['detail']) for c in found] == [('order', ERROR, {'before': 1})]
    later['window'] = at(1, 12)  # feeder ends 12:00: no gap at all
    assert [(c['kind'], c['severity']) for c in find_conflicts([feeder, later], {1: 1, 2: 2}, {})] == [('rest', WARNING)]
    later['window'] = at(1, 13)  # 60 min: fine
    assert find_conflicts([feeder, later], {1: 1, 2: 2}, {}) == []
    feeder['status'] = 'completed'  # a played feeder no longer constrains the next match
    later['window'] = at(1, 8)
    assert find_conflicts([feeder, later], {1: 1, 2: 2}, {}) == []


def test_invalid_windows_are_errors_only_when_the_valid_set_is_given():
    m = match(1, (1, 2), at(3, 8))
    assert find_conflicts([m], {1: 1, 2: 2}, {}) == []
    found = find_conflicts([m], {1: 1, 2: 2}, {}, valid_windows={at(1, 8)})
    assert [(c['kind'], c['severity']) for c in found] == [('invalid_window', ERROR)]


def test_new_conflicts_are_the_ones_an_edit_added():
    people = {1: 1, 2: 2, 3: 1, 4: 4}
    before = find_conflicts([match(1, (1, 2), at(1, 8)), match(2, (3, 4), at(1, 14))], people, {})
    after = find_conflicts([match(1, (1, 2), at(1, 8)), match(2, (3, 4), at(2, 8))], people, {})
    assert before == [] and [c['kind'] for c in new_conflicts(before, after)] == ['overlap']
    assert new_conflicts(after, after) == []


# --- distribution ----------------------------------------------------------------------------------------------------

class Tournament:
    """A synthetic tournament: categories of groups (round robin) with an optional knockout fed by them."""

    def __init__(self):
        self.matches, self.entries, self.next_id, self.next_entry = [], {}, 1, 1
        self.regs = []

    def entry(self, category, email=None, user_id=None):
        eid = self.next_entry
        self.next_entry += 1
        self.regs.append({'id': eid, 'user_id': user_id, 'email': email or f'p{eid}@x.com'})
        return eid

    def add(self, **kwargs):
        m = match(self.next_id, **kwargs)
        self.next_id += 1
        self.matches.append(m)
        return m

    def groups(self, category, sizes, rest=60):
        made = []
        for size in sizes:
            members = [self.entry(category) for _ in range(size)]
            ids = []
            for round_number, pairs in enumerate(round_robin_rounds(members), start=1):
                for pair in pairs:
                    ids.append(self.add(entries=pair, round_number=round_number, category_id=category, rest=rest, stage='group')['id'])
            made.append(ids)
        return made

    def knockout(self, category, group_ids, rest=60):
        """Semifinals fed by two groups (crossed) and a final."""
        a, b = group_ids[0], group_ids[1]
        semi1 = self.add(preds=a + b, stage='knockout', round_number=1, category_id=category, rest=rest)
        semi2 = self.add(preds=a + b, stage='knockout', round_number=1, category_id=category, rest=rest)
        self.add(preds=[semi1['id'], semi2['id']], stage='knockout', round_number=2, category_id=category, rest=rest)

    def people(self):
        return person_map(self.regs)


def run(tournament, windows, targets=None, unavailable=None, seed=1, **kwargs):
    targets = [m['id'] for m in tournament.matches if m['status'] == 'pending'] if targets is None else targets
    return distribute(tournament.matches, windows, tournament.people(), unavailable or {}, targets, rng_seed=seed, **kwargs)


def apply(tournament, result):
    for m in tournament.matches:
        if m['id'] in result['assignments']:
            m['window'] = result['assignments'][m['id']]


def assert_clean(tournament, windows, unavailable=None):
    """No error, and none of the warnings the distribution treats as hard."""
    valid = {w.key for w in windows if not w.blocked}
    found = find_conflicts(tournament.matches, tournament.people(), unavailable or {}, valid)
    assert found == [], found


def two_days(courts=(1, 2)):
    return build_windows([session(courts=courts), session(day=DAY2, courts=courts, sid=2)], court_order=list(courts))


def test_distribute_fills_the_earliest_windows_and_leaves_no_conflict():
    t = Tournament()
    t.groups(1, [4, 4])
    windows = two_days()  # one day is not enough: with 60 min of rest a player cannot use two windows in a row
    result = run(t, windows)
    assert result['unplaced'] == {} and len(result['assignments']) == 12
    apply(t, result)
    assert_clean(t, windows)
    assert len({m['window'] for m in t.matches}) == 12  # one match per window
    assert result['metrics']['placed'] == 12


def test_distribute_is_reproducible_for_the_same_seed_and_may_differ_for_another():
    t = Tournament()
    t.groups(1, [4, 4])
    t.groups(2, [3, 3])
    windows = build_windows([session(courts=(1, 2, 3))], court_order=[1, 2, 3])
    first = run(t, windows, seed=7)
    again = run(t, windows, seed=7)
    assert first == again


def test_the_knockout_waits_for_the_groups_that_feed_it_with_rest():
    t = Tournament()
    groups = t.groups(1, [4, 4])
    t.knockout(1, groups)
    windows = build_windows([session(courts=(1, 2)), session(day=DAY2, courts=(1, 2), sid=2)], court_order=[1, 2])
    result = run(t, windows)
    assert result['unplaced'] == {}
    apply(t, result)
    assert_clean(t, windows)
    group_end = max(window_end(m['window']) for m in t.matches if m['stage'] == 'group')
    semis = [m for m in t.matches if m['stage'] == 'knockout' and m['round_number'] == 1]
    assert all(window_start(m['window']) >= group_end + timedelta(minutes=60) for m in semis)
    final = [m for m in t.matches if m['stage'] == 'knockout' and m['round_number'] == 2][0]
    assert window_start(final['window']) >= max(window_end(m['window']) for m in semis) + timedelta(minutes=60)


def test_one_person_in_two_categories_is_never_in_two_places_and_is_rested():
    t = Tournament()
    t.groups(1, [3])
    t.groups(2, [3])
    # the first player of category 2 is the first player of category 1 as well (same e-mail)
    shared = t.entry(2, email='p1@x.com')
    t.matches[3]['entries'] = (shared, t.matches[3]['entries'][1])
    windows = build_windows([session(courts=(1, 2, 3))], court_order=[1, 2, 3])
    result = run(t, windows)
    assert result['unplaced'] == {}
    apply(t, result)
    assert_clean(t, windows)


def test_a_person_is_not_put_where_they_cannot_play():
    t = Tournament()
    t.groups(1, [4])
    windows = two_days()
    morning = {1: [(datetime(2030, 5, 4, 0), datetime(2030, 5, 4, 12))]}  # person 1 cannot play on the first morning
    result = run(t, windows, unavailable=morning)
    assert result['unplaced'] == {}
    apply(t, result)
    assert_clean(t, windows, morning)
    for m in t.matches:
        if 1 in m['entries']:
            assert window_start(m['window']) >= datetime(2030, 5, 4, 12)


def test_what_does_not_fit_is_reported_with_the_reason_and_the_rest_is_still_placed():
    t = Tournament()
    t.groups(1, [4])
    windows = build_windows([session(start=time(8), end=time(11), courts=(1,))], court_order=[1])  # two windows only
    result = run(t, windows)
    assert len(result['assignments']) < 6 and len(result['unplaced']) == 6 - len(result['assignments'])
    reasons = {kind for reasons in result['unplaced'].values() for r in reasons for kind in [r['kind']]}
    assert reasons & {'no_window', 'person', 'pred'}
    apply(t, result)
    assert_clean(t, windows)
    assert feasibility(t.matches, windows, [m['id'] for m in t.matches], None)['shortfall'] == 6 - 2


def test_unavailable_all_day_is_explained_as_unavailable():
    t = Tournament()
    t.groups(1, [3])
    windows = build_windows([session(courts=(1, 2))], court_order=[1, 2])
    nobody = {1: [(datetime(2030, 5, 4), datetime(2030, 5, 5))]}
    result = run(t, windows, unavailable=nobody)
    blocked = [mid for mid, m in ((x['id'], x) for x in t.matches) if 1 in m['entries']]
    assert set(result['unplaced']) == set(blocked)
    assert all(result['unplaced'][mid][0]['kind'] == 'unavailable' for mid in blocked)


def test_a_match_whose_feeder_could_not_be_placed_is_not_placed_either():
    t = Tournament()
    groups = t.groups(1, [4, 4])
    t.knockout(1, groups)
    windows = build_windows([session(start=time(8), end=time(11), courts=(1,))], court_order=[1])
    result = run(t, windows)
    final = t.matches[-1]['id']
    assert final in result['unplaced'] and result['unplaced'][final][0]['kind'] == 'pred_unplaced'


def test_locked_and_played_matches_stay_and_targets_go_around_them():
    t = Tournament()
    t.groups(1, [4])
    windows = build_windows([session(courts=(1,))], court_order=[1])
    t.matches[0]['window'] = at(1, 8)
    t.matches[0]['locked'] = True
    t.matches[1]['window'] = at(1, 11)
    t.matches[1]['status'] = 'completed'
    targets = [m['id'] for m in t.matches[2:]]
    result = run(t, windows, targets=targets)
    assert set(result['assignments']) | set(result['unplaced']) == set(targets)
    assert at(1, 8) not in result['assignments'].values() and at(1, 11) not in result['assignments'].values()
    apply(t, result)
    assert_clean(t, windows)


def test_earliest_keeps_everything_before_it_untouched():
    t = Tournament()
    t.groups(1, [4])
    windows = build_windows([session(courts=(1, 2))], court_order=[1, 2])
    cutoff = datetime(2030, 5, 4, 12, 30)
    result = run(t, windows, earliest=cutoff)
    assert result['assignments'] and all(window_start(k) >= cutoff for k in result['assignments'].values())


def test_redoing_already_placed_matches_frees_their_windows_first():
    t = Tournament()
    t.groups(1, [4])
    windows = build_windows([session(courts=(1, 2))], court_order=[1, 2])
    apply(t, run(t, windows, improve=False))
    ids = [m['id'] for m in t.matches]
    result = run(t, windows, targets=ids, seed=3)
    assert result['unplaced'] == {} and len(set(result['assignments'].values())) == 6


def planner_cost(planner, usable):
    steps = {moment: i for i, moment in enumerate(sorted({window_start(k) for k in usable}))}
    return (sum(planner.person_cost(p) for p in planner.by_person)
            + sched.WEIGHT_TIME * sum(steps[window_start(planner.assign[mid])] for mid in planner.assign))


def test_the_search_closes_a_gap_a_player_would_otherwise_wait():
    """The first match is fixed, the second was left hours later: the search pulls it forward to the first window that
    respects the 60 minutes of rest (9:30 would have none)."""
    people = person_map([{'id': 1, 'user_id': None, 'email': 'a@x'}, {'id': 2, 'user_id': None, 'email': 'b@x'}, {'id': 3, 'user_id': None, 'email': 'c@x'}])
    matches = [match(1, (1, 2)), match(2, (1, 3))]
    usable = [w.key for w in build_windows([session(courts=(1,))], court_order=[1])]
    for seed in range(5):
        planner = sched._Planner(matches, people, {}, None)
        planner.place(1, at(1, 8))
        planner.place(2, at(1, 15, 30))                  # 5 hours later
        sched._improve(planner, [2], usable, random.Random(seed))
        assert planner.assign[1] == at(1, 8) and planner.assign[2] == at(1, 11), seed


@pytest.mark.parametrize('seed', range(6))
def test_the_search_never_raises_the_cost_and_often_lowers_it(seed):
    t = Tournament()
    t.groups(1, [4, 3])
    t.groups(2, [4])
    windows = build_windows([session(courts=(1, 2)), session(day=DAY2, courts=(1, 2), sid=2)], court_order=[1, 2])
    usable = [w.key for w in windows]
    people = t.people()
    start = distribute(t.matches, windows, people, {}, [m['id'] for m in t.matches], rng_seed=seed, improve=False)
    planner = sched._Planner(t.matches, people, {}, None)
    for mid, key in start['assignments'].items():
        planner.place(mid, key)
    before = planner_cost(planner, usable)
    sched._improve(planner, list(start['assignments']), usable, random.Random(seed))
    assert planner_cost(planner, usable) <= before + 1e-9
    for m in t.matches:                                  # and what it produced is still a valid schedule
        m['window'] = planner.assign.get(m['id'])
    assert find_conflicts(t.matches, people, {}, set(usable)) == []


def test_the_search_improves_at_least_one_start():
    gains = 0
    for seed in range(12):
        t = Tournament()
        t.groups(1, [4, 3])
        t.groups(2, [4])
        windows = build_windows([session(courts=(1, 2)), session(day=DAY2, courts=(1, 2), sid=2)], court_order=[1, 2])
        usable = [w.key for w in windows]
        people = t.people()
        start = distribute(t.matches, windows, people, {}, [m['id'] for m in t.matches], rng_seed=seed, improve=False)
        planner = sched._Planner(t.matches, people, {}, None)
        for mid, key in start['assignments'].items():
            planner.place(mid, key)
        before = planner_cost(planner, usable)
        sched._improve(planner, list(start['assignments']), usable, random.Random(seed))
        gains += planner_cost(planner, usable) < before - 1e-9
    assert gains > 0


def test_the_search_never_makes_the_cost_worse_than_the_greedy_start():
    t = Tournament()
    t.groups(1, [4, 4])
    t.groups(2, [3, 3])
    windows = build_windows([session(courts=(1, 2)), session(day=DAY2, courts=(1, 2), sid=2)], court_order=[1, 2])
    plain = run(t, windows, seed=5, improve=False)
    better = run(t, windows, seed=5, improve=True)
    assert better['unplaced'] == plain['unplaced'] == {}
    assert better['metrics']['max_wait_minutes'] <= plain['metrics']['max_wait_minutes'] or better['metrics']['ends_at'] <= plain['metrics']['ends_at']
    apply(t, better)
    assert_clean(t, windows)


@pytest.mark.parametrize('seed', range(25))
def test_random_tournaments_never_break_a_hard_rule(seed):
    """Property: whatever the shape of the tournament and the availability, a distribution has no conflict at all."""
    rng = random.Random(seed)
    t = Tournament()
    last_groups = None
    for category in range(1, rng.randint(2, 4)):
        sizes = [rng.randint(3, 5) for _ in range(rng.randint(1, 3))]
        made = t.groups(category, sizes, rest=rng.choice([30, 60, 90]))
        if len(made) >= 2 and rng.random() < 0.7:
            t.knockout(category, made)
    shared = rng.sample(range(1, t.next_entry), k=min(3, t.next_entry - 1))
    for other in shared[1:]:  # some people play two categories
        reg = next(r for r in t.regs if r['id'] == other)
        reg['email'] = next(r for r in t.regs if r['id'] == shared[0])['email']
    courts = tuple(range(1, rng.randint(2, 4)))
    days = [session(day=DAY1, courts=courts, sid=1)]
    if rng.random() < 0.7:
        days.append(session(day=DAY2, start=time(8), end=time(14), courts=courts, sid=2))
    windows = build_windows(days, blocks=[at(courts[0], 11)] if rng.random() < 0.5 else [], court_order=list(courts))
    usable = [w for w in windows if not w.blocked]
    people = t.people()
    blocked = {}
    for person in set(people.values()):
        if rng.random() < 0.3:
            start = datetime.combine(rng.choice([DAY1, DAY2]), time(rng.choice([8, 10, 12, 14])))
            blocked.setdefault(person, []).append((start, start + timedelta(hours=rng.choice([2, 4]))))
    result = distribute(t.matches, usable, people, blocked, [m['id'] for m in t.matches], rng_seed=seed)
    apply(t, result)
    placed_only = [m for m in t.matches if m['window']]
    assert len({m['window'] for m in placed_only}) == len(placed_only)  # one match per window
    assert {m['window'] for m in placed_only} <= {w.key for w in usable}
    found = find_conflicts(t.matches, people, blocked, {w.key for w in usable})
    assert found == [], found
    for mid in result['unplaced']:
        assert mid not in result['assignments'] and result['unplaced'][mid]


def test_two_hundred_matches_are_distributed_quickly():
    import time as clock
    t = Tournament()
    for category in range(1, 6):
        made = t.groups(category, [5, 5, 5, 5])
        t.knockout(category, made)
    assert len(t.matches) >= 200
    courts = (1, 2, 3, 4, 5, 6)
    windows = build_windows([session(day=DAY1 + timedelta(days=d), courts=courts, sid=d + 1) for d in range(4)], court_order=list(courts))
    started = clock.perf_counter()
    result = run(t, windows)
    elapsed = clock.perf_counter() - started
    assert elapsed < 2.0, elapsed
    apply(t, result)
    assert_clean(t, windows)
