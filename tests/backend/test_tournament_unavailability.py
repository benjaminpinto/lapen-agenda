"""Players' unavailability: marking it, what the schedule does with it, and that nobody else ever sees it."""
import json

import pytest
from backend.schedule_support import (  # noqa: F401  (fixtures are used by name)
    DAY1, DAY2, DAY3, Event, event, group_matches,
)
from backend.tournament_support import (  # noqa: F401
    add_registration, audit_actions, client, clean_db, create_category, create_tournament, draw_url, ensure_courts,
    generate_draw,
    make_user, people, set_status, sql,
)


def url(ev, registration_id):
    return f'/api/admin/tournaments/{ev.tid}/registrations/{registration_id}/unavailability'


def put(ev, registration_id, items):
    return ev.client.put(url(ev, registration_id), json={'items': items}, headers=ev.h)


def get(ev, registration_id):
    response = ev.client.get(url(ev, registration_id), headers=ev.h)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def matches_of(ev, registration_id):
    return [m for m in ev.get()['matches'] if registration_id in [s['registration_id'] for s in m['sides']]]


def proposal(ev, **options):
    response = ev.call('post', '/distribute', options)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


# --- marking ------------------------------------------------------------------------------------------------------------

def test_only_the_admin_marks_impediments(event, people):
    reg = event.ids[0]
    for headers, expected in [({}, 401), (people.plain.headers, 403), (people.member.headers, 403)]:
        assert event.client.get(url(event, reg), headers=headers).status_code == expected
        assert event.client.put(url(event, reg), json={'items': []}, headers=headers).status_code == expected


def test_impediments_are_replaced_as_a_list_and_cleared_with_an_empty_one(event):
    reg = event.ids[0]
    assert get(event, reg)['items'] == []
    response = put(event, reg, [
        {'date': DAY2, 'start': '14:00', 'end': '18:00', 'note': 'trabalho'},
        {'date': DAY1},                                                     # whole day
        {'date': DAY1, 'start': '', 'end': '', 'note': '  consulta  '},     # empty times also mean the whole day (and is a duplicate but for the note)
    ])
    assert response.status_code == 200, response.get_json()
    items = response.get_json()['items']
    assert [(i['date'], i['whole_day'], i['start'], i['end'], i['note']) for i in items] == [
        (DAY1, True, None, None, None), (DAY1, True, None, None, 'consulta'), (DAY2, False, '14:00', '18:00', 'trabalho')]
    assert get(event, reg)['items'] == items
    # replacing swaps the whole list
    assert [i['date'] for i in put(event, reg, [{'date': DAY3, 'start': '08:00', 'end': '09:00'}]).get_json()['items']] == [DAY3]
    assert put(event, reg, []).get_json()['items'] == []
    assert 'unavailability_set' in audit_actions(event.tid)


def test_the_same_impediment_twice_is_stored_once(event):
    reg = event.ids[0]
    items = put(event, reg, [{'date': DAY1}, {'date': DAY1}, {'date': DAY1, 'start': '08:00', 'end': '10:00'}, {'date': DAY1, 'start': '08:00', 'end': '10:00'}])
    assert len(items.get_json()['items']) == 2


@pytest.mark.parametrize('item', [
    {'date': '2099-03-01'},                                    # outside the tournament
    {'date': DAY1, 'start': '08:00'},                          # only one end
    {'date': DAY1, 'end': '10:00'},
    {'date': DAY1, 'start': '10:00', 'end': '10:00'},
    {'date': DAY1, 'start': '10:00', 'end': '08:00'},
    {'date': DAY1, 'start': 'cedo', 'end': '10:00'},
    {'date': 'amanhã'},
    {'date': DAY1, 'note': 'x' * 201},
    'not an object',
])
def test_invalid_impediments_are_refused_and_nothing_is_changed(event, item):
    reg = event.ids[0]
    put(event, reg, [{'date': DAY1, 'note': 'keep'}])
    assert put(event, reg, [item]).status_code == 400
    assert [i['note'] for i in get(event, reg)['items']] == ['keep']


