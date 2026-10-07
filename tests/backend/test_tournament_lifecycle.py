"""Tournament and category management by admins: permissions, validation, lifecycle and the single-active rule."""
import pytest
from backend.tournament_support import (  # noqa: F401  (fixtures are used by name)
    add_registration, audit_actions, clean_db, client, create_category, create_tournament, open_tournament,
    people, seed_completed_match, set_status, sql,
)

from src.services import tournament_service as svc

ADMIN_ROUTES = [
    ('GET', '/api/admin/tournaments'),
    ('POST', '/api/admin/tournaments'),
    ('GET', '/api/admin/tournaments/1'),
    ('PUT', '/api/admin/tournaments/1'),
    ('PUT', '/api/admin/tournaments/1/status'),
    ('DELETE', '/api/admin/tournaments/1'),
    ('POST', '/api/admin/tournaments/1/categories'),
    ('PUT', '/api/admin/tournaments/1/categories/1'),
    ('DELETE', '/api/admin/tournaments/1/categories/1'),
    ('GET', '/api/admin/tournaments/1/registrations'),
    ('POST', '/api/admin/tournaments/1/registrations'),
    ('POST', '/api/admin/tournaments/1/registrations/batch'),
    ('PATCH', '/api/admin/tournaments/1/registrations/1'),
]


@pytest.mark.parametrize('method,path', ADMIN_ROUTES)
def test_admin_routes_reject_anonymous_and_non_admins(client, people, method, path):
    assert client.open(path, method=method, json={}).status_code == 401
    for person in (people.plain, people.member, people.pending):
        assert client.open(path, method=method, json={}, headers=person.headers).status_code == 403


# --- creating and editing tournaments ---------------------------------------------------------

def test_create_tournament_applies_the_agreed_defaults(client, people):
    tournament = create_tournament(client, people.admin.headers, 'Test Tourn Verão 2099')
    assert tournament['slug'] == 'test-tourn-verao-2099'
    assert tournament['status'] == 'draft'
    assert tournament['match_format'] == 'best_of_3_super_tb'
    assert tournament['no_ad'] is True
    assert tournament['match_tiebreak_points'] == 10
    assert audit_actions(tournament['id']) == ['tournament_created']


def test_equal_names_get_numbered_slugs(client, people):
    first = create_tournament(client, people.admin.headers, 'Test Tourn Copa')
    second = create_tournament(client, people.admin.headers, 'Test Tourn Copa')
    assert (first['slug'], second['slug']) == ('test-tourn-copa', 'test-tourn-copa-2')


def test_explicit_slug_is_validated_and_unique(client, people):
    headers = people.admin.headers
    payload = {'name': 'Test Tourn Slug', 'start_date': '2099-02-10', 'end_date': '2099-02-12'}
    assert client.post('/api/admin/tournaments', json={**payload, 'slug': 'Bad Slug!'}, headers=headers).status_code == 400
    assert client.post('/api/admin/tournaments', json={**payload, 'slug': 'test-tourn-mine'}, headers=headers).status_code == 201
    duplicate = client.post('/api/admin/tournaments', json={**payload, 'slug': 'test-tourn-mine'}, headers=headers)
    assert duplicate.status_code == 409
    assert duplicate.get_json()['code'] == 'slug_taken'


@pytest.mark.parametrize('changes', [
    {'name': None},
    {'name': 'ab'},
    {'name': 123},
    {'start_date': None},
    {'start_date': '10/02/2099'},
    {'end_date': '2099-02-09'},
    {'match_format': 'best_of_5'},
    {'match_tiebreak_points': 0},
    {'match_tiebreak_points': 'dez'},
    {'match_tiebreak_points': True},
    {'no_ad': 'sim'},
    {'registration_opens_at': '2099-02-01T10:00', 'registration_closes_at': '2099-02-01T09:00'},
    {'registration_opens_at': '2099-02-01T10:00:00+00:00'},
    {'registration_opens_at': 'amanhã'},
])
def test_create_tournament_rejects_invalid_values(client, people, changes):
    payload = {'name': 'Test Tourn Invalid', 'start_date': '2099-02-10', 'end_date': '2099-02-12', **changes}
    response = client.post('/api/admin/tournaments', json=payload, headers=people.admin.headers)
    assert response.status_code == 400, response.get_json()
    assert response.get_json()['error']


