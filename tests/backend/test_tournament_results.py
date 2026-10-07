"""Recording, correcting and annulling results, and what they set in motion."""
import threading

import pytest
from backend.tournament_support import (  # noqa: F401  (fixtures are used by name)
    add_registration, app, audit_actions, clean_db, client, closed_tournament, create_category, create_tournament,
    draw_matches, draw_of, draw_url, find_match, generate_draw, patch_registration, people, play, play_groups,
    play_round,
    result_url, set_status, sql, started_tournament, varied_score,
)

from src.database import get_db
from src.services import tournament_results as results_svc
from src.services.tournament_service import TournamentError

GROUPS = dict(draw_format='groups_knockout', group_target_size=4, qualifiers_per_group=2)


def category_status(category_id):
    return sql('SELECT status FROM tournament_categories WHERE id = %s', (category_id,))[0]['status']


def standings(client, headers, tournament, category):
    response = client.get(f"/api/admin/tournaments/{tournament['id']}/categories/{category['id']}/standings", headers=headers)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def row_match(match_id):
    return sql('SELECT * FROM tournament_matches WHERE id = %s', (match_id,))[0]


def knockout_round(draw, number):
    return next(r for r in draw['knockout']['rounds'] if r['round_number'] == number)['matches']


def slot(match, number):
    entry = match[f'entry{number}']
    return entry['registration_id'] if entry else None


# --- the knockout plays through ----------------------------------------------------------------------------

@pytest.mark.parametrize('n', [4, 6, 8, 11, 16])
def test_a_knockout_plays_through_to_a_champion(client, people, n):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, n)
    rounds = len(draw_of(client, headers, tournament, category)['knockout']['rounds'])
    assert category_status(category['id']) == 'published'

    for number in range(1, rounds + 1):
        play_round(client, headers, tournament, category, number)
        if number == 1:
            assert category_status(category['id']) == ('finished' if rounds == 1 else 'knockout_stage')

    draw = draw_of(client, headers, tournament, category)
    matches = draw_matches(draw, 'knockout')
    final = knockout_round(draw, rounds)[0]
    assert final['status'] == 'completed' and final['winner_entry_id'] and category_status(category['id']) == 'finished'
    assert len([m for m in matches if m['outcome'] != 'bye']) == n - 1  # every other entry lost exactly once
    assert all(m['status'] == 'completed' for m in matches)
    assert audit_actions(tournament['id']).count('result_recorded') == n - 1


def test_winners_move_into_the_next_match_as_they_are_recorded(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 8)
    quarters = knockout_round(draw_of(client, headers, tournament, category), 1)
    response = play(client, headers, tournament, quarters[0], side=2)
    assert response.status_code == 200

    body = response.get_json()
    semis = knockout_round(body['draw'], 2)
    assert slot(semis[0], 1) == quarters[0]['entry2']['registration_id'] and semis[0]['entry1_source'] is None
    assert semis[0]['entry2'] is None and semis[0]['entry2_source'] == 'Vencedor das quartas 2'
    assert 'standings' not in body and body['category']['status'] == 'knockout_stage'
    played = find_match(body['draw'], quarters[0]['id'])
    assert (played['status'], played['outcome'], played['score'], played['winner_entry_id']) == (
        'completed', 'normal', '4-6, 3-6', quarters[0]['entry2']['registration_id'])


# --- what the endpoint refuses ---------------------------------------------------------------------------------

ROUTES = [
    ('PUT', '/api/admin/tournaments/1/matches/1/result'), ('PATCH', '/api/admin/tournaments/1/matches/1/result'),
    ('DELETE', '/api/admin/tournaments/1/matches/1/result'), ('GET', '/api/admin/tournaments/1/categories/1/standings'),
    ('PUT', '/api/admin/tournaments/1/groups/1/tiebreak'),
]


@pytest.mark.parametrize('method,path', ROUTES)
def test_result_routes_are_admin_only(client, people, method, path):
    assert client.open(path, method=method, json={}).status_code == 401
    for person in (people.plain, people.member):
        assert client.open(path, method=method, json={}, headers=person.headers).status_code == 403


def test_results_need_a_started_tournament_and_a_published_draw(client, people):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(client, headers, 4)
    generate_draw(client, headers, tournament, category)
    match = draw_matches(draw_of(client, headers, tournament, category))[0]
    assert play(client, headers, tournament, match).get_json()['code'] == 'tournament_not_started'

    other = create_category(client, headers, tournament['id'], 'Outra', min_entries=2)
    for n in range(2):
        add_registration(other['id'], f'o{n}')
    generate_draw(client, headers, tournament, other)  # drawn, never published
    client.post(draw_url(tournament, category, '/publish'), headers=headers)
    set_status(client, headers, tournament['id'], 'in_progress')
    other_match = draw_matches(draw_of(client, headers, tournament, other))[0]
    refused = play(client, headers, tournament, other_match)
    assert refused.status_code == 409 and refused.get_json()['code'] == 'draw_not_published'
    assert play(client, headers, tournament, match).status_code == 200


