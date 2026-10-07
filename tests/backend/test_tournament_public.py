"""The public read API (what the tracking screen shows), the test fixtures that feed it, and the admin pending summary."""
import json
from datetime import timedelta

import pytest
from backend.tournament_support import (  # noqa: F401  (fixtures are used by name)
    TEST_SECRET, add_registration, clean_db, client, closed_tournament, create_category, create_tournament,
    draw_matches,
    draw_of, ensure_court, generate_draw, make_user, people, seed, set_status, sql,
)

from src.services import tournament_public as public
from src.services import tournament_seed
from src.utils.time_utils import local_now

ALL_STATES = tournament_seed.STATES
FORBIDDEN_KEYS = {
    'email', 'phone', 'notes', 'ip_hash', 'user_id', 'password', 'password_hash', 'terms_accepted_at', 'data_consent_at',
    'rejection_reason', 'reviewed_at', 'result_by', 'registration_id',
    'unavailability', 'note', 'locked', 'play_date', 'start_time', 'end_time',
}


def get(client, path, **params):
    response = client.get(path, query_string=params)
    assert response.status_code == 200, (path, response.get_json())
    return response.get_json()


def category_of(client, slug, name_part):
    category = next(c for c in get(client, f'/api/tournaments/{slug}')['categories'] if name_part in c['name'])
    return get(client, f"/api/tournaments/{slug}/categories/{category['id']}")


def all_keys(value):
    if isinstance(value, dict):
        for key, inner in value.items():
            yield key
            yield from all_keys(inner)
    elif isinstance(value, list):
        for inner in value:
            yield from all_keys(inner)


# --- the fixtures themselves -------------------------------------------------------------------------------------

def test_the_test_endpoints_are_closed_without_the_secret(client, monkeypatch):
    body = {'state': 'registration_open'}
    monkeypatch.delenv('E2E_TEST_SECRET', raising=False)
    assert client.post('/api/test/tournaments/seed', json=body, headers={'X-Test-Secret': ''}).status_code == 403  # no secret configured
    assert client.post('/api/test/users', json={'label': 'x'}).status_code == 403
    assert client.delete('/api/test/tournaments/cleanup').status_code == 403

    monkeypatch.setenv('E2E_TEST_SECRET', TEST_SECRET)
    assert client.post('/api/test/tournaments/seed', json=body).status_code == 403  # header missing
    assert client.post('/api/test/tournaments/seed', json=body, headers={'X-Test-Secret': 'wrong'}).status_code == 403
    monkeypatch.setenv('FLASK_ENV', 'production')
    assert client.post('/api/test/tournaments/seed', json=body, headers={'X-Test-Secret': TEST_SECRET}).status_code == 403  # never in production
    assert sql("SELECT 1 FROM tournaments WHERE slug LIKE 'e2e-%'") == []


def test_the_fixture_endpoints_validate_their_input(client, monkeypatch):
    monkeypatch.setenv('E2E_TEST_SECRET', TEST_SECRET)
    headers = {'X-Test-Secret': TEST_SECRET}
    assert client.post('/api/test/tournaments/seed', json={'state': 'nonsense'}, headers=headers).status_code == 400
    assert client.post('/api/test/tournaments/seed', json={'state': 'finished', 'slug': 'real-tournament'}, headers=headers).status_code == 400
    assert client.delete('/api/test/tournaments/cleanup?prefix=real-', headers=headers).status_code == 400
    assert client.post('/api/test/users', json={'label': 'Bad Label!'}, headers=headers).status_code == 400


def test_a_seed_refuses_to_run_over_another_active_tournament(client, people, seed):
    other = create_tournament(client, people.admin.headers, 'Test Tourn Real')
    create_category(client, people.admin.headers, other['id'])
    assert set_status(client, people.admin.headers, other['id'], 'registration_open').status_code == 200
    response = client.post('/api/test/tournaments/seed', json={'state': 'registration_open'}, headers={'X-Test-Secret': TEST_SECRET})
    assert response.status_code == 409 and response.get_json()['code'] == 'active_tournament_exists'
    assert sql("SELECT status FROM tournaments WHERE id = %s", (other['id'],))[0]['status'] == 'registration_open'  # untouched


