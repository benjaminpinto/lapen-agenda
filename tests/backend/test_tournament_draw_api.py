"""Draw endpoints: preview, swap, publish and undo, on top of the real database."""
import random

import pytest
from backend.tournament_support import (  # noqa: F401  (fixtures are used by name)
    add_registration, audit_actions, clean_db, client, closed_tournament, create_category, create_tournament,
    patch_registration, people, set_status, sql,
)
from backend.tournament_support import draw_url as url
from backend.tournament_support import generate_draw as generate

from src.services import tournament_draw as draw
from src.services import tournament_draw_service as draw_svc


def db_matches(category_id, stage=None):
    return sql('SELECT * FROM tournament_matches WHERE category_id = %s' + (" AND stage = '%s'" % stage if stage else '') +
               ' ORDER BY stage, round_number, bracket_position', (category_id,))


def category_status(category_id):
    return sql('SELECT status FROM tournament_categories WHERE id = %s', (category_id,))[0]['status']


def first_round_ids(result):
    """Registration ids in bracket line order (None = bye)."""
    ids = []
    for match in result['draw']['knockout']['rounds'][0]['matches']:
        ids += [e['registration_id'] if e else None for e in (match['entry1'], match['entry2'])]
    return ids


DRAW_ROUTES = [
    ('GET', ''), ('POST', ''), ('PUT', ''), ('POST', '/publish'), ('DELETE', ''),
]


@pytest.mark.parametrize('method,suffix', DRAW_ROUTES)
def test_draw_routes_are_admin_only(client, people, method, suffix):
    path = f'/api/admin/tournaments/1/categories/1/draw{suffix}'
    assert client.open(path, method=method, json={}).status_code == 401
    for person in (people.plain, people.member):
        assert client.open(path, method=method, json={}, headers=person.headers).status_code == 403


# --- single elimination --------------------------------------------------------------------------------

def test_knockout_draw_builds_the_bracket_with_byes_for_the_seeds(client, people):
    headers = people.admin.headers
    tournament, category, ids = closed_tournament(client, headers, 6, seeds=2)
    result = generate(client, headers, tournament, category)

    assert result['category']['status'] == 'drawn' and category_status(category['id']) == 'drawn'
    knockout = result['draw']['knockout']
    assert knockout['size'] == 8
    assert [r['name'] for r in knockout['rounds']] == ['Quartas de final', 'Semifinal', 'Final']
    assert [len(r['matches']) for r in knockout['rounds']] == [4, 2, 1]
    assert result['draw']['groups'] == [] and result['draw']['knockout_pending'] is False

    quarters, semis, final = (r['matches'] for r in knockout['rounds'])
    # Seed 1 on the first line, seed 2 on the last, both with a bye
    assert quarters[0]['entry1']['registration_id'] == ids[0] and quarters[0]['entry2'] is None
    assert quarters[3]['entry2']['registration_id'] == ids[1] and quarters[3]['entry1'] is None
    for bye, seed in ((quarters[0], ids[0]), (quarters[3], ids[1])):
        assert (bye['status'], bye['outcome'], bye['winner_entry_id']) == ('completed', 'bye', seed)
    for real in quarters[1:3]:
        assert (real['status'], real['outcome']) == ('pending', None) and real['entry1'] and real['entry2']

    # Winners advance along next_match_id/next_slot, and open slots say where they come from
    assert [(m['next_match_id'], m['next_slot']) for m in quarters] == [
        (semis[0]['id'], 1), (semis[0]['id'], 2), (semis[1]['id'], 1), (semis[1]['id'], 2)]
    assert [(m['next_match_id'], m['next_slot']) for m in semis] == [(final[0]['id'], 1), (final[0]['id'], 2)]
    assert final[0]['next_match_id'] is None
    assert semis[0]['entry1']['registration_id'] == ids[0] and semis[0]['entry1_source'] is None
    assert semis[0]['entry2'] is None and semis[0]['entry2_source'] == 'Vencedor das quartas 2'
    assert semis[1]['entry1_source'] == 'Vencedor das quartas 3' and semis[1]['entry2']['registration_id'] == ids[1]
    assert (final[0]['entry1_source'], final[0]['entry2_source']) == ('Vencedor da semifinal 1', 'Vencedor da semifinal 2')

    placed = [i for i in first_round_ids(result) if i is not None]
    assert sorted(placed) == sorted(ids)