def test_byes_matches_not_ready_and_foreign_matches_are_refused(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 6, seeds=2)
    draw = draw_of(client, headers, tournament, category)
    bye = next(m for m in draw_matches(draw) if m['outcome'] == 'bye')
    assert client.put(result_url(tournament, bye), json={'winner_registration_id': 1, 'score': '6-0, 6-0'}, headers=headers).get_json()['code'] == 'bye_match'

    final = knockout_round(draw, 3)[0]
    not_ready = client.put(result_url(tournament, final), json={'winner_registration_id': 1, 'score': '6-0, 6-0'}, headers=headers)
    assert not_ready.status_code == 409 and not_ready.get_json()['code'] == 'match_not_ready'

    other = create_tournament(client, headers, 'Test Tourn Elsewhere')
    assert client.put(result_url(other, final), json={}, headers=headers).status_code == 404
    assert client.put(f"/api/admin/tournaments/{tournament['id']}/matches/999999/result", json={}, headers=headers).status_code == 404


@pytest.mark.parametrize('state', ['finished', 'cancelled'])
def test_a_closed_tournament_takes_no_more_results(client, people, state):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4)
    match = draw_matches(draw_of(client, headers, tournament, category))[0]
    sql('UPDATE tournaments SET status = %s WHERE id = %s', (state, tournament['id']))
    assert play(client, headers, tournament, match).get_json()['code'] == 'tournament_locked'


def first_ready(client, headers, tournament, category):
    return next(m for m in draw_matches(draw_of(client, headers, tournament, category)) if m['entry1'] and m['entry2'] and m['status'] == 'pending')


@pytest.mark.parametrize('payload,code', [
    ({'outcome': 'armageddon'}, None),
    ({'score': '6-4, 6-3'}, None),                                                  # no winner
    ({'winner_registration_id': 999999, 'score': '6-4, 6-3'}, None),                # not in this match
    ({'winner_registration_id': 'first'}, None),                                    # no score
    ({'winner_registration_id': 'first', 'score': ''}, None),
    ({'winner_registration_id': 'first', 'score': '6-5, 6-4'}, 'invalid_score'),     # a set that cannot end
    ({'winner_registration_id': 'first', 'score': '6-4'}, 'invalid_score'),          # one set in a best-of-3
    ({'winner_registration_id': 'first', 'score': '6-4, 6-3, 10-8'}, 'invalid_score'),
    ({'winner_registration_id': 'first', 'score': '6-4, 3-6, 7-5'}, 'invalid_score'),
    ({'winner_registration_id': 'second', 'score': '6-4, 6-3'}, 'winner_mismatch'),  # score is from the first player's side
    ({'winner_registration_id': 'first', 'score': '6-4, 6-3', 'played_at': 'ontem'}, None),
    ({'winner_registration_id': 'first', 'score': '6-4, 6-3', 'played_at': '2099-01-10T10:00:00+00:00'}, None),
    ({'winner_registration_id': 'first', 'score': '6-4, 6-3', 'played_at': 20990110}, None),
    ({'outcome': 'retired', 'winner_registration_id': 'first', 'score': '6-4, 6-3'}, 'invalid_score'),  # already decided
    ({'outcome': 'retired', 'winner_registration_id': 'first', 'score': ''}, None),
])
def test_invalid_results_are_rejected_and_change_nothing(client, people, payload, code):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4)
    match = first_ready(client, headers, tournament, category)
    ids = {'first': match['entry1']['registration_id'], 'second': match['entry2']['registration_id']}
    payload = {key: ids.get(value, value) for key, value in payload.items()}
    response = client.put(result_url(tournament, match), json=payload, headers=headers)
    assert response.status_code == 400, response.get_json()
    if code:
        assert response.get_json()['code'] == code
    assert row_match(match['id'])['status'] == 'pending'
    assert audit_actions(tournament['id']).count('result_recorded') == 0


def test_the_date_defaults_to_today_and_can_be_given(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4)
    first, second = draw_matches(draw_of(client, headers, tournament, category), 'knockout')[:2]
    default = play(client, headers, tournament, first).get_json()['draw']
    assert find_match(default, first['id'])['played_at'] is not None
    given = play(client, headers, tournament, second, played_at='2099-03-04').get_json()['draw']
    assert find_match(given, second['id'])['played_at'].startswith('2099-03-04')


def test_a_match_that_already_has_a_result_is_not_overwritten(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4)
    match = first_ready(client, headers, tournament, category)
    assert play(client, headers, tournament, match).status_code == 200
    again = play(client, headers, tournament, match, side=2)
    assert again.status_code == 409 and again.get_json()['code'] == 'result_exists'


# --- walkovers, retirements and double walkovers ---------------------------------------------------------------------

def test_a_walkover_and_a_retirement_advance_the_winner(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4)
    first, second = knockout_round(draw_of(client, headers, tournament, category), 1)

    walkover = play(client, headers, tournament, first, side=2, outcome='wo', score='ignored')
    assert walkover.status_code == 200
    retired = play(client, headers, tournament, second, side=1, outcome='retired', score='6-4, 2-1')
    assert retired.status_code == 200

    draw = retired.get_json()['draw']
    assert (find_match(draw, first['id'])['outcome'], find_match(draw, first['id'])['score']) == ('wo', 'W.O.')
    assert (find_match(draw, second['id'])['outcome'], find_match(draw, second['id'])['score']) == ('retired', '6-4, 2-1 ret.')
    final = knockout_round(draw, 2)[0]
    assert slot(final, 1) == first['entry2']['registration_id'] and slot(final, 2) == second['entry1']['registration_id']


