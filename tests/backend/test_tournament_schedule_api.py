"""Tournament schedule API: sessions, blocked windows, placing/moving/swapping, conflicts, publication, distribution."""
import threading

import pytest
from backend.schedule_support import (  # noqa: F401  (fixtures are used by name)
    DAY1, DAY2, DAY3, Event, disjoint_pair, event, first_pair_of_one_player, group_matches,
)
from backend.tournament_support import (  # noqa: F401
    add_registration, audit_actions, client, clean_db, create_category, create_tournament, draw_url, ensure_courts,
    generate_draw,
    make_user, people, set_status, sql,
)

from main import app


# --- permissions -----------------------------------------------------------------------------------------------------

def test_only_the_admin_reaches_the_schedule(event, people):
    client = event.client
    for headers, expected in [({}, 401), (people.plain.headers, 403), (people.member.headers, 403)]:
        assert client.get(event.url(), headers=headers).status_code == expected
        assert client.post(event.url('/sessions'), json={}, headers=headers).status_code == expected
        assert client.post(event.url('/publish'), headers=headers).status_code == expected
        assert client.post(event.url('/distribute'), json={}, headers=headers).status_code == expected
    assert event.get()['sessions'] == []


# --- sessions ---------------------------------------------------------------------------------------------------------

def test_a_session_becomes_windows_of_90_minutes(event):
    response = event.session()
    assert response.status_code == 201
    body = response.get_json()
    session = body['sessions'][0]
    assert (session['windows'], session['leftover_minutes'], session['court_ids']) == (12, 0, sorted(event.courts))
    times = sorted({w['time'] for w in body['windows']})
    assert times == ['08:00', '09:30', '11:00', '12:30', '14:00', '15:30']
    assert body['summary'] == {'pending': 15, 'placed': 0, 'unplaced': 15, 'windows': 12, 'free_windows': 12}
    # a leftover shows up on the session
    short = event.session(DAY2, '08:00', '16:30', courts=event.courts[:1]).get_json()
    assert short['sessions'][1]['windows'] == 5 and short['sessions'][1]['leftover_minutes'] == 60
    assert 'schedule_session_created' in audit_actions(event.tid)


@pytest.mark.parametrize('body, status, code', [
    ({'date': '2099-03-01', 'start': '08:00', 'end': '17:00'}, 400, 'date_out_of_range'),
    ({'date': DAY1, 'start': '10:00', 'end': '09:00'}, 400, None),
    ({'date': DAY1, 'start': '08:00', 'end': '09:00'}, 400, None),          # under 90 minutes
    ({'date': DAY1, 'start': '8h', 'end': '17:00'}, 400, None),
    ({'date': 'ontem', 'start': '08:00', 'end': '17:00'}, 400, None),
    ({'date': DAY1, 'start': '08:00', 'end': '17:00', 'court_ids': []}, 400, None),
    ({'date': DAY1, 'start': '08:00', 'end': '17:00', 'court_ids': [1234567]}, 400, 'unknown_court'),
])
def test_invalid_sessions_are_refused(event, body, status, code):
    body.setdefault('court_ids', event.courts)
    response = event.call('post', '/sessions', body)
    assert response.status_code == status, response.get_json()
    if code:
        assert response.get_json()['code'] == code
    assert event.get()['sessions'] == []


def test_sessions_may_not_overlap_on_the_same_court(event):
    assert event.session(DAY1, '08:00', '12:30', courts=event.courts[:1]).status_code == 201
    clash = event.session(DAY1, '11:00', '14:00', courts=event.courts[:1])
    assert (clash.status_code, clash.get_json()['code']) == (409, 'session_overlap')
    assert event.session(DAY1, '11:00', '14:00', courts=event.courts[1:]).status_code == 201   # other court: fine
    assert event.session(DAY1, '14:00', '17:00', courts=event.courts[:1]).status_code == 201   # after lunch: fine