def test_the_list_must_be_a_list_of_reasonable_size_and_belong_to_this_tournament(event, client, people):
    reg = event.ids[0]
    assert event.client.put(url(event, reg), json={'items': 'x'}, headers=event.h).status_code == 400
    assert event.client.put(url(event, reg), json={}, headers=event.h).status_code == 400
    assert put(event, reg, [{'date': DAY1, 'start': f'{h:02d}:00', 'end': f'{h:02d}:30'} for h in range(0, 24)] * 3).status_code == 400   # 72 items: over the limit of 60
    assert put(event, 987654321, []).status_code == 404
    other = create_tournament(client, people.admin.headers, 'Test Tourn Other', start_date='2099-05-01', end_date='2099-05-02')
    other_cat = create_category(client, people.admin.headers, other['id'], name='Outra')
    foreign = add_registration(other_cat['id'], 'foreign')
    assert event.client.put(url(event, foreign), json={'items': []}, headers=event.h).status_code == 404   # not a registration of this tournament


def test_a_finished_tournament_cannot_change_impediments(event):
    sql("UPDATE tournaments SET status = 'finished' WHERE id = %s", (event.tid,))
    response = put(event, event.ids[0], [{'date': DAY1}])
    assert (response.status_code, response.get_json()['code']) == (409, 'tournament_locked')


# --- the same person in two categories ---------------------------------------------------------------------------------

@pytest.fixture
def two_categories(client, people):
    """Alfa and Beta (round robin of 4 each); the first player of both is the same person (same e-mail)."""
    courts = ensure_courts(2)
    headers = people.admin.headers
    tournament = create_tournament(client, headers, 'Test Tourn Twin')
    cats = [create_category(client, headers, tournament['id'], name=name, draw_format='round_robin') for name in ('Alfa', 'Beta')]
    regs = []
    for index, cat in enumerate(cats):
        regs.append([add_registration(cat['id'], f'tw{index}{n}', email='shared@ttourn.test' if n == 0 else f'tw{index}{n}@ttourn.test',
                                      display_name=f'Twin {index}{n}') for n in range(4)])
    assert set_status(client, headers, tournament['id'], 'registration_open').status_code == 200
    assert set_status(client, headers, tournament['id'], 'registration_closed').status_code == 200
    for cat in cats:
        generate_draw(client, headers, tournament, cat)
        assert client.post(draw_url(tournament, cat, '/publish'), headers=headers).status_code == 200
    return Event(client=client, h=headers, t=tournament, tid=tournament['id'], courts=courts, ids=regs[0] + regs[1], regs=regs)


def test_the_list_says_where_else_a_person_is_and_how_many_impediments(two_categories):
    ev = two_categories
    alfa, beta = ev.regs
    listing = ev.client.get(f'/api/admin/tournaments/{ev.tid}/registrations', headers=ev.h).get_json()['registrations']
    row = {r['id']: r for r in listing}
    assert [(o['registration_id'], o['category_name']) for o in row[alfa[0]]['also_in']] == [(beta[0], 'Beta')]
    assert [(o['registration_id'], o['category_name']) for o in row[beta[0]]['also_in']] == [(alfa[0], 'Alfa')]
    assert row[alfa[1]]['also_in'] == [] and row[alfa[0]]['unavailability_count'] == 0
    put(ev, alfa[0], [{'date': DAY1}, {'date': DAY2}])
    listing = ev.client.get(f'/api/admin/tournaments/{ev.tid}/registrations', headers=ev.h).get_json()['registrations']
    assert {r['id']: r['unavailability_count'] for r in listing}[alfa[0]] == 2
    assert [o['category_name'] for o in get(ev, alfa[0])['also_in']] == ['Beta']
    # a rejected registration is not "also in"
    sql("UPDATE tournament_registrations SET status = 'rejected' WHERE id = %s", (beta[0],))
    assert get(ev, alfa[0])['also_in'] == []


def test_an_impediment_marked_on_one_registration_holds_for_the_other(two_categories):
    ev = two_categories
    alfa, beta = ev.regs
    for day in (DAY1, DAY2, DAY3):                                # the person plays 6 matches: they need two free days
        assert ev.session(day).status_code == 201
    put(ev, beta[0], [{'date': DAY1}])                            # marked on the Beta registration only
    result = proposal(ev, rng_seed=1)
    placed = {a['match_id']: a for a in result['assignments']}
    mine = matches_of(ev, alfa[0]) + matches_of(ev, beta[0])      # ... yet the Alfa matches avoid that day too
    assert len(mine) == 6 and all(m['id'] in placed and placed[m['id']]['date'] != DAY1 for m in mine)
    assert result['unplaced'] == [] and result['conflicts'] == []
    assert any(a['date'] == DAY1 for a in result['assignments'])  # the others still use the first day