def test_a_double_walkover_gives_the_opponent_a_bye(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 8)
    quarters = knockout_round(draw_of(client, headers, tournament, category), 1)

    void = client.put(result_url(tournament, quarters[0]), json={'outcome': 'double_wo'}, headers=headers)
    assert void.status_code == 200
    semis = knockout_round(void.get_json()['draw'], 2)
    assert semis[0]['entry1'] is None and semis[0]['entry1_source'] == results_svc.VOID_LABEL and semis[0]['status'] == 'pending'

    advanced = play(client, headers, tournament, quarters[1], side=1).get_json()['draw']
    semi = knockout_round(advanced, 2)[0]
    winner = quarters[1]['entry1']['registration_id']
    assert (semi['status'], semi['outcome'], semi['winner_entry_id']) == ('completed', 'bye', winner)
    assert slot(knockout_round(advanced, 3)[0], 1) == winner
    assert row_match(semi['id'])['result_by'] is None  # automatic


def test_two_double_walkovers_leave_the_final_to_the_other_semifinal(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 8)
    quarters = knockout_round(draw_of(client, headers, tournament, category), 1)
    for match in quarters[:2]:
        assert client.put(result_url(tournament, match), json={'outcome': 'double_wo'}, headers=headers).status_code == 200
    draw = draw_of(client, headers, tournament, category)
    semi = knockout_round(draw, 2)[0]
    assert (semi['status'], semi['outcome'], semi['winner_entry_id']) == ('completed', 'double_wo', None)
    assert knockout_round(draw, 3)[0]['entry1_source'] == results_svc.VOID_LABEL

    for match in quarters[2:]:
        play(client, headers, tournament, match)
    other_semi = knockout_round(draw_of(client, headers, tournament, category), 2)[1]
    play(client, headers, tournament, other_semi)
    final = knockout_round(draw_of(client, headers, tournament, category), 3)[0]
    assert (final['status'], final['outcome'], final['winner_entry_id']) == ('completed', 'bye', other_semi['entry1']['registration_id'])
    assert category_status(category['id']) == 'finished'


# --- correcting and annulling ----------------------------------------------------------------------------------------

def patch(client, headers, tournament, match, **payload):
    return client.patch(result_url(tournament, match), json=payload, headers=headers)


def test_a_result_can_be_corrected_until_the_next_match_is_played(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 8)
    quarters = knockout_round(draw_of(client, headers, tournament, category), 1)
    first, second = quarters[0], quarters[1]
    play(client, headers, tournament, first, side=1)

    corrected = patch(client, headers, tournament, first, winner_registration_id=first['entry2']['registration_id'], score='4-6, 4-6')
    assert corrected.status_code == 200
    semi = knockout_round(corrected.get_json()['draw'], 2)[0]
    assert slot(semi, 1) == first['entry2']['registration_id']  # the winner changed, so did the semifinal
    assert find_match(corrected.get_json()['draw'], first['id'])['score'] == '4-6, 4-6'

    play(client, headers, tournament, second, side=1)
    semi = knockout_round(draw_of(client, headers, tournament, category), 2)[0]
    assert play(client, headers, tournament, semi, side=1).status_code == 200

    blocked = patch(client, headers, tournament, first, winner_registration_id=first['entry1']['registration_id'], score='6-0, 6-0')
    assert blocked.status_code == 409 and blocked.get_json()['code'] == 'next_match_played'
    assert client.delete(result_url(tournament, first), headers=headers).get_json()['code'] == 'next_match_played'

    annulled = client.delete(result_url(tournament, semi), headers=headers)
    assert annulled.status_code == 200
    final = knockout_round(annulled.get_json()['draw'], 3)[0]
    assert final['entry1'] is None and final['entry1_source'] == 'Vencedor da semifinal 1'  # the label is back
    assert patch(client, headers, tournament, first, winner_registration_id=first['entry1']['registration_id'], score='6-0, 6-0').status_code == 200
    assert {'result_recorded', 'result_corrected', 'result_annulled'} <= set(audit_actions(tournament['id']))


def test_correcting_needs_a_result_and_recording_needs_none(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4)
    match = first_ready(client, headers, tournament, category)
    assert patch(client, headers, tournament, match, winner_registration_id=match['entry1']['registration_id'], score='6-0, 6-0').get_json()['code'] == 'no_result'
    assert client.delete(result_url(tournament, match), headers=headers).get_json()['code'] == 'no_result'


def test_a_correction_that_is_invalid_changes_nothing(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4)
    match = first_ready(client, headers, tournament, category)
    play(client, headers, tournament, match)
    bad = patch(client, headers, tournament, match, winner_registration_id=match['entry1']['registration_id'], score='6-5, 6-4')
    assert bad.status_code == 400
    kept = row_match(match['id'])
    assert (kept['status'], kept['score'], kept['winner_entry_id']) == ('completed', '6-4, 6-3', match['entry1']['registration_id'])