def test_a_session_cannot_lose_a_window_that_holds_a_match(event):
    session_id = event.session().get_json()['sessions'][0]['id']
    match = group_matches(event)[0]
    assert event.place(match['id'], event.courts[0], DAY1, '15:30').status_code == 200
    shrink = event.call('put', f'/sessions/{session_id}', {'date': DAY1, 'start': '08:00', 'end': '14:00', 'court_ids': event.courts})
    body = shrink.get_json()
    assert (shrink.status_code, body['code']) == (409, 'window_in_use')
    assert [m['id'] for m in body['matches']] == [match['id']]
    assert event.call('delete', f'/sessions/{session_id}').status_code == 409
    # once the match leaves, it works
    assert event.call('delete', f"/matches/{match['id']}").status_code == 200
    assert event.call('put', f'/sessions/{session_id}', {'date': DAY1, 'start': '08:00', 'end': '14:00', 'court_ids': event.courts}).status_code == 200
    assert event.call('delete', f'/sessions/{session_id}').status_code == 200
    assert event.get()['windows'] == []


def test_a_finished_tournament_cannot_be_planned(event, client):
    event.session()
    for status in ('finished',):
        sql("UPDATE tournaments SET status = 'finished' WHERE id = %s", (event.tid,))
    response = event.session(DAY2)
    assert (response.status_code, response.get_json()['code']) == (409, 'tournament_locked')


# --- placing, moving, removing ----------------------------------------------------------------------------------------

def test_place_move_and_remove(event):
    event.session()
    match = group_matches(event)[0]
    assert match['window'] is None
    placed = event.place(match['id'], event.courts[0], DAY1, '08:00')
    assert placed.status_code == 200
    assert event.window_of(match['id']) == {'court_id': event.courts[0], 'date': DAY1, 'time': '08:00'}
    assert placed.get_json()['summary']['placed'] == 1
    # move to another window
    assert event.place(match['id'], event.courts[1], DAY1, '14:00').status_code == 200
    assert event.window_of(match['id']) == {'court_id': event.courts[1], 'date': DAY1, 'time': '14:00'}
    # the old window is free again
    other = group_matches(event)[1]
    assert event.place(other['id'], event.courts[0], DAY1, '08:00').status_code == 200
    # remove from the schedule
    assert event.call('delete', f"/matches/{match['id']}").status_code == 200
    assert event.window_of(match['id']) is None
    assert {'schedule_placed', 'schedule_removed'} <= set(audit_actions(event.tid))


def test_a_taken_unknown_or_blocked_window_is_refused(event):
    event.session(courts=event.courts[:1])
    first, second = disjoint_pair(event)
    assert event.place(first['id'], event.courts[0], DAY1, '08:00').status_code == 200
    taken = event.place(second['id'], event.courts[0], DAY1, '08:00')
    assert (taken.status_code, taken.get_json()['code']) == (409, 'window_taken')
    for window in [(event.courts[1], DAY1, '08:00'), (event.courts[0], DAY1, '08:30'), (event.courts[0], DAY2, '08:00')]:
        response = event.place(second['id'], *window)
        assert (response.status_code, response.get_json()['code']) == (400, 'invalid_window')
    assert event.place(second['id'], event.courts[0], DAY1, 'x').status_code == 400
    assert event.place(987654321, event.courts[0], DAY1, '11:00').status_code == 404


def test_a_played_match_cannot_be_moved(event):
    event.session()
    match = group_matches(event)[0]
    assert event.place(match['id'], event.courts[0], DAY1, '08:00').status_code == 200
    sql("UPDATE tournament_matches SET status = 'completed', outcome = 'normal', winner_entry_id = entry1_id, score = '6-0, 6-0' WHERE id = %s", (match['id'],))
    for response in (event.place(match['id'], event.courts[1], DAY1, '11:00'), event.call('delete', f"/matches/{match['id']}"),
                     event.call('put', f"/matches/{match['id']}/lock", {'locked': True})):
        assert (response.status_code, response.get_json()['code']) == (409, 'match_completed')


# --- conflicts ---------------------------------------------------------------------------------------------------------