def test_a_test_user_can_log_in_and_cleanup_removes_everything(client, seed):
    headers = {'X-Test-Secret': TEST_SECRET}
    created = client.post('/api/test/users', json={'label': 'organizer', 'is_admin': True}, headers=headers)
    assert created.status_code == 201
    user = created.get_json()
    assert user['email'] == 'organizer@e2e.test' and len(user['password']) >= 12
    login = client.post('/api/auth/login', json={'email': user['email'], 'password': user['password']})
    assert login.status_code == 200
    assert client.get('/api/admin/tournaments').status_code == 200  # the login cookie opens the admin API

    seed('finished')
    removed = client.delete('/api/test/tournaments/cleanup', headers=headers).get_json()
    assert removed['tournaments'] == 1 and removed['users'] >= 1
    assert sql("SELECT 1 FROM tournaments WHERE slug LIKE 'e2e-%'") == []


@pytest.mark.parametrize('state', ALL_STATES)
def test_every_state_can_be_seeded_twice(client, seed, state):
    first = seed(state)
    second = seed(state)  # recreated, not duplicated
    assert first['slug'] == second['slug'] == 'e2e-' + state.replace('_', '-')
    assert len(sql('SELECT 1 FROM tournaments WHERE slug = %s', (first['slug'],))) == 1


# --- the payload in each state ---------------------------------------------------------------------------------------------

def test_registration_open(client, seed):
    slug = seed('registration_open')['slug']
    overview = get(client, '/api/tournaments')
    assert overview['current']['slug'] == slug and overview['history'] == []
    assert overview['current']['registration']['open'] is True

    tournament = get(client, f'/api/tournaments/{slug}')
    assert tournament['tournament']['format_text'] == '2 sets sem vantagem + super tie-break de 10 pts'
    assert [c['status'] for c in tournament['categories']] == ['awaiting_draw', 'awaiting_draw']
    masculine = category_of(client, slug, 'Masculino')
    assert masculine['category']['stage']['current'] == 'registration'
    assert [s['state'] for s in masculine['category']['stage']['steps']] == ['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming']
    assert masculine['category']['capacity'] == {'confirmed': 6, 'max_entries': 12, 'min_entries': 6}
    assert len(masculine['entries']) == 6 and [e['seed'] for e in masculine['entries']][:4] == [1, 2, 3, 4]  # seeds first
    assert masculine['groups'] == [] and masculine['bracket'] is None and masculine['knockout_pending'] is False
    assert masculine['upcoming'] == [] and masculine['results'] == []
    assert masculine['category']['draw_published'] is False and masculine['category']['champion'] is None


def test_before_the_draw_the_groups_and_the_bracket_are_empty(client, seed):
    slug = seed('before_draw')['slug']
    overview = get(client, '/api/tournaments')
    assert overview['current']['registration']['open'] is False and overview['current']['registration']['state'] == 'closed'
    for part in ('Masculino', 'Feminino'):
        payload = category_of(client, slug, part)
        assert payload['groups'] == [] and payload['bracket'] is None and payload['category']['status'] == 'awaiting_draw'
        assert payload['category']['progress'] == {'done': 0, 'total': 0, 'group': {'done': 0, 'total': 0}, 'knockout': {'done': 0, 'total': 0}}
        assert len(payload['entries']) in (8, 6)