def test_corrections_unwind_the_automatic_byes_that_depended_on_them(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 8)
    quarters = knockout_round(draw_of(client, headers, tournament, category), 1)
    client.put(result_url(tournament, quarters[0]), json={'outcome': 'double_wo'}, headers=headers)
    play(client, headers, tournament, quarters[1], side=1)  # the opponent advances by an automatic bye
    first_winner, second_winner = quarters[1]['entry1']['registration_id'], quarters[1]['entry2']['registration_id']
    final = lambda: knockout_round(draw_of(client, headers, tournament, category), 3)[0]  # noqa: E731
    assert slot(final(), 1) == first_winner

    patch(client, headers, tournament, quarters[1], winner_registration_id=second_winner, score='4-6, 4-6')
    assert slot(final(), 1) == second_winner  # the bye was undone and given again to the new winner

    annulled = client.delete(result_url(tournament, quarters[1]), headers=headers)
    assert annulled.status_code == 200
    semi = knockout_round(annulled.get_json()['draw'], 2)[0]
    assert semi['status'] == 'pending' and semi['outcome'] is None
    assert final()['entry1'] is None and final()['entry1_source'] == 'Vencedor da semifinal 1'

    # Turning the double walkover into a played match removes the void and the bye logic with it
    play(client, headers, tournament, quarters[1], side=1)
    patch(client, headers, tournament, quarters[0], winner_registration_id=quarters[0]['entry1']['registration_id'], score='6-0, 6-0')
    semi = knockout_round(draw_of(client, headers, tournament, category), 2)[0]
    assert semi['status'] == 'pending' and slot(semi, 1) == quarters[0]['entry1']['registration_id'] and slot(semi, 2) == first_winner


def test_automatic_results_cannot_be_edited(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4)
    first = knockout_round(draw_of(client, headers, tournament, category), 1)[0]
    patch_registration(client, headers, tournament['id'], first['entry1']['registration_id'], status='withdrawn')
    walkover = row_match(first['id'])
    assert (walkover['outcome'], walkover['result_by']) == ('wo', None)
    refused = patch(client, headers, tournament, first, winner_registration_id=first['entry1']['registration_id'], score='6-0, 6-0')
    assert refused.status_code == 409 and refused.get_json()['code'] == 'automatic_result'


# --- concurrency and atomicity ---------------------------------------------------------------------------------------------

def test_two_simultaneous_submissions_of_one_result_only_one_wins(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4)
    match = first_ready(client, headers, tournament, category)
    barrier, codes = threading.Barrier(2), []

    def submit():
        with app.test_client() as other:
            barrier.wait()
            codes.append(play(other, headers, tournament, match).status_code)

    threads = [threading.Thread(target=submit) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sorted(codes) == [200, 409]
    assert audit_actions(tournament['id']).count('result_recorded') == 1


def test_a_failure_in_the_middle_leaves_nothing_behind(client, people, monkeypatch):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 8)
    quarter = knockout_round(draw_of(client, headers, tournament, category), 1)[0]

    def explode(*args, **kwargs):
        raise RuntimeError('boom')

    monkeypatch.setattr(results_svc, '_sync_statistics', explode)
    assert play(client, headers, tournament, quarter).status_code == 500
    monkeypatch.undo()

    assert row_match(quarter['id'])['status'] == 'pending'
    semi = knockout_round(draw_of(client, headers, tournament, category), 2)[0]
    assert semi['entry1'] is None  # the winner was never moved on
    assert audit_actions(tournament['id']).count('result_recorded') == 0
    assert category_status(category['id']) == 'published'
    assert play(client, headers, tournament, quarter).status_code == 200  # and the match can still be played


# --- groups ----------------------------------------------------------------------------------------------------------------------

def test_the_group_winners_enter_the_knockout_when_their_group_ends(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 8, **GROUPS)
    draw = draw_of(client, headers, tournament, category)
    group_a, group_b = draw['groups']
    semis = knockout_round(draw, 1)  # four teams: the knockout starts at the semifinals
    assert [m['entry1_source'] for m in semis] and all(m['entry1'] is None for m in semis)

    for number, match in enumerate(group_a['matches'], start=1):
        assert play(client, headers, tournament, match, score=varied_score(number)).status_code == 200
        if number == 1:
            assert category_status(category['id']) == 'group_stage'
    table = standings(client, headers, tournament, category)['groups'][0]
    assert table['complete'] and table['confirmed']
    by_position = {row['position']: row['registration_id'] for row in table['rows']}
    filled = {m[f'entry{s}_source']: slot(m, s) for m in knockout_round(draw_of(client, headers, tournament, category), 1) for s in (1, 2)}
    assert filled['1º Grupo A'] == by_position[1] and filled['2º Grupo A'] == by_position[2]
    assert filled['1º Grupo B'] is None and filled['2º Grupo B'] is None  # group B is still being played
    assert category_status(category['id']) == 'group_stage'

    play_groups(client, headers, tournament, category)
    table_b = standings(client, headers, tournament, category)['groups'][1]
    by_position_b = {row['position']: row['registration_id'] for row in table_b['rows']}
    filled = {m[f'entry{s}_source']: slot(m, s) for m in knockout_round(draw_of(client, headers, tournament, category), 1) for s in (1, 2)}
    assert filled['1º Grupo B'] == by_position_b[1] and filled['2º Grupo B'] == by_position_b[2]
    assert category_status(category['id']) == 'knockout_stage'

    play_round(client, headers, tournament, category, 1)
    play_round(client, headers, tournament, category, 2)
    assert category_status(category['id']) == 'finished'