def test_rest_is_a_warning_that_needs_confirmation(event):
    event.session()
    first, second = first_pair_of_one_player(event)
    assert event.place(first['id'], event.courts[0], DAY1, '08:00').status_code == 200
    # right after: 0 minutes of rest, 60 asked for
    response = event.place(second['id'], event.courts[0], DAY1, '09:30')
    body = response.get_json()
    assert (response.status_code, body['code']) == (409, 'needs_confirmation')
    assert [c['kind'] for c in body['conflicts']] == ['rest'] and 'descanso' in body['conflicts'][0]['message']
    assert 'Jogador' in body['conflicts'][0]['message']
    assert event.window_of(second['id']) is None
    # one window of gap is enough
    assert event.place(second['id'], event.courts[0], DAY1, '11:00').status_code == 200
    assert event.get()['conflicts'] == []
    # forcing keeps the warning visible in the panel
    assert event.call('delete', f"/matches/{second['id']}").status_code == 200
    assert event.place(second['id'], event.courts[0], DAY1, '09:30', force=True).status_code == 200
    assert [c['kind'] for c in event.get()['conflicts']] == ['rest']


def test_a_person_in_two_matches_at_once_is_an_error_even_when_forced(event):
    event.session()
    first, second = first_pair_of_one_player(event)
    assert event.place(first['id'], event.courts[0], DAY1, '08:00').status_code == 200
    response = event.place(second['id'], event.courts[1], DAY1, '08:00', force=True)
    body = response.get_json()
    assert (response.status_code, body['code']) == (409, 'schedule_conflict')
    assert body['conflicts'][0]['kind'] == 'overlap' and body['conflicts'][0]['severity'] == 'error'
    assert event.window_of(second['id']) is None


def test_the_same_person_in_two_categories_is_one_person(client, people):
    courts = ensure_courts(2)
    headers = people.admin.headers
    tournament = create_tournament(client, headers, 'Test Tourn Two')
    cats = [create_category(client, headers, tournament['id'], name=name, draw_format='round_robin') for name in ('Alfa', 'Beta')]
    for index, cat in enumerate(cats):
        for n in range(4):
            email = 'shared@ttourn.test' if n == 0 else f'c{index}p{n}@ttourn.test'
            add_registration(cat['id'], f'c{index}{n}', email=email, display_name=f'C{index}P{n}')
    assert set_status(client, headers, tournament['id'], 'registration_open').status_code == 200
    assert set_status(client, headers, tournament['id'], 'registration_closed').status_code == 200
    for cat in cats:
        generate_draw(client, headers, tournament, cat)
        assert client.post(draw_url(tournament, cat, '/publish'), headers=headers).status_code == 200
    ev = Event(client=client, h=headers, t=tournament, tid=tournament['id'], courts=courts)
    assert ev.session().status_code == 201
    shared = [m for m in ev.get()['matches'] if 'C0P0' in [s['name'] for s in m['sides']] or 'C1P0' in [s['name'] for s in m['sides']]]
    first = next(m for m in shared if m['category_name'] == 'Alfa')
    second = next(m for m in shared if m['category_name'] == 'Beta')
    assert ev.place(first['id'], courts[0], DAY1, '08:00').status_code == 200
    response = ev.place(second['id'], courts[1], DAY1, '08:00')
    assert response.get_json()['code'] == 'schedule_conflict'
    assert 'C0P0' in response.get_json()['conflicts'][0]['message'] or 'C1P0' in response.get_json()['conflicts'][0]['message']


def test_a_knockout_match_cannot_come_before_the_group_that_feeds_it(event):
    event.session(DAY1)
    event.session(DAY2)
    semi = next(m for m in event.matches(stage='knockout') if m['round_number'] == 1)
    group = group_matches(event)[0]
    assert event.place(group['id'], event.courts[0], DAY2, '14:00').status_code == 200
    response = event.place(semi['id'], event.courts[0], DAY1, '08:00')
    assert (response.status_code, response.get_json()['code']) == (409, 'schedule_conflict')
    assert response.get_json()['conflicts'][0]['kind'] == 'order'
    # after the group matches (with rest), it fits... but the other 5 group matches are unplaced, so only an order check against the placed one
    assert event.place(semi['id'], event.courts[0], DAY2, '15:30', force=True).status_code == 200


