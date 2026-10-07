"""Tournament results feed the statistics module when a LAPEN member plays (RF-80..83)."""

from backend.tournament_support import (  # noqa: F401  (fixtures are used by name)
    add_registration, clean_db, client, create_category, create_tournament, draw_matches, draw_of, draw_url,
    generate_draw, make_user, patch_registration, people, play, result_url, set_status, sql, stats_rows,
)


def tournament_with(client, people, n, links, **category):
    """Drawn, published and started. links = {registration index: user id} for the members."""
    headers = people.admin.headers
    tournament = create_tournament(client, headers, 'Test Tourn Stats')
    made = create_category(client, headers, tournament['id'], min_entries=2, **category)
    ids = [add_registration(made['id'], f'p{i:02d}', display_name=f'Jogador {i:02d}', user_id=links.get(i)) for i in range(n)]
    for status in ('registration_open', 'registration_closed'):
        assert set_status(client, headers, tournament['id'], status).status_code == 200
    generate_draw(client, headers, tournament, made)
    assert client.post(draw_url(tournament, made, '/publish'), headers=headers).status_code == 200
    assert set_status(client, headers, tournament['id'], 'in_progress').status_code == 200
    return tournament, made, ids


def final_match(client, people, tournament, category):
    return draw_matches(draw_of(client, people.admin.headers, tournament, category), 'knockout')[0]


def test_a_member_against_a_guest_leaves_one_row(client, people):
    headers = people.admin.headers
    tournament, category, ids = tournament_with(client, people, 2, {0: people.member.id})
    match = final_match(client, people, tournament, category)
    member_side = 1 if match['entry1']['registration_id'] == ids[0] else 2

    response = play(client, headers, tournament, match, side=member_side, played_at='2099-03-04')
    assert response.status_code == 200
    (row,) = stats_rows()
    assert row['tournament_match_id'] == match['id'] and row['schedule_id'] is None and row['ranking_match_id'] is None
    assert row['match_type'] == 'Torneio' and str(row['match_date']) == '2099-03-04' and row['added_by'] == people.admin.id
    assert row['score'] == ('6-4, 6-3' if member_side == 1 else '4-6, 3-6')

    member_is_first = member_side == 1
    assert (row['player1_id'], row['player2_id']) == ((people.member.id, None) if member_is_first else (None, people.member.id))
    assert row['winner_id'] == people.member.id and row['winner_name'] == 'TTourn member'  # a member shows with the profile name
    guest_name = 'Jogador 01'
    assert {row['player1_name'], row['player2_name']} == {'TTourn member', guest_name}


def test_a_guest_who_wins_leaves_no_winner_id(client, people):
    headers = people.admin.headers
    tournament, category, ids = tournament_with(client, people, 2, {0: people.member.id})
    match = final_match(client, people, tournament, category)
    guest_side = 2 if match['entry1']['registration_id'] == ids[0] else 1
    play(client, headers, tournament, match, side=guest_side)
    (row,) = stats_rows()
    assert row['winner_id'] is None and row['winner_name'] == 'Jogador 01'


def test_two_guests_leave_nothing(client, people):
    headers = people.admin.headers
    tournament, category, _ = tournament_with(client, people, 2, {})
    assert play(client, headers, tournament, final_match(client, people, tournament, category)).status_code == 200
    assert stats_rows() == []


def test_two_members_are_both_recorded(client, people):
    headers = people.admin.headers
    other = make_user('member2', member=True, approved=True)
    tournament, category, _ = tournament_with(client, people, 2, {0: people.member.id, 1: other.id})
    match = final_match(client, people, tournament, category)
    play(client, headers, tournament, match, side=1)
    (row,) = stats_rows()
    assert {row['player1_id'], row['player2_id']} == {people.member.id, other.id}
    assert row['winner_id'] == row['player1_id']


def test_byes_and_double_walkovers_never_leave_a_row(client, people):
    headers = people.admin.headers
    members = [make_user(f'm{i}', member=True, approved=True) for i in range(3)]
    tournament, category, _ = tournament_with(client, people, 3, {i: m.id for i, m in enumerate(members)})
    draw = draw_of(client, headers, tournament, category)
    assert any(m['outcome'] == 'bye' for m in draw_matches(draw))  # created and completed with the draw
    assert stats_rows() == []

    real = next(m for m in draw_matches(draw, 'knockout') if m['status'] == 'pending' and m['entry1'] and m['entry2'])
    assert client.put(result_url(tournament, real), json={'outcome': 'double_wo'}, headers=headers).status_code == 200
    assert stats_rows() == []  # nobody played, nobody won