def cycle(client, headers, tournament, group):
    """Make the three players of a group beat each other in a circle with identical scores."""
    members = [e['registration_id'] for e in group['entries']]
    beats = {members[0]: members[1], members[1]: members[2], members[2]: members[0]}
    for match in group['matches']:
        first = match['entry1']['registration_id']
        winner_is_first = beats[first] == match['entry2']['registration_id']
        response = play(client, headers, tournament, match, side=1 if winner_is_first else 2,
                        score='6-4, 6-4' if winner_is_first else '4-6, 4-6')
        assert response.status_code == 200, response.get_json()
    return members


def test_a_tie_nothing_can_break_waits_for_the_organizer(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 6, draw_format='groups_knockout', group_target_size=3, qualifiers_per_group=1)
    draw = draw_of(client, headers, tournament, category)
    group_a, group_b = draw['groups']
    assert client.put(f"/api/admin/tournaments/{tournament['id']}/groups/{group_a['id']}/tiebreak",
                      json={'order': [e['registration_id'] for e in group_a['entries']]}, headers=headers).get_json()['code'] == 'group_not_complete'

    members = cycle(client, headers, tournament, group_a)
    for match in group_b['matches']:
        play(client, headers, tournament, match, score='6-0, 6-0')

    table = standings(client, headers, tournament, category)['groups'][0]
    assert (table['complete'], table['blocked'], table['confirmed']) == (True, True, False)
    assert {row['state'] for row in table['rows']} == {'tie_pending'} and all(row['tied'] for row in table['rows'])
    assert [sorted(e['registration_id'] for e in tie['entries']) for tie in table['ties']] == [sorted(members)]
    final = knockout_round(draw_of(client, headers, tournament, category), 1)[0]
    assert final['entry1_source'] == '1º Grupo A' and final['entry1'] is None  # nobody qualified yet
    assert category_status(category['id']) == 'group_stage'

    url = f"/api/admin/tournaments/{tournament['id']}/groups/{group_a['id']}/tiebreak"
    assert client.put(url, json={'order': members[:2]}, headers=headers).get_json()['code'] == 'not_a_tie'
    assert client.put(url, json={'order': [members[0], members[0], members[1]]}, headers=headers).status_code == 400
    assert client.put(url, json={'order': 'x'}, headers=headers).status_code == 400

    decided = client.put(url, json={'order': [members[1], members[0], members[2]]}, headers=headers)
    assert decided.status_code == 200
    table = decided.get_json()['groups'][0]
    assert (table['blocked'], table['confirmed']) == (False, True)
    assert [row['registration_id'] for row in table['rows']] == [members[1], members[0], members[2]]
    assert [row['state'] for row in table['rows']] == ['qualified', 'eliminated', 'eliminated']
    final = knockout_round(draw_of(client, headers, tournament, category), 1)[0]
    assert slot(final, 1) == members[1]
    assert category_status(category['id']) == 'knockout_stage' and 'tiebreak_decided' in audit_actions(tournament['id'])

    # Correcting a result drops the decision, and flipping one edge of the cycle ends the tie anyway
    match = group_a['matches'][0]
    flipped_side = 2 if row_match(match['id'])['winner_entry_id'] == match['entry1']['registration_id'] else 1
    corrected = patch(client, headers, tournament, match, winner_registration_id=match[f'entry{flipped_side}']['registration_id'],
                      score='6-0, 6-0' if flipped_side == 1 else '0-6, 0-6')
    assert corrected.status_code == 200
    assert all(r['manual_rank'] is None for r in sql('SELECT manual_rank FROM tournament_group_entries WHERE group_id = %s', (group_a['id'],)))
    table = standings(client, headers, tournament, category)['groups'][0]
    assert table['confirmed'] and not any(row['tied'] for row in table['rows'])
    final = knockout_round(draw_of(client, headers, tournament, category), 1)[0]
    assert slot(final, 1) == table['rows'][0]['registration_id']


def test_group_results_freeze_once_the_knockout_is_played(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 8, **GROUPS)
    play_groups(client, headers, tournament, category)
    group_match = draw_of(client, headers, tournament, category)['groups'][0]['matches'][0]

    corrected = patch(client, headers, tournament, group_match, winner_registration_id=group_match['entry1']['registration_id'], score='6-1, 6-1')
    assert corrected.status_code == 200  # nothing in the knockout has been played yet

    play_round(client, headers, tournament, category, 1)
    blocked = patch(client, headers, tournament, group_match, winner_registration_id=group_match['entry1']['registration_id'], score='6-2, 6-2')
    assert blocked.status_code == 409 and blocked.get_json()['code'] == 'next_match_played'
    assert client.delete(result_url(tournament, group_match), headers=headers).get_json()['code'] == 'next_match_played'