def test_moving_a_feeder_after_the_match_it_feeds_is_refused(event):
    event.session(DAY1)
    event.session(DAY2)
    semi = next(m for m in event.matches(stage='knockout') if m['round_number'] == 1)
    final = next(m for m in event.matches(stage='knockout') if m['round_number'] == 2)
    assert event.place(semi['id'], event.courts[0], DAY1, '08:00').status_code == 200
    assert event.place(final['id'], event.courts[0], DAY1, '12:30').status_code == 200
    response = event.place(semi['id'], event.courts[0], DAY2, '08:00')
    assert response.get_json()['code'] == 'schedule_conflict'
    assert event.window_of(semi['id'])['date'] == DAY1


# --- swapping ---------------------------------------------------------------------------------------------------------

def test_swap_exchanges_the_windows_of_two_matches(event):
    event.session()
    first, second = disjoint_pair(event)
    assert event.place(first['id'], event.courts[0], DAY1, '08:00').status_code == 200
    assert event.place(second['id'], event.courts[1], DAY1, '14:00').status_code == 200
    windows_before = sorted((m['window']['court_id'], m['window']['time']) for m in event.matches() if m['window'])
    response = event.swap(first['id'], second['id'])
    assert response.status_code == 200
    assert event.window_of(first['id']) == {'court_id': event.courts[1], 'date': DAY1, 'time': '14:00'}
    assert event.window_of(second['id']) == {'court_id': event.courts[0], 'date': DAY1, 'time': '08:00'}
    assert sorted((m['window']['court_id'], m['window']['time']) for m in event.matches() if m['window']) == windows_before  # nothing created or lost
    assert 'schedule_swapped' in audit_actions(event.tid)


def test_swapping_with_a_match_that_has_no_window_hands_it_over(event):
    event.session()
    placed, unplaced = disjoint_pair(event)
    assert event.place(placed['id'], event.courts[0], DAY1, '08:00').status_code == 200
    assert event.swap(placed['id'], unplaced['id']).status_code == 200
    assert event.window_of(placed['id']) is None
    assert event.window_of(unplaced['id']) == {'court_id': event.courts[0], 'date': DAY1, 'time': '08:00'}
    assert event.swap(placed['id'], placed['id']).status_code == 400
    both_none = group_matches(event)[2:4]
    assert event.swap(both_none[0]['id'], both_none[1]['id']).status_code == 400


def test_a_swap_that_creates_a_conflict_is_refused_and_changes_nothing(event):
    event.session()
    a, b = first_pair_of_one_player(event)           # share a player
    d = next(m for m in group_matches(event)
             if m['id'] not in (a['id'], b['id']) and not set(event.players(m)) & set(event.players(a)))
    court1, court2 = event.courts
    assert event.place(a['id'], court1, DAY1, '08:00').status_code == 200
    assert event.place(b['id'], court1, DAY1, '14:00').status_code == 200   # same player, hours later: fine
    assert event.place(d['id'], court2, DAY1, '08:00').status_code == 200   # nobody in common with a: fine
    before = {m['id']: m['window'] for m in event.matches()}

    # b would land beside a at 8:00: the shared player would be in two places
    response = event.swap(b['id'], d['id'])
    assert (response.status_code, response.get_json()['code']) == (409, 'schedule_conflict')
    assert response.get_json()['conflicts'][0]['kind'] == 'overlap'
    assert {m['id']: m['window'] for m in event.matches()} == before

    # a and d only trade courts at the same time: harmless
    assert event.swap(a['id'], d['id']).status_code == 200
    assert event.window_of(a['id'])['court_id'] == court2 and event.window_of(d['id'])['court_id'] == court1