def test_groups_in_progress(client, seed):
    ensure_court()
    slug = seed('groups_in_progress')['slug']
    masculine = category_of(client, slug, 'Masculino')
    assert masculine['category']['stage']['current'] == 'groups'
    assert [s['state'] for s in masculine['category']['stage']['steps']] == ['done', 'current', 'upcoming', 'upcoming', 'upcoming']
    assert masculine['category']['progress'] == {'done': 6, 'total': 15, 'group': {'done': 6, 'total': 12}, 'knockout': {'done': 0, 'total': 3}}

    assert [g['name'] for g in masculine['groups']] == ['A', 'B']
    for group in masculine['groups']:
        assert len(group['rows']) == 4 and len(group['matches']) == 6 and group['complete'] is False
        assert {r['state'] for r in group['rows']} <= {'provisional', 'open'} and all(r['destination'] is None for r in group['rows'])
        row = group['rows'][0]
        assert set(row) == {'entry', 'position', 'tied', 'state', 'played', 'wins', 'losses', 'sets_won', 'sets_lost', 'sets_diff',
                            'games_won', 'games_lost', 'games_diff', 'destination'}
        assert row['sets_diff'] == row['sets_won'] - row['sets_lost'] and row['games_diff'] == row['games_won'] - row['games_lost']

    semis = masculine['bracket']['rounds'][0]['matches']
    assert masculine['bracket']['size'] == 4 and [m['round_name'] for m in semis] == ['Semifinal', 'Semifinal']
    assert sorted(side['source'] for m in semis for side in m['sides']) == ['1º Grupo A', '1º Grupo B', '2º Grupo A', '2º Grupo B']
    assert all(side['entry'] is None for m in semis for side in m['sides'])

    assert len(masculine['results']) == 5 and all(m['status'] == 'completed' for m in masculine['results'])
    played = [m['played_at'] for m in masculine['results']]
    assert played == sorted(played, reverse=True)  # most recent first
    assert len(masculine['upcoming']) == 5 and masculine['upcoming'][0]['planned_date'] is not None  # booked games come first
    booked = [m for m in masculine['upcoming'] if m['planned_date']]
    assert booked == sorted(booked, key=lambda m: (m['planned_date'], m['planned_time']))
    assert booked[0]['court'] and booked[0]['planned_time'] in ('08:00', '09:30', '11:00', '12:30', '14:00', '15:30')

    feminine = category_of(client, slug, 'Feminino')
    assert feminine['category']['stage']['current'] == 'knockout' and feminine['bracket']['size'] == 8
    assert sum(1 for r in feminine['bracket']['rounds'][0]['matches'] if r['outcome'] == 'bye') == 2
    bye = next(m for m in feminine['bracket']['rounds'][0]['matches'] if m['outcome'] == 'bye')
    assert [side['entry'] is None and side['source'] is None for side in bye['sides']].count(True) == 1  # the empty line is the BYE


def test_a_tie_waits_for_the_organizer(client, seed):
    slug = seed('tie_pending')['slug']
    payload = category_of(client, slug, 'Grupos')
    group = payload['groups'][0]
    assert (group['complete'], group['blocked'], group['confirmed']) == (True, True, False)
    assert {r['state'] for r in group['rows']} == {'tie_pending'} and all(r['tied'] for r in group['rows'])
    assert len(group['ties']) == 1 and group['ties'][0]['relevant'] is True and len(group['ties'][0]['entries']) == 3
    assert payload['category']['stage']['current'] == 'groups' and payload['bracket']['size'] == 2
    other = payload['groups'][1]
    assert other['confirmed'] is True and [r['state'] for r in other['rows']] == ['qualified', 'eliminated', 'eliminated']


def test_the_knockout_in_progress(client, seed):
    slug = seed('knockout_in_progress')['slug']
    masculine = category_of(client, slug, 'Masculino')
    assert masculine['category']['stage']['current'] == 'knockout'
    assert all(g['confirmed'] for g in masculine['groups'])
    qualified = [r for g in masculine['groups'] for r in g['rows'] if r['state'] == 'qualified']
    assert len(qualified) == 4 and all(r['destination'] in ('Semifinal 1', 'Semifinal 2') for r in qualified)
    assert {r['destination'] for g in masculine['groups'] for r in g['rows'] if r['state'] == 'eliminated'} == {None}
    semis = masculine['bracket']['rounds'][0]['matches']
    assert all(side['entry'] for m in semis for side in m['sides'])  # every qualifier is in the bracket
    assert [m['status'] for m in semis].count('completed') == 1
    final = masculine['bracket']['rounds'][1]['matches'][0]
    assert final['round_name'] == 'Final' and sum(1 for side in final['sides'] if side['entry']) == 1
    assert [side['source'] for side in final['sides'] if side['entry'] is None][0].startswith('Vencedor da semifinal')
    assert masculine['category']['champion'] is None