def test_qualifiers_that_do_not_fill_a_bracket_are_drawn_when_the_groups_end(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 9, draw_format='groups_knockout', group_target_size=3, qualifiers_per_group=2)
    draw = draw_of(client, headers, tournament, category)
    assert draw['knockout'] is None and draw['knockout_pending'] is True
    groups = draw['groups']

    for group in groups[:2]:
        for match in group['matches']:
            play(client, headers, tournament, match, score='6-0, 6-0')
    draw = draw_of(client, headers, tournament, category)
    assert draw['knockout'] is None and draw['knockout_pending'] is True  # the third group is still playing

    for match in groups[2]['matches']:
        play(client, headers, tournament, match, score='6-0, 6-0')
    draw = draw_of(client, headers, tournament, category)
    assert draw['knockout_pending'] is False and draw['knockout']['size'] == 8
    quarters = knockout_round(draw, 1)
    assert sum(1 for m in quarters if m['outcome'] == 'bye') == 2

    tables = standings(client, headers, tournament, category)['groups']
    qualifiers = {row['registration_id'] for table in tables for row in table['rows'] if row['position'] <= 2}
    placed = {slot(m, s) for m in quarters for s in (1, 2)} - {None}
    assert placed == qualifiers and len(qualifiers) == 6
    winners = {table['name']: table['rows'][0]['registration_id'] for table in tables}
    byes = {m['winner_entry_id'] for m in quarters if m['outcome'] == 'bye'}
    assert byes == {winners['A'], winners['B']}  # identical campaigns: ties go to the group order
    assert category_status(category['id']) == 'knockout_stage'
    built = sql("SELECT payload FROM tournament_audit_log WHERE tournament_id = %s AND action = 'knockout_built'", (tournament['id'],))
    assert len(built) == 1 and built[0]['payload']['fingerprint']['winners'][:2] == [winners['A'], winners['B']]

    # Annulling a group result takes the knockout phase back, and recording it again draws it again
    last = groups[2]['matches'][-1]
    annulled = client.delete(result_url(tournament, last), headers=headers)
    assert annulled.status_code == 200 and annulled.get_json()['draw']['knockout'] is None
    assert category_status(category['id']) == 'group_stage'
    assert play(client, headers, tournament, last, score='6-0, 6-0').status_code == 200
    assert draw_of(client, headers, tournament, category)['knockout']['size'] == 8
    assert len(sql("SELECT 1 FROM tournament_audit_log WHERE tournament_id = %s AND action = 'knockout_built'", (tournament['id'],))) == 2

    play_round(client, headers, tournament, category, 1)
    group_match = groups[0]['matches'][0]
    blocked = patch(client, headers, tournament, group_match, winner_registration_id=group_match['entry1']['registration_id'], score='6-1, 6-1')
    assert blocked.status_code == 409 and blocked.get_json()['code'] == 'next_match_played'


def test_a_round_robin_category_finishes_with_its_last_match(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4, draw_format='round_robin')
    matches = draw_matches(draw_of(client, headers, tournament, category))
    assert len(matches) == 6
    for number, match in enumerate(matches, start=1):  # the lower registration wins: a strict 1st to 4th, no ties
        first_wins = match['entry1']['registration_id'] < match['entry2']['registration_id']
        response = play(client, headers, tournament, match, side=1 if first_wins else 2)
        assert response.status_code == 200
        assert category_status(category['id']) == ('group_stage' if number < 6 else 'finished')
    table = standings(client, headers, tournament, category)
    assert table['qualifiers_per_group'] == 1 and table['groups'][0]['confirmed'] is True
    rows = response.get_json()['standings'][0]['rows']
    assert [row['position'] for row in rows] == [1, 2, 3, 4] and not any(row['tied'] for row in rows)
    assert rows[0]['state'] == 'qualified'


def test_a_round_robin_tie_for_a_lower_place_waits_for_the_organizer(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4, draw_format='round_robin')
    group = draw_of(client, headers, tournament, category)['groups'][0]
    champion, *others = sorted({e['registration_id'] for m in group['matches'] for e in (m['entry1'], m['entry2'])})
    beats = {others[0]: others[1], others[1]: others[2], others[2]: others[0]}  # the other three chase each other in a circle
    for match in group['matches']:
        first, second = match['entry1']['registration_id'], match['entry2']['registration_id']
        first_wins = first == champion or (second != champion and beats[first] == second)
        assert play(client, headers, tournament, match, side=1 if first_wins else 2,
                    score='6-4, 6-4' if first_wins else '4-6, 4-6').status_code == 200

    table = standings(client, headers, tournament, category)['groups'][0]
    assert (table['complete'], table['blocked'], table['confirmed']) == (True, True, False)
    assert [(row['registration_id'], row['state']) for row in table['rows'][:1]] == [(champion, 'qualified')]
    assert {row['state'] for row in table['rows'][1:]} == {'tie_pending'} and all(row['tied'] for row in table['rows'][1:])
    assert category_status(category['id']) == 'group_stage'

    url = f"/api/admin/tournaments/{tournament['id']}/groups/{group['id']}/tiebreak"
    decided = client.put(url, json={'order': [others[2], others[0], others[1]]}, headers=headers)
    assert decided.status_code == 200
    rows = decided.get_json()['groups'][0]['rows']
    assert [row['registration_id'] for row in rows] == [champion, others[2], others[0], others[1]]
    assert [row['position'] for row in rows] == [1, 2, 3, 4] and not any(row['tied'] for row in rows)
    assert category_status(category['id']) == 'finished'


def test_standings_of_a_knockout_category_are_empty(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4)
    assert standings(client, headers, tournament, category)['groups'] == []
    assert client.get(f"/api/admin/tournaments/{tournament['id']}/categories/999999/standings", headers=headers).status_code == 404