def test_a_locked_match_cannot_be_moved_or_swapped_until_released(event):
    event.session()
    first, second = disjoint_pair(event)
    assert event.call('put', f"/matches/{first['id']}/lock", {'locked': True}).get_json()['code'] == 'not_planned'
    assert event.place(first['id'], event.courts[0], DAY1, '08:00').status_code == 200
    assert event.place(second['id'], event.courts[1], DAY1, '14:00').status_code == 200
    assert event.call('put', f"/matches/{first['id']}/lock", {'locked': 'yes'}).status_code == 400
    assert event.call('put', f"/matches/{first['id']}/lock", {'locked': True}).status_code == 200
    assert event.matches(id=first['id'])[0]['locked'] is True
    for response in (event.place(first['id'], event.courts[1], DAY1, '11:00'), event.swap(first['id'], second['id']),
                     event.swap(second['id'], first['id']), event.call('delete', f"/matches/{first['id']}")):
        assert (response.status_code, response.get_json()['code']) == (409, 'match_locked')
    assert event.call('put', f"/matches/{first['id']}/lock", {'locked': False}).status_code == 200
    assert event.swap(first['id'], second['id']).status_code == 200


# --- blocked windows ---------------------------------------------------------------------------------------------------

def test_blocking_a_window(event):
    event.session(courts=event.courts[:1])
    match = group_matches(event)[0]
    window = {'court_id': event.courts[0], 'date': DAY1, 'time': '08:00'}
    body = event.call('put', '/blocks', dict(window, blocked=True)).get_json()
    assert next(w for w in body['windows'] if w['time'] == '08:00')['blocked'] is True
    assert body['summary']['windows'] == 5  # one of six is gone
    assert event.place(match['id'], event.courts[0], DAY1, '08:00').get_json()['code'] == 'invalid_window'
    assert event.call('put', '/blocks', dict(window, blocked=False)).status_code == 200
    assert event.place(match['id'], event.courts[0], DAY1, '08:00').status_code == 200
    # blocking an occupied window asks first, then sends the match back to the list
    refused = event.call('put', '/blocks', dict(window, blocked=True))
    assert (refused.status_code, refused.get_json()['code']) == (409, 'window_occupied')
    assert event.window_of(match['id']) is not None
    assert event.call('put', '/blocks', dict(window, blocked=True, unplace=True)).status_code == 200
    assert event.window_of(match['id']) is None
    assert event.call('put', '/blocks', {'court_id': event.courts[0], 'date': DAY1, 'time': '08:30', 'blocked': True}).status_code == 404
    assert event.call('put', '/blocks', dict(window)).status_code == 400


# --- publication ------------------------------------------------------------------------------------------------------

def public_matches(client, slug):
    body = client.get(f'/api/tournaments/{slug}/matches', query_string={'view': 'upcoming'}).get_json()
    return body['matches']


def test_the_public_sees_times_only_after_publishing(event):
    event.session()
    match = group_matches(event)[0]
    assert event.place(match['id'], event.courts[0], DAY1, '08:00').status_code == 200
    slug = event.t['slug']
    nothing = event.call('post', '/unpublish')
    assert nothing.status_code == 200
    mine = next(m for m in public_matches(event.client, slug) if m['id'] == match['id'])
    assert (mine['planned_date'], mine['planned_time'], mine['court']) == (None, None, None)
    assert event.client.get(f'/api/tournaments/{slug}').get_json()['tournament']['schedule_published'] is False

    published = event.call('post', '/publish')
    assert published.status_code == 200 and published.get_json()['tournament']['schedule_published_at']
    mine = next(m for m in public_matches(event.client, slug) if m['id'] == match['id'])
    assert (mine['planned_date'], mine['planned_time']) == (DAY1, '08:00') and mine['court'] == 'TTourn Court'
    assert event.client.get(f'/api/tournaments/{slug}').get_json()['tournament']['schedule_published'] is True
    # a change after publishing is visible at once
    assert event.place(match['id'], event.courts[1], DAY1, '14:00').status_code == 200
    assert next(m for m in public_matches(event.client, slug) if m['id'] == match['id'])['planned_time'] == '14:00'
    event.call('post', '/unpublish')
    assert next(m for m in public_matches(event.client, slug) if m['id'] == match['id'])['planned_time'] is None
    assert {'schedule_published', 'schedule_unpublished'} <= set(audit_actions(event.tid))