def test_finished(client, seed):
    slug = seed('finished')['slug']
    overview = get(client, '/api/tournaments')
    assert overview['current'] is None and [t['slug'] for t in overview['history']] == [slug]
    assert [c['champion'] is not None for c in overview['history'][0]['categories']] == [True, True]

    tournament = get(client, f'/api/tournaments/{slug}')
    assert tournament['tournament']['status'] == 'finished' and tournament['progress']['done'] == tournament['progress']['total'] > 0
    for part in ('Masculino', 'Feminino'):
        payload = category_of(client, slug, part)
        category = payload['category']
        assert category['status'] == 'finished' and category['stage']['current'] == 'champion'
        assert {s['state'] for s in category['stage']['steps']} == {'done'}
        assert category['champion']['display_name'] and category['runner_up']['display_name'] != category['champion']['display_name']
        assert category['progress']['done'] == category['progress']['total']
    assert category_of(client, slug, 'Masculino')['bracket']['rounds'][-1]['matches'][0]['winner_side'] in (1, 2)


def test_a_round_robin_has_its_podium_from_the_table(client, people):
    from backend.tournament_support import play_groups, started_tournament
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 4, draw_format='round_robin')
    assert play_groups(client, headers, tournament, category) == 6
    body = get(client, f"/api/tournaments/{tournament['slug']}/categories/{category['id']}")
    assert body['category']['status'] == 'finished' and body['category']['stage']['current'] == 'champion'
    table = body['groups'][0]['rows']
    assert body['category']['champion'] == table[0]['entry'] and body['category']['runner_up'] == table[1]['entry']
    assert body['bracket'] is None and body['knockout_pending'] is False


def test_a_final_nobody_played_has_no_champion(client, people):
    from backend.tournament_support import result_url, started_tournament
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 2, min_entries=2)
    final = draw_matches(draw_of(client, headers, tournament, category), 'knockout')[0]
    assert client.put(result_url(tournament, final), json={'outcome': 'double_wo'}, headers=headers).status_code == 200
    body = get(client, f"/api/tournaments/{tournament['slug']}/categories/{category['id']}")
    assert body['category']['status'] == 'finished' and body['category']['champion'] is None and body['category']['runner_up'] is None


def test_the_destination_of_a_qualifier_who_got_a_bye(client, people):
    from backend.tournament_support import play_groups, started_tournament
    headers = people.admin.headers
    tournament, category, _ = started_tournament(client, headers, 9, draw_format='groups_knockout', group_target_size=3, qualifiers_per_group=2)
    play_groups(client, headers, tournament, category)  # three groups x two = six teams: the bracket gets two byes
    body = get(client, f"/api/tournaments/{tournament['slug']}/categories/{category['id']}")
    qualified = [r for g in body['groups'] for r in g['rows'] if r['state'] == 'qualified']
    assert len(qualified) == 6 and all(r['destination'] for r in qualified)
    assert sorted(r['destination'].split()[0] for r in qualified).count('Semifinal') == 2  # the two byes go straight to the semifinals
    assert sum(1 for r in qualified if r['destination'].startswith('Quartas')) == 4


@pytest.mark.parametrize('fmt,steps', [
    ('knockout', ['registration', 'knockout', 'final', 'champion']),
    ('round_robin', ['registration', 'groups', 'champion']),
    ('groups_knockout', ['registration', 'groups', 'knockout', 'final', 'champion']),
])
def test_each_format_has_its_own_path(client, people, fmt, steps):
    extra = dict(group_target_size=4, qualifiers_per_group=2) if fmt == 'groups_knockout' else {}
    tournament, category, _ = closed_tournament(client, people.admin.headers, 8, draw_format=fmt, **extra)
    body = get(client, f"/api/tournaments/{tournament['slug']}/categories/{category['id']}")
    assert [s['key'] for s in body['category']['stage']['steps']] == steps


# --- what is public ------------------------------------------------------------------------------------------------------------

def test_drafts_and_cancelled_tournaments_are_not_public(client, people):
    headers = people.admin.headers
    draft = create_tournament(client, headers, 'Test Tourn Draft')
    category = create_category(client, headers, draft['id'])
    assert client.get(f"/api/tournaments/{draft['slug']}").status_code == 404
    assert client.get(f"/api/tournaments/{draft['slug']}/categories/{category['id']}").status_code == 404
    assert client.get(f"/api/tournaments/{draft['slug']}/matches?view=results").status_code == 404
    assert get(client, '/api/tournaments') == {'current': None, 'history': []}

    set_status(client, headers, draft['id'], 'cancelled')
    assert client.get(f"/api/tournaments/{draft['slug']}").status_code == 404
    assert client.get('/api/tournaments/test-tourn-nothing').status_code == 404