def test_other_formats_validate_their_own_scores(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4, tournament={'match_format': 'pro_set_8'})
    match = first_ready(client, headers, tournament, category)
    assert play(client, headers, tournament, match, score='6-4, 6-3').status_code == 400
    assert play(client, headers, tournament, match, score='6-4').status_code == 400
    assert play(client, headers, tournament, match, score='8-6').status_code == 200


def test_the_match_tiebreak_points_follow_the_tournament(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4, tournament={'match_tiebreak_points': 7})
    first, second = knockout_round(draw_of(client, headers, tournament, category), 1)
    assert play(client, headers, tournament, first, score='6-4, 3-6, 7-5').status_code == 200
    assert play(client, headers, tournament, second, score='6-4, 3-6, 10-8').status_code == 200
    assert play(client, headers, tournament, knockout_round(draw_of(client, headers, tournament, category), 2)[0], score='6-4, 3-6, 6-4').status_code == 400


# --- withdrawal ------------------------------------------------------------------------------------------------------------------------

def test_a_withdrawal_turns_the_rest_of_the_group_into_walkovers(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 8, **GROUPS)
    group = draw_of(client, headers, tournament, category)['groups'][0]
    leaver = group['entries'][0]['registration_id']
    mine = [m for m in group['matches'] if leaver in (slot(m, 1), slot(m, 2))]
    assert len(mine) == 3
    played = mine[0]
    play(client, headers, tournament, played, side=1 if slot(played, 1) == leaver else 2,
         score='6-0, 6-0' if slot(played, 1) == leaver else '0-6, 0-6')

    assert patch_registration(client, headers, tournament['id'], leaver, status='withdrawn').status_code == 200
    draw = draw_of(client, headers, tournament, category)
    for match in mine[1:]:
        done = find_match(draw, match['id'])
        opponent = slot(match, 2) if slot(match, 1) == leaver else slot(match, 1)
        assert (done['status'], done['outcome'], done['winner_entry_id']) == ('completed', 'wo', opponent)
        assert row_match(match['id'])['result_by'] is None
    assert find_match(draw, played['id'])['outcome'] == 'normal'  # what was played stays

    row = next(r for r in standings(client, headers, tournament, category)['groups'][0]['rows'] if r['registration_id'] == leaver)
    assert (row['wins'], row['losses'], row['played'], row['played_on_court']) == (1, 2, 3, 1)
    assert 'withdrawal_applied' in audit_actions(tournament['id'])


def test_a_withdrawal_in_the_knockout_gives_the_opponent_the_win(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4)
    first = knockout_round(draw_of(client, headers, tournament, category), 1)[0]
    leaver, opponent = first['entry1']['registration_id'], first['entry2']['registration_id']
    assert patch_registration(client, headers, tournament['id'], leaver, status='withdrawn').status_code == 200
    draw = draw_of(client, headers, tournament, category)
    assert (find_match(draw, first['id'])['outcome'], find_match(draw, first['id'])['winner_entry_id']) == ('wo', opponent)
    assert slot(knockout_round(draw, 2)[0], 1) == opponent


def test_a_withdrawal_waits_for_an_opponent_that_is_not_known_yet(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 8)
    quarters = knockout_round(draw_of(client, headers, tournament, category), 1)
    play(client, headers, tournament, quarters[0], side=1)
    leaver = quarters[0]['entry1']['registration_id']

    patch_registration(client, headers, tournament['id'], leaver, status='withdrawn')
    semi = knockout_round(draw_of(client, headers, tournament, category), 2)[0]
    assert semi['status'] == 'pending' and slot(semi, 1) == leaver  # the opponent is still unknown

    after = play(client, headers, tournament, quarters[1], side=2).get_json()['draw']
    semi = knockout_round(after, 2)[0]
    winner = quarters[1]['entry2']['registration_id']
    assert (semi['status'], semi['outcome'], semi['winner_entry_id']) == ('completed', 'wo', winner)
    assert slot(knockout_round(after, 3)[0], 1) == winner


def test_a_draw_can_be_redone_after_a_withdrawal_but_not_after_a_typed_result(client, people):
    headers = people.admin.headers
    tournament, category, ids = closed_tournament(client, headers, 8, **GROUPS)
    generate_draw(client, headers, tournament, category)
    client.post(draw_url(tournament, category, '/publish'), headers=headers)
    assert patch_registration(client, headers, tournament['id'], ids[0], status='withdrawn').status_code == 200
    assert any(m['outcome'] == 'wo' for m in draw_matches(draw_of(client, headers, tournament, category)))

    assert client.delete(draw_url(tournament, category), headers=headers).status_code == 200
    assert category_status(category['id']) == 'awaiting_draw'
    redrawn = generate_draw(client, headers, tournament, category)
    assert sum(len(g['entries']) for g in redrawn['draw']['groups']) == 7  # the leaver is out


def test_two_withdrawn_players_in_one_match_double_walkover_it(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4)
    first = knockout_round(draw_of(client, headers, tournament, category), 1)[0]
    one, two = first['entry1']['registration_id'], first['entry2']['registration_id']
    sql("UPDATE tournament_registrations SET status = 'withdrawn' WHERE id = ANY(%s)", ([one, two],))
    patch_registration(client, headers, tournament['id'], one, status='withdrawn')  # nothing to change: it just re-applies the effects

    draw = draw_of(client, headers, tournament, category)
    done = find_match(draw, first['id'])
    assert (done['status'], done['outcome'], done['winner_entry_id']) == ('completed', 'double_wo', None)
    assert knockout_round(draw, 2)[0]['entry1_source'] == results_svc.VOID_LABEL