def test_a_large_bracket_is_complete_and_correctly_linked(client, people):
    headers = people.admin.headers
    tournament, category, ids = closed_tournament(client, headers, 37, seeds=8)
    generate(client, headers, tournament, category)

    rows = db_matches(category['id'])
    by_id = {m['id']: m for m in rows}
    assert len(rows) == 63  # 64 lines -> 63 matches
    assert sum(1 for m in rows if m['outcome'] == 'bye') == 27 and len([m for m in rows if m['round_number'] == 1]) == 32
    finals = [m for m in rows if m['next_match_id'] is None]
    assert [m['round_number'] for m in finals] == [6]
    for match in rows:
        if match['next_match_id'] is None:
            continue
        following = by_id[match['next_match_id']]
        assert following['round_number'] == match['round_number'] + 1
        assert following['bracket_position'] == (match['bracket_position'] + 1) // 2
        assert match['next_slot'] == (1 if match['bracket_position'] % 2 == 1 else 2)
    # every bye winner already sits in its next-round slot
    for match in rows:
        if match['outcome'] == 'bye':
            assert by_id[match['next_match_id']][f"entry{match['next_slot']}_id"] == match['winner_entry_id']


def test_a_draw_can_be_replayed_from_the_seed_in_the_audit_log(client, people, monkeypatch):
    monkeypatch.setattr(draw_svc, 'new_seed', lambda: 777)
    headers = people.admin.headers
    tournament, category, ids = closed_tournament(client, headers, 13, seeds=4)
    result = generate(client, headers, tournament, category)

    expected = draw.build_knockout(ids, ids[:4], random.Random(777))
    assert first_round_ids(result) == expected

    payload = sql("SELECT payload FROM tournament_audit_log WHERE tournament_id = %s AND action = 'draw_generated'",
                  (tournament['id'],))[0]['payload']
    assert payload['rng_seed'] == 777 and payload['format'] == 'knockout' and payload['entries'] == 13
    assert [x for pair in payload['result']['first_round'] for x in pair] == [e for e in expected]


def test_redrawing_replaces_the_preview(client, people, monkeypatch):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(client, headers, 8)
    monkeypatch.setattr(draw_svc, 'new_seed', lambda: 1)
    first = generate(client, headers, tournament, category)
    old_ids = {m['id'] for m in db_matches(category['id'])}
    monkeypatch.setattr(draw_svc, 'new_seed', lambda: 2)
    second = generate(client, headers, tournament, category)

    assert len(db_matches(category['id'])) == 7 and not old_ids & {m['id'] for m in db_matches(category['id'])}
    assert first_round_ids(first) != first_round_ids(second)
    assert category_status(category['id']) == 'drawn'
    assert audit_actions(tournament['id']).count('draw_generated') == 2


def test_drawing_needs_closed_registrations(client, people):
    headers = people.admin.headers
    tournament = create_tournament(client, headers)
    category = create_category(client, headers, tournament['id'])
    for n in range(4):
        add_registration(category['id'], f'x{n}')

    draft = client.post(url(tournament, category), headers=headers)
    assert draft.status_code == 409 and draft.get_json()['code'] == 'registration_not_closed'
    set_status(client, headers, tournament['id'], 'registration_open')
    assert client.post(url(tournament, category), headers=headers).get_json()['code'] == 'registration_not_closed'
    set_status(client, headers, tournament['id'], 'registration_closed')
    assert client.post(url(tournament, category), headers=headers).status_code == 200

    set_status(client, headers, tournament['id'], 'cancelled')
    assert client.post(url(tournament, category), headers=headers).get_json()['code'] == 'tournament_locked'