def test_a_preview_of_the_draw_is_not_public(client, people):
    headers = people.admin.headers
    tournament, category, _ = closed_tournament(client, headers, 8, draw_format='groups_knockout', group_target_size=4, qualifiers_per_group=2)
    generate_draw(client, headers, tournament, category)  # only a preview
    body = get(client, f"/api/tournaments/{tournament['slug']}/categories/{category['id']}")
    assert body['category']['status'] == 'awaiting_draw' and body['category']['draw_published'] is False
    assert body['groups'] == [] and body['bracket'] is None and body['knockout_pending'] is False
    assert get(client, f"/api/tournaments/{tournament['slug']}/matches", view='upcoming')['matches'] == []


def test_a_category_must_belong_to_the_tournament(client, people, seed):
    slug = seed('finished')['slug']
    foreign = create_category(client, people.admin.headers, create_tournament(client, people.admin.headers, 'Test Tourn Foreign')['id'])
    assert client.get(f"/api/tournaments/{slug}/categories/{foreign['id']}").status_code == 404
    assert client.get(f'/api/tournaments/{slug}/categories/999999').status_code == 404


def test_the_registration_window_is_reported(client, people, monkeypatch):
    from datetime import datetime
    headers = people.admin.headers
    tournament = create_tournament(client, headers, 'Test Tourn Window',
                                   registration_opens_at='2099-03-01T08:00', registration_closes_at='2099-03-10T18:00')
    create_category(client, headers, tournament['id'])
    set_status(client, headers, tournament['id'], 'registration_open')
    monkeypatch.setattr(public, 'local_now', lambda: datetime(2099, 2, 28, 12, 0))
    registration = get(client, f"/api/tournaments/{tournament['slug']}")['tournament']['registration']
    assert (registration['open'], registration['state'], registration['opens_at']) == (False, 'not_started', '2099-03-01T08:00:00')
    monkeypatch.setattr(public, 'local_now', lambda: datetime(2099, 3, 5, 12, 0))
    assert get(client, f"/api/tournaments/{tournament['slug']}")['tournament']['registration']['open'] is True


def test_an_expired_deadline_closes_registrations_when_the_page_is_read(client, people):
    headers = people.admin.headers
    tournament = create_tournament(client, headers, 'Test Tourn Deadline')
    create_category(client, headers, tournament['id'])
    set_status(client, headers, tournament['id'], 'registration_open')
    sql("UPDATE tournaments SET registration_closes_at = '2000-01-01 10:00' WHERE id = %s", (tournament['id'],))
    body = get(client, f"/api/tournaments/{tournament['slug']}")
    assert body['tournament']['status'] == 'registration_closed' and body['tournament']['registration']['open'] is False
    assert sql('SELECT status FROM tournaments WHERE id = %s', (tournament['id'],))[0]['status'] == 'registration_closed'


@pytest.mark.parametrize('fmt,points,advantage,text', [
    ('best_of_3_super_tb', 10, True, '2 sets sem vantagem + super tie-break de 10 pts'),
    ('best_of_3_super_tb', 7, False, '2 sets com vantagem + super tie-break de 7 pts'),
    ('pro_set_8', 10, True, 'Set pro até 8 games, sem vantagem'),
    ('single_set_6', 10, False, 'Set único até 6 games, com vantagem'),
])
def test_the_match_format_as_a_sentence(fmt, points, advantage, text):
    assert public.format_text({'match_format': fmt, 'match_tiebreak_points': points, 'no_ad': advantage}) == text


# --- games and results lists ------------------------------------------------------------------------------------------------------