def test_create_tournament_rejects_a_body_that_is_not_an_object(client, people):
    response = client.post('/api/admin/tournaments', json=['x'], headers=people.admin.headers)
    assert response.status_code == 400


def test_registration_window_accepts_datetime_local_values(client, people):
    tournament = create_tournament(client, people.admin.headers, 'Test Tourn Window',
                                   registration_opens_at='2099-02-01T08:00', registration_closes_at='2099-02-05 18:30:00')
    assert tournament['registration_opens_at'] == '2099-02-01T08:00:00'
    assert tournament['registration_closes_at'] == '2099-02-05T18:30:00'

    # Editing something else keeps the window, and sending the same values changes nothing
    url = f"/api/admin/tournaments/{tournament['id']}"
    kept = client.put(url, json={'location': 'Quadra 2'}, headers=people.admin.headers).get_json()['tournament']
    assert kept['registration_opens_at'] == '2099-02-01T08:00:00'
    again = client.put(url, json={'location': 'Quadra 2'}, headers=people.admin.headers)
    assert again.status_code == 200
    assert audit_actions(tournament['id']).count('tournament_updated') == 1


def test_update_is_partial_and_keeps_the_slug(client, people):
    headers = people.admin.headers
    tournament = create_tournament(client, headers, 'Test Tourn Edit', registration_closes_at='2099-02-05T18:00')
    response = client.put(f"/api/admin/tournaments/{tournament['id']}", headers=headers,
                          json={'location': 'Clube LAPEN', 'registration_closes_at': None, 'no_ad': False})
    assert response.status_code == 200
    updated = response.get_json()['tournament']
    assert (updated['name'], updated['slug']) == ('Test Tourn Edit', 'test-tourn-edit')
    assert updated['location'] == 'Clube LAPEN'
    assert updated['registration_closes_at'] is None
    assert updated['no_ad'] is False
    assert 'tournament_updated' in audit_actions(tournament['id'])


def test_update_unknown_tournament_is_404(client, people):
    assert client.put('/api/admin/tournaments/999999', json={'name': 'x y z'}, headers=people.admin.headers).status_code == 404


@pytest.mark.parametrize('final_status', ['finished', 'cancelled'])
def test_finished_and_cancelled_tournaments_are_read_only(client, people, final_status):
    tournament = create_tournament(client, people.admin.headers, 'Test Tourn Locked')
    sql('UPDATE tournaments SET status = %s WHERE id = %s', (final_status, tournament['id']))
    response = client.put(f"/api/admin/tournaments/{tournament['id']}", json={'location': 'Outro'}, headers=people.admin.headers)
    assert response.status_code == 409
    category = client.post(f"/api/admin/tournaments/{tournament['id']}/categories", json={'name': 'Nova'}, headers=people.admin.headers)
    assert category.status_code == 409


def test_match_format_is_locked_after_the_first_result(client, people):
    headers = people.admin.headers
    tournament = create_tournament(client, headers, 'Test Tourn Format')
    category = create_category(client, headers, tournament['id'])
    url = f"/api/admin/tournaments/{tournament['id']}"

    assert client.put(url, json={'match_format': 'pro_set_8'}, headers=headers).status_code == 200  # nothing played yet
    seed_completed_match(category['id'])
    locked = client.put(url, json={'match_format': 'single_set_6'}, headers=headers)
    assert locked.status_code == 409
    assert locked.get_json()['code'] == 'format_locked'
    assert client.put(url, json={'match_format': 'pro_set_8', 'location': 'Quadra 1'}, headers=headers).status_code == 200


# --- status machine ---------------------------------------------------------------------------