def test_drawing_needs_enough_confirmed_entries(client, people):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(client, headers, 3)  # minimum is 4
    refused = client.post(url(tournament, category), headers=headers)
    assert refused.status_code == 400 and refused.get_json()['code'] == 'not_enough_entries'
    assert category_status(category['id']) == 'awaiting_draw'

    set_status(client, headers, tournament['id'], 'cancelled')  # only one tournament can be active
    grouped, grouped_category, _ = closed_tournament(
        client, headers, 5, name='Test Tourn Grouped', draw_format='groups_knockout', group_target_size=3, qualifiers_per_group=2,
        min_entries=6)
    assert client.post(url(grouped, grouped_category), headers=headers).get_json()['code'] == 'not_enough_entries'


def test_only_confirmed_entries_are_drawn_and_pending_ones_are_reported(client, people):
    headers = people.admin.headers
    tournament, category, ids = closed_tournament(client, headers, 4)
    add_registration(category['id'], 'pend', 'pending')
    add_registration(category['id'], 'wait', 'waitlist')
    add_registration(category['id'], 'nope', 'rejected')
    result = generate(client, headers, tournament, category)
    assert sorted(i for i in first_round_ids(result) if i) == sorted(ids)
    assert result['warnings'] == ['Há 1 inscrição(ões) pendente(s) que ficaram fora do sorteio.']


def test_seeds_must_be_numbered_from_one_without_gaps(client, people):
    headers = people.admin.headers
    tournament, category, ids = closed_tournament(client, headers, 8, seeds=2)
    sql('UPDATE tournament_registrations SET seed = 3 WHERE id = %s', (ids[1],))  # seeds 1 and 3
    refused = client.post(url(tournament, category), headers=headers)
    assert refused.status_code == 400 and refused.get_json()['code'] == 'invalid_seeds'


def test_too_many_seeds_for_the_bracket_are_refused(client, people):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(client, headers, 5, seeds=5)  # size 8 holds 4 seeds
    refused = client.post(url(tournament, category), headers=headers)
    assert refused.status_code == 400 and refused.get_json()['code'] == 'draw_failed'
    assert db_matches(category['id']) == [] and category_status(category['id']) == 'awaiting_draw'


def test_an_unknown_category_or_tournament_is_404(client, people):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(client, headers, 4)
    assert client.post(f"/api/admin/tournaments/{tournament['id']}/categories/999999/draw", headers=headers).status_code == 404
    assert client.post(f"/api/admin/tournaments/999999/categories/{category['id']}/draw", headers=headers).status_code == 404


def test_reading_a_category_without_a_draw_is_empty(client, people):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(client, headers, 4)
    body = client.get(url(tournament, category), headers=headers).get_json()
    assert body['draw'] == {'format': 'knockout', 'groups': [], 'knockout': None, 'knockout_pending': False}


# --- round robin and groups -----------------------------------------------------------------------------

def test_round_robin_makes_one_group_with_everyone_playing_everyone(client, people):
    headers = people.admin.headers
    tournament, category, ids = closed_tournament(client, headers, 4, draw_format='round_robin')
    result = generate(client, headers, tournament, category)
    (group,) = result['draw']['groups']
    assert group['name'] == 'A' and sorted(e['registration_id'] for e in group['entries']) == sorted(ids)
    assert len(group['matches']) == 6 and result['draw']['knockout'] is None
    assert sorted(m['round_number'] for m in group['matches']) == [1, 1, 2, 2, 3, 3]
    pairs = {frozenset((m['entry1']['registration_id'], m['entry2']['registration_id'])) for m in group['matches']}
    assert len(pairs) == 6