def test_placing_by_hand_in_a_time_of_impediment_warns_and_can_be_forced(two_categories):
    ev = two_categories
    alfa, beta = ev.regs
    ev.session(DAY1)
    put(ev, beta[0], [{'date': DAY1, 'start': '08:00', 'end': '10:00', 'note': 'dentista'}])
    match = matches_of(ev, alfa[0])[0]                            # the Alfa registration of the same person
    response = ev.place(match['id'], ev.courts[0], DAY1, '09:30')
    body = response.get_json()
    assert (response.status_code, body['code']) == (409, 'needs_confirmation')
    assert body['conflicts'][0]['kind'] == 'unavailable' and 'Twin' in body['conflicts'][0]['message']
    assert ev.window_of(match['id']) is None
    assert ev.place(match['id'], ev.courts[0], DAY1, '11:00').status_code == 200          # window starting after 10:00: fine
    assert ev.call('delete', f"/matches/{match['id']}").status_code == 200
    assert ev.place(match['id'], ev.courts[0], DAY1, '08:00', force=True).status_code == 200
    assert [c['kind'] for c in ev.get()['conflicts']] == ['unavailable']


def test_a_range_blocks_every_window_it_touches(two_categories):
    ev = two_categories
    alfa, _ = ev.regs
    ev.session(DAY1)
    ev.session(DAY2)
    put(ev, alfa[1], [{'date': DAY1, 'start': '08:00', 'end': '12:00'}])    # windows 8:00, 9:30 and 11:00 (to 12:30) are out
    result = proposal(ev, category_ids=[ev.get()['matches'][0]['category_id']], rng_seed=2)
    placed = {a['match_id']: a for a in result['assignments']}
    for match in matches_of(ev, alfa[1]):
        window = placed.get(match['id'])
        assert window is None or window['date'] == DAY2 or window['time'] >= '12:30'


def test_when_nothing_is_left_the_reason_names_the_player(two_categories):
    ev = two_categories
    alfa, _ = ev.regs
    ev.session(DAY1)
    put(ev, alfa[1], [{'date': DAY1}])
    result = proposal(ev, rng_seed=3)
    mine = {m['id'] for m in matches_of(ev, alfa[1])}
    unplaced = {u['match_id']: u for u in result['unplaced']}
    assert mine <= set(unplaced)
    assert any('Twin 01' in r and 'impedimento' in r for m in mine for r in unplaced[m]['reasons'])


# --- privacy -------------------------------------------------------------------------------------------------------------

def test_no_public_response_shows_impediments(event):
    secret = 'SEGREDO-IMPEDIMENTO-123'
    put(event, event.ids[0], [{'date': DAY1, 'note': secret}, {'date': DAY2, 'start': '08:00', 'end': '10:00', 'note': secret}])
    event.session(DAY1)
    event.session(DAY2)
    proposal_ = proposal(event, rng_seed=4)
    assert event.call('post', '/apply', {'assignments': proposal_['assignments'], 'unassign': []}).status_code == 200
    assert event.call('post', '/publish').status_code == 200
    slug = event.t['slug']
    category = event.c['id']
    responses = [event.client.get(path) for path in (
        '/api/tournaments', f'/api/tournaments/{slug}', f'/api/tournaments/{slug}/categories/{category}',
        f'/api/tournaments/{slug}/matches?view=upcoming', f'/api/tournaments/{slug}/matches?view=results')]
    for response in responses:
        assert response.status_code == 200
        text = json.dumps(response.get_json())
        assert secret not in text and 'unavailab' not in text and 'impediment' not in text.lower()
    # the admin registration list shows only how many there are, never the notes
    listing = event.client.get(f'/api/admin/tournaments/{event.tid}/registrations', headers=event.h).get_data(as_text=True)
    assert secret not in listing