def test_opening_registrations_requires_a_category(client, people):
    tournament = create_tournament(client, people.admin.headers, 'Test Tourn Empty')
    response = set_status(client, people.admin.headers, tournament['id'], 'registration_open')
    assert response.status_code == 409
    assert response.get_json()['code'] == 'no_categories'


def test_only_one_tournament_can_be_active(client, people):
    headers = people.admin.headers
    first, _ = open_tournament(client, headers, 'Test Tourn First')
    second = create_tournament(client, headers, 'Test Tourn Second')
    create_category(client, headers, second['id'])
    for n in range(3):  # drafts are unlimited
        create_tournament(client, headers, f'Test Tourn Draft {n}')

    blocked = set_status(client, headers, second['id'], 'registration_open')
    assert blocked.status_code == 409
    body = blocked.get_json()
    assert body['code'] == 'active_tournament_exists'
    assert first['name'] in body['error']
    assert body['active_tournament']['slug'] == first['slug']

    assert set_status(client, headers, first['id'], 'cancelled').status_code == 200
    assert set_status(client, headers, second['id'], 'registration_open').status_code == 200


def test_single_active_is_also_enforced_by_the_database(client, people, monkeypatch):
    headers = people.admin.headers
    open_tournament(client, headers, 'Test Tourn First')
    second = create_tournament(client, headers, 'Test Tourn Second')
    create_category(client, headers, second['id'])

    # Simulate the race: the application-level check misses it, the unique index must not
    monkeypatch.setattr(svc, '_other_active_tournament', lambda db, exclude_id=None: None)
    response = set_status(client, headers, second['id'], 'registration_open')
    assert response.status_code == 409
    assert response.get_json()['code'] == 'active_tournament_exists'
    assert sql('SELECT status FROM tournaments WHERE id = %s', (second['id'],))[0]['status'] == 'draft'


@pytest.mark.parametrize('state', ['finished', 'cancelled'])
def test_categories_of_a_closed_tournament_cannot_be_edited(client, people, state):
    headers = people.admin.headers
    tournament = create_tournament(client, headers)
    category = create_category(client, headers, tournament['id'])
    sql('UPDATE tournaments SET status = %s WHERE id = %s', (state, tournament['id']))
    response = client.put(f"/api/admin/tournaments/{tournament['id']}/categories/{category['id']}", json={'name': 'Outro'}, headers=headers)
    assert response.status_code == 409


@pytest.mark.parametrize('current,target', [
    ('draft', 'in_progress'), ('draft', 'finished'), ('draft', 'registration_closed'),
    ('registration_open', 'draft'), ('registration_open', 'in_progress'), ('registration_open', 'finished'),
    ('finished', 'cancelled'), ('finished', 'in_progress'), ('cancelled', 'draft'), ('cancelled', 'registration_open'),
])
def test_invalid_status_transitions_are_rejected(client, people, current, target):
    tournament = create_tournament(client, people.admin.headers, 'Test Tourn Transition')
    sql('UPDATE tournaments SET status = %s WHERE id = %s', (current, tournament['id']))
    response = set_status(client, people.admin.headers, tournament['id'], target)
    assert response.status_code == 409
    assert response.get_json()['code'] == 'invalid_transition'


def test_unknown_status_is_a_bad_request(client, people):
    tournament = create_tournament(client, people.admin.headers, 'Test Tourn Bogus')
    assert set_status(client, people.admin.headers, tournament['id'], 'bogus').status_code == 400