def test_groups_and_knockout_skeleton_with_two_groups(client, people, monkeypatch):
    monkeypatch.setattr(draw_svc, 'new_seed', lambda: 4242)
    headers = people.admin.headers
    tournament, category, ids = closed_tournament(
        client, headers, 8, seeds=4, draw_format='groups_knockout', group_target_size=4, qualifiers_per_group=2)
    result = generate(client, headers, tournament, category)

    groups = result['draw']['groups']
    assert [g['name'] for g in groups] == ['A', 'B'] and [len(g['entries']) for g in groups] == [4, 4]
    assert len(groups[0]['matches']) == len(groups[1]['matches']) == 6
    for group in groups:  # every match is inside its group and everyone plays three times
        members = {e['registration_id'] for e in group['entries']}
        assert all({m['entry1']['registration_id'], m['entry2']['registration_id']} <= members for m in group['matches'])
        played = [m[slot]['registration_id'] for m in group['matches'] for slot in ('entry1', 'entry2')]
        assert sorted(played) == sorted(list(members) * 3)
    seeds_by_group = [sorted(e['seed'] for e in g['entries'] if e['seed']) for g in groups]
    assert seeds_by_group == [[1, 4], [2, 3]]  # snake: A B B A

    # Replaying the stored seed gives the same groups and the same crossover
    rng = random.Random(4242)
    expected_groups = draw.build_groups(ids, ids[:4], 4, rng)
    assert [sorted(e['registration_id'] for e in g['entries']) for g in groups] == [sorted(g) for g in expected_groups]
    names = ['A', 'B']
    expected_lines = draw.knockout_lines_from_groups(
        [(n, draw.qualifier_label(1, n)) for n in names], [(n, draw.qualifier_label(2, n)) for n in names], rng)

    knockout = result['draw']['knockout']
    assert knockout['size'] == 4 and [r['name'] for r in knockout['rounds']] == ['Semifinal', 'Final']
    semis = knockout['rounds'][0]['matches']
    lines = [s for m in semis for s in (m['entry1_source'], m['entry2_source'])]
    assert lines == expected_lines
    assert {frozenset(p) for p in zip(lines[::2], lines[1::2])} == {
        frozenset(('1º Grupo A', '2º Grupo B')), frozenset(('1º Grupo B', '2º Grupo A'))}
    assert all(m['entry1'] is None and m['entry2'] is None for m in semis)  # nobody is in the bracket yet
    assert result['draw']['knockout_pending'] is False


def test_one_qualifier_per_group_seeds_the_winners(client, people):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(
        client, headers, 16, draw_format='groups_knockout', group_target_size=4, qualifiers_per_group=1)
    result = generate(client, headers, tournament, category)
    assert [len(g['entries']) for g in result['draw']['groups']] == [4, 4, 4, 4]
    semis = result['draw']['knockout']['rounds'][0]['matches']
    sources = [s for m in semis for s in (m['entry1_source'], m['entry2_source'])]
    assert sorted(sources) == ['1º Grupo A', '1º Grupo B', '1º Grupo C', '1º Grupo D']
    assert sources[0] == '1º Grupo A' and sources[3] == '1º Grupo B'


def test_qualifiers_that_do_not_fill_a_bracket_wait_for_the_end_of_the_groups(client, people):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(
        client, headers, 9, draw_format='groups_knockout', group_target_size=3, qualifiers_per_group=2)
    result = generate(client, headers, tournament, category)
    assert [len(g['entries']) for g in result['draw']['groups']] == [3, 3, 3]
    assert sum(len(g['matches']) for g in result['draw']['groups']) == 9
    assert result['draw']['knockout'] is None and result['draw']['knockout_pending'] is True
    assert db_matches(category['id'], 'knockout') == []


# --- swapping entries --------------------------------------------------------------------------------------

def swap(client, headers, tournament, category, first, second):
    return client.put(url(tournament, category), json={'swap': [first, second]}, headers=headers)