def test_the_games_and_results_lists(client, seed):
    ensure_court()
    slug = seed('groups_in_progress')['slug']
    upcoming = get(client, f'/api/tournaments/{slug}/matches', view='upcoming')['matches']
    assert upcoming and all(m['status'] == 'pending' and all(s['entry'] for s in m['sides']) for m in upcoming)
    assert {m['category']['name'] for m in upcoming} == {'Masculino 3ª Classe', 'Feminino Livre'}
    booked = [m for m in upcoming if m['planned_date']]
    assert upcoming[:len(booked)] == booked and booked == sorted(booked, key=lambda m: (m['planned_date'], m['planned_time']))  # unscheduled ones last

    results = get(client, f'/api/tournaments/{slug}/matches', view='results')['matches']
    assert len(results) == 7 and all(m['status'] == 'completed' and m['outcome'] != 'bye' for m in results)
    masculine = next(c for c in get(client, f'/api/tournaments/{slug}')['categories'] if 'Masculino' in c['name'])
    only = get(client, f'/api/tournaments/{slug}/matches', view='results', category=masculine['id'])['matches']
    assert len(only) == 6 and {m['category']['id'] for m in only} == {masculine['id']}
    assert len(get(client, f'/api/tournaments/{slug}/matches', view='results', stage='group')['matches']) == 6
    assert get(client, f'/api/tournaments/{slug}/matches', view='results', stage='knockout')['matches'][0]['stage'] == 'knockout'


def test_the_lists_validate_their_parameters(client, seed):
    slug = seed('finished')['slug']
    assert client.get(f'/api/tournaments/{slug}/matches').status_code == 400
    assert client.get(f'/api/tournaments/{slug}/matches?view=everything').status_code == 400
    assert client.get(f'/api/tournaments/{slug}/matches?view=results&stage=semifinal').status_code == 400
    assert get(client, f'/api/tournaments/{slug}/matches', view='results', category=999999)['matches'] == []
    assert get(client, f'/api/tournaments/{slug}/matches', view='upcoming')['matches'] == []  # everything is played


def test_results_come_most_recent_first(client, people):
    headers = people.admin.headers
    from backend.tournament_support import play, started_tournament
    tournament, category, _ = started_tournament(client, headers, 4)
    first, second = draw_matches(draw_of(client, headers, tournament, category), 'knockout')[:2]
    play(client, headers, tournament, first, played_at='2099-03-01')
    play(client, headers, tournament, second, played_at='2099-03-05')
    results = get(client, f"/api/tournaments/{tournament['slug']}/matches", view='results')['matches']
    assert [m['id'] for m in results] == [second['id'], first['id']]
    assert results[0]['winner_side'] == 1 and results[0]['score'] == '6-4, 6-3' and results[0]['played_at'].startswith('2099-03-05')


# --- privacy -----------------------------------------------------------------------------------------------------------------------

@pytest.mark.parametrize('state', ALL_STATES)
def test_no_public_response_exposes_private_data(client, seed, state):
    """Every registration of a seeded tournament carries an e-mail, a phone, a private note and an IP hash."""
    slug = seed(state)['slug']
    responses = [get(client, '/api/tournaments'), get(client, f'/api/tournaments/{slug}')]
    for category in responses[1]['categories']:
        responses.append(get(client, f"/api/tournaments/{slug}/categories/{category['id']}"))
    for view in ('upcoming', 'results'):
        responses.append(get(client, f'/api/tournaments/{slug}/matches', view=view))

    for body in responses:
        assert not FORBIDDEN_KEYS & set(all_keys(body)), FORBIDDEN_KEYS & set(all_keys(body))
        text = json.dumps(body, ensure_ascii=False)
        for secret in ('@seed.example.test', '2499999', tournament_seed.PRIVATE_NOTE, 'seed-ip-hash'):
            assert secret not in text


def test_only_confirmed_people_are_listed(client, seed):
    slug = seed('registration_open')['slug']
    text = json.dumps(category_of(client, slug, 'Masculino'), ensure_ascii=False)
    assert 'Gabriela Nunes' not in text and 'Hugo Pereira' not in text  # the two pending registrations
    names = [e['display_name'] for e in category_of(client, slug, 'Masculino')['entries']]
    assert names[:4] == ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Rocha']