def test_a_walkover_is_recorded_with_the_score_wo(client, people):
    headers = people.admin.headers
    tournament, category, ids = tournament_with(client, people, 2, {0: people.member.id})
    match = final_match(client, people, tournament, category)
    play(client, headers, tournament, match, side=1, outcome='wo')
    (row,) = stats_rows()
    assert row['score'] == 'W.O.' and row['match_type'] == 'Torneio'


def test_a_retirement_keeps_its_partial_score(client, people):
    headers = people.admin.headers
    tournament, category, _ = tournament_with(client, people, 2, {0: people.member.id})
    match = final_match(client, people, tournament, category)
    play(client, headers, tournament, match, side=1, outcome='retired', score='6-4, 2-1')
    assert stats_rows()[0]['score'] == '6-4, 2-1 ret.'


def test_a_correction_updates_the_same_row_and_an_annulment_removes_it(client, people):
    headers = people.admin.headers
    tournament, category, ids = tournament_with(client, people, 2, {0: people.member.id})
    match = final_match(client, people, tournament, category)
    member_side = 1 if match['entry1']['registration_id'] == ids[0] else 2
    play(client, headers, tournament, match, side=member_side)
    (before,) = stats_rows()
    assert before['winner_id'] == people.member.id

    other_side = 2 if member_side == 1 else 1
    corrected = client.patch(result_url(tournament, match), headers=headers, json={
        'winner_registration_id': match[f'entry{other_side}']['registration_id'],
        'score': '6-3, 6-3' if other_side == 1 else '3-6, 3-6'})
    assert corrected.status_code == 200
    (after,) = stats_rows()
    assert after['id'] == before['id']  # updated in place, not duplicated
    assert after['winner_id'] is None and after['score'] in ('6-3, 6-3', '3-6, 3-6')

    assert client.patch(result_url(tournament, match), headers=headers, json={'outcome': 'double_wo'}).status_code == 200
    assert stats_rows() == []  # a double walkover is not a result
    assert client.patch(result_url(tournament, match), headers=headers, json={
        'winner_registration_id': match['entry1']['registration_id'], 'score': '6-0, 6-0'}).status_code == 200
    assert len(stats_rows()) == 1
    assert client.delete(result_url(tournament, match), headers=headers).status_code == 200
    assert stats_rows() == []


def test_a_withdrawal_walkover_is_recorded_for_a_member(client, people):
    headers = people.admin.headers
    tournament, category, ids = tournament_with(client, people, 2, {0: people.member.id})
    assert patch_registration(client, headers, tournament['id'], ids[0], status='withdrawn').status_code == 200
    (row,) = stats_rows()
    assert row['score'] == 'W.O.' and people.member.id in (row['player1_id'], row['player2_id'])
    assert row['winner_id'] is None and row['winner_name'] == 'Jogador 01' and row['added_by'] == people.admin.id


def test_the_member_sees_the_match_in_the_statistics_endpoints(client, people):
    headers = people.admin.headers
    tournament, category, ids = tournament_with(client, people, 2, {0: people.member.id})
    match = final_match(client, people, tournament, category)
    play(client, headers, tournament, match, side=1 if match['entry1']['registration_id'] == ids[0] else 2)

    player = client.get('/api/statistics/player', query_string={'player1': 'TTourn member'})
    assert player.status_code == 200
    body = player.get_json()
    assert body['total_matches'] == 1 and body['wins'] == 1
    assert body['matches'][0]['match_type'] == 'Torneio'
    general = client.get('/api/statistics/general')
    assert general.status_code == 200 and general.get_json()['match_types'].get('Torneio', 0) >= 1


def test_deleting_the_tournament_takes_its_statistics_with_it(client, people):
    headers = people.admin.headers
    tournament, category, _ = tournament_with(client, people, 2, {0: people.member.id})
    play(client, headers, tournament, final_match(client, people, tournament, category))
    assert len(stats_rows()) == 1
    sql('DELETE FROM tournaments WHERE id = %s', (tournament['id'],))
    assert stats_rows() == []