def test_swapping_two_entries_exchanges_their_places_in_the_bracket(client, people):
    headers = people.admin.headers
    tournament, category, ids = closed_tournament(client, headers, 8)
    before = first_round_ids(generate(client, headers, tournament, category))
    first, second = before[0], before[5]

    result = swap(client, headers, tournament, category, first, second)
    assert result.status_code == 200
    after = first_round_ids(result.get_json())
    expected = list(before)
    expected[0], expected[5] = second, first
    assert after == expected
    assert audit_actions(tournament['id']).count('draw_swap') == 1


def test_swapping_a_seed_with_a_bye_moves_the_advancing_player(client, people):
    headers = people.admin.headers
    tournament, category, ids = closed_tournament(client, headers, 6, seeds=2)
    result = generate(client, headers, tournament, category)
    quarters = result['draw']['knockout']['rounds'][0]['matches']
    other = next(m['entry1']['registration_id'] for m in quarters[1:3])

    swapped = swap(client, headers, tournament, category, ids[0], other).get_json()
    quarters, semis, _ = (r['matches'] for r in swapped['draw']['knockout']['rounds'])
    assert quarters[0]['entry1']['registration_id'] == other and quarters[0]['winner_entry_id'] == other
    assert semis[0]['entry1']['registration_id'] == other  # the bye now advances the other player
    assert ids[0] in [quarters[i][s]['registration_id'] for i in (1, 2) for s in ('entry1', 'entry2') if quarters[i][s]]


def test_swapping_between_groups_keeps_every_match_inside_its_group(client, people):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(
        client, headers, 8, draw_format='groups_knockout', group_target_size=4, qualifiers_per_group=2)
    result = generate(client, headers, tournament, category)
    group_a, group_b = result['draw']['groups']
    first, second = group_a['entries'][0]['registration_id'], group_b['entries'][0]['registration_id']

    swapped = swap(client, headers, tournament, category, first, second)
    assert swapped.status_code == 200
    for group in swapped.get_json()['draw']['groups']:
        members = {e['registration_id'] for e in group['entries']}
        assert len(members) == 4 and len(group['matches']) == 6
        assert all({m['entry1']['registration_id'], m['entry2']['registration_id']} <= members for m in group['matches'])
    names = {g['name']: {e['registration_id'] for e in g['entries']} for g in swapped.get_json()['draw']['groups']}
    assert second in names['A'] and first in names['B']

    same_group = group_a['entries'][1]['registration_id']
    refused = swap(client, headers, tournament, category, second, same_group)  # second moved to A: same group as...
    assert refused.status_code == 400


def test_swap_rules(client, people):
    headers = people.admin.headers
    tournament, category, ids = closed_tournament(client, headers, 8)
    other_category = create_category(client, headers, create_tournament(client, headers, 'Test Tourn Other')['id'])
    other_ids = [add_registration(other_category['id'], f'o{n}') for n in range(4)]
    generate(client, headers, tournament, category)

    assert swap(client, headers, tournament, category, ids[0], ids[0]).status_code == 400
    assert swap(client, headers, tournament, category, ids[0], 999999).status_code == 404
    assert swap(client, headers, tournament, category, ids[0], other_ids[0]).status_code == 404
    assert client.put(url(tournament, category), json={'swap': [ids[0]]}, headers=headers).status_code == 400
    assert client.put(url(tournament, category), json={}, headers=headers).status_code == 400

    client.post(url(tournament, category, '/publish'), headers=headers)
    published = swap(client, headers, tournament, category, ids[0], ids[1])
    assert published.status_code == 409 and published.get_json()['code'] == 'not_preview'


# --- publish and undo ----------------------------------------------------------------------------------------