def test_publishing_needs_at_least_one_scheduled_match(event):
    event.session()
    response = event.call('post', '/publish')
    assert (response.status_code, response.get_json()['code']) == (409, 'nothing_to_publish')


# --- concurrency ------------------------------------------------------------------------------------------------------

def test_two_admins_cannot_fill_the_same_window(event):
    event.session()
    first, second = disjoint_pair(event)
    results = {}

    def go(name, match):
        with app.test_client() as other:
            results[name] = other.post(event.url('/place'), json={'match_id': match['id'], 'court_id': event.courts[0], 'date': DAY1, 'time': '08:00'},
                                       headers=event.h).status_code

    threads = [threading.Thread(target=go, args=('a', first)), threading.Thread(target=go, args=('b', second))]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results.values()) == [200, 409], results
    holders = [m for m in event.matches() if m['window'] == {'court_id': event.courts[0], 'date': DAY1, 'time': '08:00'}]
    assert len(holders) == 1


# --- distribution (proposal and apply) ----------------------------------------------------------------------------------

def propose(ev, **options):
    response = ev.call('post', '/distribute', options)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def apply_proposal(ev, proposal):
    return ev.call('post', '/apply', {'assignments': proposal['assignments'], 'unassign': proposal['unassign']})


def test_a_proposal_writes_nothing_and_applying_it_leaves_no_conflict(event):
    event.session(DAY1)
    event.session(DAY2)
    before = event.get()
    proposal = propose(event, rng_seed=11)
    assert event.get()['matches'] == before['matches']                      # nothing written
    assert len(proposal['assignments']) == 15 and proposal['unplaced'] == [] and proposal['conflicts'] == []
    assert proposal['rng_seed'] == 11 and proposal['metrics']['placed'] == 15
    assert proposal['feasibility']['shortfall'] == 0 and proposal['feasibility']['windows'] == 24
    applied = apply_proposal(event, proposal)
    assert applied.status_code == 200, applied.get_json()
    after = applied.get_json()
    assert after['conflicts'] == [] and after['summary']['placed'] == 15 and after['summary']['unplaced'] == 0
    windows = [(m['window']['court_id'], m['window']['date'], m['window']['time']) for m in after['matches']]
    assert len(set(windows)) == 15
    assert 'schedule_applied' in audit_actions(event.tid)


def test_the_same_seed_gives_the_same_proposal(event):
    event.session(DAY1)
    event.session(DAY2)
    first = propose(event, rng_seed=5)
    again = propose(event, rng_seed=5)
    assert first == again
    assert propose(event)['rng_seed'] != propose(event)['rng_seed']       # a fresh seed each time when none is given


def test_what_does_not_fit_is_listed_with_its_reason(event):
    event.session(DAY1, '08:00', '11:00', courts=event.courts[:1])       # two windows for 15 matches
    proposal = propose(event, rng_seed=1)
    assert len(proposal['assignments']) <= 2 and len(proposal['unplaced']) >= 13
    assert proposal['feasibility']['shortfall'] == 13 and 'Faltam 13' in proposal['feasibility']['hint']
    assert all(item['reasons'] for item in proposal['unplaced'])
    assert any('Depende de' in r for item in proposal['unplaced'] for r in item['reasons'])
    assert apply_proposal(event, proposal).status_code == 200            # a partial proposal still applies cleanly
    assert event.get()['conflicts'] == []


def test_scope_limits_what_is_distributed_and_leaves_the_rest(event):
    event.session(DAY1)
    event.session(DAY2)
    event.session(DAY3)
    groups = propose(event, stage='group', rng_seed=2)
    assert len(groups['assignments']) == 12
    assert apply_proposal(event, groups).status_code == 200
    knockout = propose(event, stage='knockout', rng_seed=2)
    assert len(knockout['assignments']) == 3
    only_final = propose(event, stage='knockout', round_number=2, rng_seed=2)
    assert len(only_final['assignments']) == 1
    assert apply_proposal(event, knockout).status_code == 200
    assert propose(event, rng_seed=2)['assignments'] == []                 # nothing pending is left without a window
    bad = event.call('post', '/distribute', {'category_ids': [987654321]})
    assert bad.status_code == 404
    assert event.call('post', '/distribute', {'round_number': 1}).status_code == 400
    assert event.call('post', '/distribute', {'stage': 'final'}).status_code == 400
    assert event.call('post', '/distribute', {'from': 'amanha'}).status_code == 400