def test_two_withdrawn_players_double_walkover_their_group_match(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 8, **GROUPS)
    group = draw_of(client, headers, tournament, category)['groups'][0]
    one, two = group['entries'][0]['registration_id'], group['entries'][1]['registration_id']
    sql("UPDATE tournament_registrations SET status = 'withdrawn' WHERE id = ANY(%s)", ([one, two],))
    patch_registration(client, headers, tournament['id'], one, status='withdrawn')
    patch_registration(client, headers, tournament['id'], two, status='withdrawn')

    draw = draw_of(client, headers, tournament, category)
    between = next(m for m in group['matches'] if {slot(m, 1), slot(m, 2)} == {one, two})
    assert find_match(draw, between['id'])['outcome'] == 'double_wo'
    others = [m for m in group['matches'] if m is not between and {one, two} & {slot(m, 1), slot(m, 2)}]
    assert len(others) == 4 and all(find_match(draw, m['id'])['outcome'] == 'wo' for m in others)


def test_a_group_change_takes_back_a_walkover_that_depended_on_a_qualifier(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 8, **GROUPS)
    play_groups(client, headers, tournament, category)
    semi = knockout_round(draw_of(client, headers, tournament, category), 1)[0]
    victim_slot = 1 if semi['entry1'] else 2
    victim, opponent = slot(semi, victim_slot), slot(semi, 3 - victim_slot)
    group_name = semi[f'entry{victim_slot}_source'][-1]

    patch_registration(client, headers, tournament['id'], victim, status='withdrawn')
    draw = draw_of(client, headers, tournament, category)
    assert (find_match(draw, semi['id'])['outcome'], find_match(draw, semi['id'])['winner_entry_id']) == ('wo', opponent)

    group = next(g for g in draw['groups'] if g['name'] == group_name)
    annulled = client.delete(result_url(tournament, group['matches'][0]), headers=headers)  # automatic results do not block this
    assert annulled.status_code == 200
    draw = annulled.get_json()['draw']
    reopened = find_match(draw, semi['id'])
    assert reopened['status'] == 'pending' and reopened['outcome'] is None
    assert slot(reopened, victim_slot) is None  # the group is open again, so nobody holds its slots
    assert knockout_round(draw, 2)[0]['entry1'] is None or knockout_round(draw, 2)[0]['entry2'] is None


def test_the_write_is_guarded_against_a_result_that_appeared_meanwhile(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4)
    match = first_ready(client, headers, tournament, category)
    assert play(client, headers, tournament, match).status_code == 200

    stale = {'id': match['id'], 'stage': 'knockout', 'group_id': None}  # read as pending before somebody else wrote
    parsed = {'outcome': 'normal', 'winner': match['entry2']['registration_id'], 'score': '4-6, 4-6', 'played_at': None}
    with get_db() as db, pytest.raises(TournamentError) as raised:
        results_svc._apply(db, stale, parsed, people.admin.id)
    assert raised.value.code == 'result_exists'
    assert row_match(match['id'])['winner_entry_id'] == match['entry1']['registration_id']

    # Settling a match that is already finished (a cascade can reach one) changes nothing
    with get_db() as db:
        results_svc._settle(db, match['id'])
        db.commit()
    assert row_match(match['id'])['status'] == 'completed'


def test_the_tiebreak_route_checks_its_group_and_tournament(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 6, draw_format='groups_knockout', group_target_size=3, qualifiers_per_group=1)
    group = draw_of(client, headers, tournament, category)['groups'][0]
    order = [e['registration_id'] for e in group['entries']]
    base = f"/api/admin/tournaments/{tournament['id']}/groups"
    assert client.put(f'{base}/999999/tiebreak', json={'order': order}, headers=headers).status_code == 404
    other = create_tournament(client, headers, 'Test Tourn Elsewhere')
    assert client.put(f"/api/admin/tournaments/{other['id']}/groups/{group['id']}/tiebreak", json={'order': order}, headers=headers).status_code == 404
    sql("UPDATE tournaments SET status = 'finished' WHERE id = %s", (tournament['id'],))
    assert client.put(f"{base}/{group['id']}/tiebreak", json={'order': order}, headers=headers).get_json()['code'] == 'tournament_locked'


def test_a_tie_decision_is_frozen_once_the_knockout_is_played(client, people):
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 6, draw_format='groups_knockout', group_target_size=3, qualifiers_per_group=1)
    group_a, group_b = draw_of(client, headers, tournament, category)['groups']
    members = cycle(client, headers, tournament, group_a)
    for match in group_b['matches']:
        play(client, headers, tournament, match, score='6-0, 6-0')
    url = f"/api/admin/tournaments/{tournament['id']}/groups/{group_a['id']}/tiebreak"
    assert client.put(url, json={'order': members}, headers=headers).status_code == 200

    assert play_round(client, headers, tournament, category, 1) == 1  # the final
    frozen = client.put(url, json={'order': members[::-1]}, headers=headers)
    assert frozen.status_code == 409 and frozen.get_json()['code'] == 'next_match_played'