def test_publishing_freezes_the_draw(client, people):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(client, headers, 8)
    pending = add_registration(category['id'], 'late', 'pending')
    assert client.post(url(tournament, category, '/publish'), headers=headers).get_json()['code'] == 'not_drawn'
    generate(client, headers, tournament, category)

    published = client.post(url(tournament, category, '/publish'), headers=headers)
    assert published.status_code == 200 and published.get_json()['category']['status'] == 'published'
    assert category_status(category['id']) == 'published'
    assert sql('SELECT status FROM tournaments WHERE id = %s', (tournament['id'],))[0]['status'] == 'registration_closed'

    assert client.post(url(tournament, category, '/publish'), headers=headers).get_json()['code'] == 'not_drawn'
    assert client.post(url(tournament, category), headers=headers).get_json()['code'] == 'draw_published'
    assert patch_registration(client, headers, tournament['id'], pending, status='confirmed').get_json()['code'] == 'draw_exists'
    snapshot = sql("SELECT payload FROM tournament_audit_log WHERE tournament_id = %s AND action = 'draw_published'",
                   (tournament['id'],))[0]['payload']
    assert len(snapshot['first_round']) == 4


def test_undoing_returns_the_category_to_awaiting_draw(client, people):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(
        client, headers, 8, draw_format='groups_knockout', group_target_size=4, qualifiers_per_group=2)
    assert client.delete(url(tournament, category), headers=headers).get_json()['code'] == 'no_draw'

    for publish in (False, True):
        generate(client, headers, tournament, category)
        if publish:
            client.post(url(tournament, category, '/publish'), headers=headers)
        undone = client.delete(url(tournament, category), headers=headers)
        assert undone.status_code == 200
        assert category_status(category['id']) == 'awaiting_draw'
        assert db_matches(category['id']) == [] and sql('SELECT 1 FROM tournament_groups WHERE category_id = %s', (category['id'],)) == []
    assert audit_actions(tournament['id']).count('draw_undone') == 2


def test_a_draw_with_results_cannot_be_undone_but_byes_do_not_count(client, people):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(client, headers, 6, seeds=2)
    generate(client, headers, tournament, category)
    client.post(url(tournament, category, '/publish'), headers=headers)
    assert any(m['outcome'] == 'bye' for m in db_matches(category['id']))

    played = next(m for m in db_matches(category['id']) if m['round_number'] == 1 and m['outcome'] is None)
    sql("UPDATE tournament_matches SET status = 'completed', outcome = 'normal', winner_entry_id = entry1_id, score = '6-4, 6-3', "
        "result_by = %s WHERE id = %s", (people.admin.id, played['id']))
    refused = client.delete(url(tournament, category), headers=headers)
    assert refused.status_code == 409 and refused.get_json()['code'] == 'results_exist'
    assert category_status(category['id']) == 'published' and len(db_matches(category['id'])) == 7

    sql("UPDATE tournament_matches SET status = 'pending', outcome = NULL, winner_entry_id = NULL, score = NULL, result_by = NULL WHERE id = %s",
        (played['id'],))
    assert client.delete(url(tournament, category), headers=headers).status_code == 200


def test_other_categories_can_be_drawn_while_the_tournament_is_in_progress(client, people):
    headers = people.admin.headers
    tournament, first, _ = closed_tournament(client, headers, 8)
    second = create_category(client, headers, tournament['id'], 'Feminino')
    for n in range(4):
        add_registration(second['id'], f'f{n}')
    generate(client, headers, tournament, first)
    client.post(url(tournament, first, '/publish'), headers=headers)
    assert set_status(client, headers, tournament['id'], 'in_progress').status_code == 200

    assert generate(client, headers, tournament, second)['category']['status'] == 'drawn'
    assert client.post(url(tournament, second, '/publish'), headers=headers).status_code == 200


def test_a_published_category_blocks_reopening_registrations_but_a_preview_does_not(client, people):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(client, headers, 8)
    generate(client, headers, tournament, category)
    assert set_status(client, headers, tournament['id'], 'registration_open').status_code == 200  # only a preview exists
    set_status(client, headers, tournament['id'], 'registration_closed')
    client.post(url(tournament, category, '/publish'), headers=headers)
    assert set_status(client, headers, tournament['id'], 'registration_open').get_json()['code'] == 'draw_published'