def test_locked_matches_stay_and_redo_replaces_the_rest(event):
    event.session(DAY1)
    event.session(DAY2)
    assert apply_proposal(event, propose(event, rng_seed=3)).status_code == 200
    pinned = group_matches(event)[0]
    assert event.call('put', f"/matches/{pinned['id']}/lock", {'locked': True}).status_code == 200
    pinned_window = event.window_of(pinned['id'])
    redo = propose(event, redo=True, rng_seed=4)
    assert pinned['id'] not in [a['match_id'] for a in redo['assignments']]
    assert len(redo['assignments']) + len(redo['unplaced']) == 14
    assert apply_proposal(event, redo).status_code == 200
    assert event.window_of(pinned['id']) == pinned_window
    assert event.get()['conflicts'] == [] and event.get()['summary']['placed'] == 15 - len(redo['unplaced'])


def test_from_leaves_everything_before_it_alone(event):
    event.session(DAY1)
    event.session(DAY2)
    proposal = propose(event, rng_seed=6, **{'from': f'{DAY2}T00:00'})
    assert proposal['assignments'] and all(a['date'] >= DAY2 for a in proposal['assignments'])
    only_one = propose(event, rng_seed=6, session_ids=[event.get()['sessions'][1]['id']])
    assert all(a['date'] == DAY2 for a in only_one['assignments'])


def test_a_stale_proposal_is_refused(event):
    event.session(DAY1)
    event.session(DAY2)
    proposal = propose(event, stage='group', rng_seed=7)
    taken = proposal['assignments'][0]
    outsider = next(m for m in event.matches(stage='knockout') if m['round_number'] == 2)   # the final: not in the proposal, unrelated to it
    # somebody else puts a match in a window the proposal wanted
    assert event.place(outsider['id'], taken['court_id'], taken['date'], taken['time']).status_code == 200
    response = apply_proposal(event, proposal)
    assert (response.status_code, response.get_json()['code']) == (409, 'stale_proposal')
    # and nothing of the proposal was written
    assert event.get()['summary']['placed'] == 1
    # a window blocked after the proposal was made is stale as well
    assert event.call('delete', f"/matches/{outsider['id']}").status_code == 200
    window = dict(court_id=taken['court_id'], date=taken['date'], time=taken['time'])
    assert event.call('put', '/blocks', dict(window, blocked=True)).status_code == 200
    assert apply_proposal(event, proposal).get_json()['code'] == 'stale_proposal'
    assert event.get()['summary']['placed'] == 0
    assert event.call('post', '/apply', {'assignments': 'x'}).status_code == 400
    assert event.call('post', '/apply', {'assignments': [{'match_id': 1}]}).status_code == 404         # not a match of this tournament
    assert event.call('post', '/apply', {'assignments': [{'match_id': outsider['id']}]}).status_code == 400   # no window


def test_apply_refuses_locked_played_and_duplicated_matches(event):
    event.session(DAY1)
    proposal = propose(event, stage='group', rng_seed=8)
    first = proposal['assignments'][0]
    twice = {'assignments': [first, first], 'unassign': []}
    assert event.call('post', '/apply', twice).status_code == 400
    same_window = {'assignments': [first, dict(proposal['assignments'][1], court_id=first['court_id'], date=first['date'], time=first['time'])], 'unassign': []}
    assert event.call('post', '/apply', same_window).get_json()['code'] == 'stale_proposal'
    sql("UPDATE tournament_matches SET locked = TRUE WHERE id = %s", (first['match_id'],))
    assert event.call('post', '/apply', {'assignments': [first], 'unassign': []}).get_json()['code'] == 'match_locked'