def test_registrations_can_be_closed_and_reopened_until_a_draw_is_published(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Reopen')
    assert set_status(client, headers, tournament['id'], 'registration_closed').status_code == 200
    assert set_status(client, headers, tournament['id'], 'registration_open').status_code == 200
    assert set_status(client, headers, tournament['id'], 'registration_closed').status_code == 200

    sql("UPDATE tournament_categories SET status = 'published' WHERE id = %s", (category['id'],))
    blocked = set_status(client, headers, tournament['id'], 'registration_open')
    assert blocked.status_code == 409
    assert blocked.get_json()['code'] == 'draw_published'


def test_tournament_starts_only_with_a_published_draw_and_finishes_with_every_category_done(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Flow')
    set_status(client, headers, tournament['id'], 'registration_closed')

    assert set_status(client, headers, tournament['id'], 'in_progress').get_json()['code'] == 'no_draw'
    sql("UPDATE tournament_categories SET status = 'published' WHERE id = %s", (category['id'],))
    assert set_status(client, headers, tournament['id'], 'in_progress').status_code == 200

    assert set_status(client, headers, tournament['id'], 'finished').get_json()['code'] == 'categories_unfinished'
    sql("UPDATE tournament_categories SET status = 'finished' WHERE id = %s", (category['id'],))
    assert set_status(client, headers, tournament['id'], 'finished').status_code == 200
    assert audit_actions(tournament['id']).count('status_changed') == 4


@pytest.mark.parametrize('state', ['draft', 'registration_open', 'registration_closed', 'in_progress'])
def test_a_tournament_can_be_cancelled_from_any_unfinished_state(client, people, state):
    tournament = create_tournament(client, people.admin.headers, 'Test Tourn Cancel')
    sql('UPDATE tournaments SET status = %s WHERE id = %s', (state, tournament['id']))
    response = set_status(client, people.admin.headers, tournament['id'], 'cancelled')
    assert response.status_code == 200
    assert response.get_json()['tournament']['status'] == 'cancelled'


def test_cannot_open_registrations_with_a_deadline_in_the_past(client, people):
    headers = people.admin.headers
    tournament = create_tournament(client, headers, 'Test Tourn Late', registration_closes_at='2000-01-01T10:00')
    create_category(client, headers, tournament['id'])
    response = set_status(client, headers, tournament['id'], 'registration_open')
    assert response.status_code == 409
    assert response.get_json()['code'] == 'registration_window_past'


def test_expired_deadline_closes_registrations_when_the_tournament_is_read(client, people):
    headers = people.admin.headers
    tournament, _ = open_tournament(client, headers, 'Test Tourn Deadline')
    sql("UPDATE tournaments SET registration_closes_at = '2000-01-01 10:00' WHERE id = %s", (tournament['id'],))

    detail = client.get(f"/api/admin/tournaments/{tournament['id']}", headers=headers).get_json()
    assert detail['tournament']['status'] == 'registration_closed'
    assert 'registration_auto_closed' in audit_actions(tournament['id'])


def test_only_drafts_can_be_deleted(client, people):
    headers = people.admin.headers
    draft = create_tournament(client, headers, 'Test Tourn Draft')
    create_category(client, headers, draft['id'])
    assert client.delete(f"/api/admin/tournaments/{draft['id']}", headers=headers).status_code == 200
    assert sql('SELECT 1 FROM tournament_categories WHERE tournament_id = %s', (draft['id'],)) == []

    opened, _ = open_tournament(client, headers, 'Test Tourn Open')
    blocked = client.delete(f"/api/admin/tournaments/{opened['id']}", headers=headers)
    assert blocked.status_code == 409
    assert blocked.get_json()['code'] == 'not_draft'


def test_list_shows_the_active_tournament_first_with_pending_counts(client, people):
    headers = people.admin.headers
    create_tournament(client, headers, 'Test Tourn Aaa Draft')
    active, _ = open_tournament(client, headers, 'Test Tourn Zzz Active')
    listing = client.get('/api/admin/tournaments', headers=headers).get_json()['tournaments']
    names = [t['name'] for t in listing]
    assert names[0] == active['name']
    assert listing[0]['categories_count'] == 1 and listing[0]['pending_registrations'] == 0


# --- categories -------------------------------------------------------------------------------

def test_category_defaults_and_ordering(client, people):
    headers = people.admin.headers
    tournament = create_tournament(client, headers)
    first = create_category(client, headers, tournament['id'], 'Masculino')
    second = create_category(client, headers, tournament['id'], 'Feminino')
    assert (first['sort_order'], second['sort_order']) == (1, 2)
    assert first['draw_format'] == 'knockout'
    assert (first['min_entries'], first['max_entries'], first['num_seeds']) == (4, None, 0)
    assert (first['wo_tolerance_min'], first['min_rest_min'], first['status']) == (15, 60, 'awaiting_draw')

    url = f"/api/admin/tournaments/{tournament['id']}/categories/{first['id']}"
    assert client.put(url, json={'name': 'Masculino'}, headers=headers).status_code == 200  # nothing changed
    assert audit_actions(tournament['id']).count('category_updated') == 0


def test_group_settings_are_only_kept_for_groups_knockout(client, people):
    headers = people.admin.headers
    tournament = create_tournament(client, headers)
    plain = create_category(client, headers, tournament['id'], 'Eliminatória', group_target_size=4, qualifiers_per_group=2)
    assert (plain['group_target_size'], plain['qualifiers_per_group']) == (None, None)
    grouped = create_category(client, headers, tournament['id'], 'Grupos', draw_format='groups_knockout',
                              group_target_size=4, qualifiers_per_group=2)
    assert (grouped['group_target_size'], grouped['qualifiers_per_group'], grouped['min_entries']) == (4, 2, 6)


@pytest.mark.parametrize('payload', [
    {'name': ''},
    {'name': 'X', 'draw_format': 'compass'},
    {'name': 'X', 'draw_format': 'groups_knockout'},
    {'name': 'X', 'draw_format': 'groups_knockout', 'group_target_size': 5, 'qualifiers_per_group': 2},
    {'name': 'X', 'draw_format': 'groups_knockout', 'group_target_size': 4, 'qualifiers_per_group': 3},
    {'name': 'X', 'draw_format': 'groups_knockout', 'group_target_size': 4, 'qualifiers_per_group': 2, 'min_entries': 4},
    {'name': 'X', 'min_entries': 1},
    {'name': 'X', 'min_entries': 8, 'max_entries': 6},
    {'name': 'X', 'max_entries': 4, 'num_seeds': 5},
    {'name': 'X', 'num_seeds': 17},
    {'name': 'X', 'wo_tolerance_min': -1},
])
def test_invalid_categories_are_rejected(client, people, payload):
    tournament = create_tournament(client, people.admin.headers)
    response = client.post(f"/api/admin/tournaments/{tournament['id']}/categories", json=payload, headers=people.admin.headers)
    assert response.status_code == 400, response.get_json()


def test_category_names_are_unique_within_a_tournament(client, people):
    headers = people.admin.headers
    tournament = create_tournament(client, headers)
    other = create_tournament(client, headers, 'Test Tourn Other')
    create_category(client, headers, tournament['id'], 'Masculino')
    duplicate = client.post(f"/api/admin/tournaments/{tournament['id']}/categories", json={'name': 'Masculino'}, headers=headers)
    assert duplicate.status_code == 409
    assert duplicate.get_json()['code'] == 'category_name_taken'
    create_category(client, headers, other['id'], 'Masculino')  # same name elsewhere is fine


@pytest.mark.parametrize('state', ['in_progress', 'finished', 'cancelled'])
def test_categories_cannot_be_added_late(client, people, state):
    tournament = create_tournament(client, people.admin.headers)
    sql('UPDATE tournaments SET status = %s WHERE id = %s', (state, tournament['id']))
    response = client.post(f"/api/admin/tournaments/{tournament['id']}/categories", json={'name': 'Tarde'}, headers=people.admin.headers)
    assert response.status_code == 409


def test_category_belongs_to_its_tournament(client, people):
    headers = people.admin.headers
    one = create_tournament(client, headers, 'Test Tourn One')
    two = create_tournament(client, headers, 'Test Tourn Two')
    category = create_category(client, headers, one['id'])
    assert client.put(f"/api/admin/tournaments/{two['id']}/categories/{category['id']}", json={'name': 'Novo'}, headers=headers).status_code == 404
    assert client.delete(f"/api/admin/tournaments/{two['id']}/categories/{category['id']}", headers=headers).status_code == 404


def test_draw_settings_lock_once_the_draw_exists(client, people):
    headers = people.admin.headers
    tournament = create_tournament(client, headers)
    category = create_category(client, headers, tournament['id'], num_seeds=2)
    url = f"/api/admin/tournaments/{tournament['id']}/categories/{category['id']}"
    sql("UPDATE tournament_categories SET status = 'published' WHERE id = %s", (category['id'],))

    blocked = client.put(url, json={'draw_format': 'round_robin'}, headers=headers)
    assert blocked.status_code == 409 and blocked.get_json()['code'] == 'draw_exists'
    assert client.put(url, json={'num_seeds': 4}, headers=headers).status_code == 409
    renamed = client.put(url, json={'name': 'Masculino A', 'max_entries': 16}, headers=headers)
    assert renamed.status_code == 200 and renamed.get_json()['category']['name'] == 'Masculino A'


def test_capacity_cannot_drop_below_the_confirmed_count(client, people):
    headers = people.admin.headers
    tournament = create_tournament(client, headers)
    category = create_category(client, headers, tournament['id'], min_entries=2)
    seed_completed_match(category['id'])  # 2 confirmed registrations
    add_registration(category['id'], 'tres')
    url = f"/api/admin/tournaments/{tournament['id']}/categories/{category['id']}"

    blocked = client.put(url, json={'max_entries': 2}, headers=headers)
    assert blocked.status_code == 409 and blocked.get_json()['code'] == 'below_confirmed'
    assert client.put(url, json={'max_entries': 3}, headers=headers).status_code == 200


def test_seed_count_cannot_drop_below_an_assigned_seed(client, people):
    headers = people.admin.headers
    tournament = create_tournament(client, headers)
    category = create_category(client, headers, tournament['id'], num_seeds=4)
    seed_completed_match(category['id'])
    sql("UPDATE tournament_registrations SET seed = 3 WHERE category_id = %s AND display_name = 'Jogador um'", (category['id'],))
    blocked = client.put(f"/api/admin/tournaments/{tournament['id']}/categories/{category['id']}", json={'num_seeds': 2}, headers=headers)
    assert blocked.status_code == 409 and blocked.get_json()['code'] == 'seed_assigned'


def test_category_deletion_rules(client, people):
    headers = people.admin.headers
    tournament = create_tournament(client, headers)
    empty = create_category(client, headers, tournament['id'], 'Vazia')
    used = create_category(client, headers, tournament['id'], 'Com inscritos')
    drawn = create_category(client, headers, tournament['id'], 'Sorteada')
    seed_completed_match(used['id'])
    sql("UPDATE tournament_categories SET status = 'drawn' WHERE id = %s", (drawn['id'],))
    base = f"/api/admin/tournaments/{tournament['id']}/categories"

    assert client.delete(f"{base}/{used['id']}", headers=headers).get_json()['code'] == 'has_registrations'
    assert client.delete(f"{base}/{drawn['id']}", headers=headers).get_json()['code'] == 'draw_exists'
    assert client.delete(f"{base}/{empty['id']}", headers=headers).status_code == 200


def test_detail_lists_categories_with_registration_counts(client, people):
    headers = people.admin.headers
    tournament = create_tournament(client, headers)
    create_category(client, headers, tournament['id'], 'A')
    category = create_category(client, headers, tournament['id'], 'B')
    seed_completed_match(category['id'])
    detail = client.get(f"/api/admin/tournaments/{tournament['id']}", headers=headers).get_json()
    counts = {c['name']: c['counts'] for c in detail['categories']}
    assert counts['A']['confirmed'] == 0 and counts['A']['pending'] == 0
    assert counts['B']['confirmed'] == 2
    assert set(counts['A']) == set(svc.REGISTRATION_STATUSES)


# --- pure helpers -------------------------------------------------------------------------------

@pytest.mark.parametrize('text,expected', [
    ('Torneio de Verão 2099', 'torneio-de-verao-2099'),
    ('  Copa   LAPEN!!  ', 'copa-lapen'),
    ('Ação & Reação', 'acao-reacao'),
    ('???', 'torneio'),
])
def test_slugify(text, expected):
    assert svc.slugify(text) == expected