def test_a_withdrawn_player_stays_in_the_bracket_but_leaves_the_entries(client, people):
    from backend.tournament_support import patch_registration, started_tournament
    headers = people.admin.headers
    tournament, category, ids = started_tournament(client, headers, 4)
    first = draw_matches(draw_of(client, headers, tournament, category), 'knockout')[0]
    leaver = first['entry1']['registration_id']
    patch_registration(client, headers, tournament['id'], leaver, status='withdrawn')

    body = get(client, f"/api/tournaments/{tournament['slug']}/categories/{category['id']}")
    assert leaver not in [e['id'] for e in body['entries']]
    shown = next(m for m in body['bracket']['rounds'][0]['matches'] if m['id'] == first['id'])
    assert shown['sides'][0]['entry']['withdrawn'] is True and shown['outcome'] == 'wo' and shown['winner_side'] == 2


# --- the organizer's pending summary --------------------------------------------------------------------------------------------------

def test_the_pending_summary_needs_an_admin(client, people):
    assert client.get('/api/admin/tournaments/pending-summary').status_code == 401
    assert client.get('/api/admin/tournaments/pending-summary', headers=people.member.headers).status_code == 403


def test_the_pending_summary_follows_the_active_tournament(client, people, seed):
    headers = people.admin.headers
    empty = client.get('/api/admin/tournaments/pending-summary', headers=headers).get_json()
    assert empty == {'tournament': None, 'pending_registrations': 0, 'overdue_results': 0, 'ties_to_decide': 0}

    draft = create_tournament(client, headers, 'Test Tourn Draft Summary')
    assert client.get('/api/admin/tournaments/pending-summary', headers=headers).get_json()['tournament']['id'] == draft['id']  # a draft when none is active
    sql('DELETE FROM tournaments WHERE id = %s', (draft['id'],))

    seed('registration_open')
    summary = client.get('/api/admin/tournaments/pending-summary', headers=headers).get_json()
    assert summary['tournament']['status'] == 'registration_open' and summary['pending_registrations'] == 2
    assert (summary['overdue_results'], summary['ties_to_decide']) == (0, 0)


def test_the_pending_summary_counts_ties(client, people, seed):
    seed('tie_pending')
    summary = client.get('/api/admin/tournaments/pending-summary', headers=people.admin.headers).get_json()
    assert (summary['ties_to_decide'], summary['pending_registrations'], summary['overdue_results']) == (1, 0, 0)


def test_the_pending_summary_counts_overdue_results(client, people, seed):
    seed('groups_in_progress')
    ready = "status = 'pending' AND entry1_id IS NOT NULL AND entry2_id IS NOT NULL"
    def plan(day, hour):
        sql(f"UPDATE tournament_matches SET planned_date = '{day}', planned_time = '{hour}', court_id = NULL WHERE {ready}")

    def overdue():
        return client.get('/api/admin/tournaments/pending-summary', headers=people.admin.headers).get_json()['overdue_results']

    plan('2000-01-01', '08:00')
    expected = sql(f'SELECT COUNT(*) AS n FROM tournament_matches WHERE {ready}')[0]['n']
    assert overdue() == expected > 0
    plan('2099-01-01', '08:00')  # in the future: nothing is late
    assert overdue() == 0
    # Late means the 90 minute window is over, not just that the day started
    ended = local_now() - timedelta(minutes=100)
    plan(ended.date(), ended.time().strftime('%H:%M:%S'))
    assert overdue() == expected
    running = local_now() - timedelta(minutes=30)
    plan(running.date(), running.time().strftime('%H:%M:%S'))
    assert overdue() == 0


def test_the_seed_brings_its_own_court_when_the_database_has_none(clean_db):
    """End-to-end runs against a database with no courts still get a schedule; cleanup takes the court away again."""
    from src.database import get_db
    db = get_db()
    try:
        (court,) = tournament_seed.seed_courts(db, limit=0)          # limit 0 stands for "no court found"
        row = db.execute('SELECT name, active FROM courts WHERE id = %s', (court,)).fetchone()
        assert row['name'] == 'E2E Court' and row['active']
        assert tournament_seed.seed_courts(db, limit=0) == [court]   # asked again: the same court, not a second one
        tournament_seed.cleanup(db)
        assert db.execute("SELECT COUNT(*) AS n FROM courts WHERE name = 'E2E Court'").fetchone()['n'] == 0
        db.commit()
    finally:
        db.close()
