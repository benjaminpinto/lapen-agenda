"""Public sign-up and admin registration management."""
import pytest
from backend.tournament_support import (  # noqa: F401  (fixtures are used by name)
    add_registration, audit_actions, clean_db, client, create_category, create_tournament, open_tournament,
    patch_registration, people, register, registration_payload, registration_row, set_status, signup, sql,
)

from src.services import tournament_service as svc


# --- public sign-up ---------------------------------------------------------------------------

def test_visitor_signs_up_and_waits_for_confirmation(client, people):
    tournament, category = open_tournament(client, people.admin.headers)
    response = register(client, tournament['slug'], category['id'], 'Ana@Example.com', ip='198.51.100.7')

    assert response.status_code == 201
    body = response.get_json()
    assert body['waitlisted'] is False
    assert body['registration']['status'] == 'pending'
    assert 'telefone' in body['message']

    row = registration_row(body['registration']['id'])
    assert row['user_id'] is None
    assert row['email'] == 'ana@example.com'
    assert row['phone'] == '24999990000'
    assert row['terms_accepted_at'] is not None and row['data_consent_at'] is not None
    assert len(row['ip_hash']) == 64 and '198.51.100.7' not in row['ip_hash']


def test_response_never_echoes_private_data(client, people):
    tournament, category = open_tournament(client, people.admin.headers)
    response = register(client, tournament['slug'], category['id'], 'segredo@example.com', notes='observacao-privada')
    text = response.get_data(as_text=True)

    for private in ('segredo@example.com', '24999990000', 'observacao-privada', 'ip_hash', 'Ana Maria Souza'):
        assert private not in text
    assert set(response.get_json()['registration']) == {'id', 'category_id', 'display_name', 'status'}


@pytest.mark.parametrize('changes', [
    {'full_name': None},
    {'full_name': 'Al'},
    {'email': None},
    {'email': 'ana-sem-arroba'},
    {'email': 'ana@semponto'},
    {'phone': None},
    {'phone': '12345'},
    {'phone': 'abcdefghijkl'},
    {'accepted_terms': False},
    {'accepted_terms': 'true'},
    {'data_consent': None},
    {'category_id': None},
    {'notes': 'x' * 501},
])
def test_invalid_sign_ups_are_rejected_and_not_stored(client, people, changes):
    tournament, category = open_tournament(client, people.admin.headers)
    payload = {**registration_payload(category['id']), **changes}
    response = client.post(f"/api/tournaments/{tournament['slug']}/registrations", json=payload)
    assert response.status_code == 400, response.get_json()
    assert sql('SELECT 1 FROM tournament_registrations') == []


def test_display_name_defaults_to_the_first_two_names(client, people):
    tournament, category = open_tournament(client, people.admin.headers)
    payload = registration_payload(category['id'], full_name='Maria Clara de Souza', display_name=None)
    response = client.post(f"/api/tournaments/{tournament['slug']}/registrations", json=payload)
    assert response.get_json()['registration']['display_name'] == 'Maria Clara'


def test_public_sign_up_rejects_a_body_that_is_not_an_object(client, people):
    tournament, _ = open_tournament(client, people.admin.headers)
    assert client.post(f"/api/tournaments/{tournament['slug']}/registrations", json=['x']).status_code == 400


def test_honeypot_pretends_success_and_stores_nothing(client, people):
    tournament, category = open_tournament(client, people.admin.headers)
    response = register(client, tournament['slug'], category['id'], website='http://spam.example')
    assert response.status_code == 201
    assert response.get_json()['registration'] is None
    assert sql('SELECT 1 FROM tournament_registrations') == []


def test_registration_needs_an_open_tournament(client, people):
    headers = people.admin.headers
    draft = create_tournament(client, headers, 'Test Tourn Draft')
    draft_category = create_category(client, headers, draft['id'])
    assert register(client, draft['slug'], draft_category['id']).status_code == 404  # drafts are invisible
    assert register(client, 'test-tourn-nao-existe', 1).status_code == 404

    tournament, category = open_tournament(client, headers, 'Test Tourn Open')
    assert set_status(client, headers, tournament['id'], 'registration_closed').status_code == 200
    closed = register(client, tournament['slug'], category['id'])
    assert closed.status_code == 409 and closed.get_json()['code'] == 'registration_closed'


def test_registration_window_is_respected(client, people, monkeypatch):
    headers = people.admin.headers
    tournament = create_tournament(client, headers, 'Test Tourn Window',
                                   registration_opens_at='2099-03-01T08:00', registration_closes_at='2099-03-10T18:00')
    category = create_category(client, headers, tournament['id'])
    set_status(client, headers, tournament['id'], 'registration_open')
    from datetime import datetime

    monkeypatch.setattr(svc, 'local_now', lambda: datetime(2099, 2, 28, 12, 0))
    early = register(client, tournament['slug'], category['id'])
    assert early.status_code == 409 and early.get_json()['code'] == 'registration_not_started'
    assert '01/03/2099 às 08:00' in early.get_json()['error']

    monkeypatch.setattr(svc, 'local_now', lambda: datetime(2099, 3, 5, 12, 0))
    assert register(client, tournament['slug'], category['id']).status_code == 201

    monkeypatch.setattr(svc, 'local_now', lambda: datetime(2099, 3, 10, 18, 0))
    late = register(client, tournament['slug'], category['id'], 'outra@example.com')
    assert late.status_code == 409 and late.get_json()['code'] == 'registration_closed'
    assert sql('SELECT status FROM tournaments WHERE id = %s', (tournament['id'],))[0]['status'] == 'registration_closed'


def test_category_must_belong_to_the_tournament_and_not_be_drawn(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Cat')
    other = create_tournament(client, headers, 'Test Tourn Other')
    foreign = create_category(client, headers, other['id'])
    assert register(client, tournament['slug'], foreign['id']).status_code == 404
    assert register(client, tournament['slug'], 999999).status_code == 404

    sql("UPDATE tournament_categories SET status = 'drawn' WHERE id = %s", (category['id'],))
    drawn = register(client, tournament['slug'], category['id'])
    assert drawn.status_code == 409 and drawn.get_json()['code'] == 'registration_closed'


def test_same_email_cannot_register_twice_in_a_category(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Dup')
    second = create_category(client, headers, tournament['id'], 'Feminino')
    first_id = signup(client, tournament, category, 'ana@example.com')

    duplicate = register(client, tournament['slug'], category['id'], 'ANA@example.com')
    assert duplicate.status_code == 409 and duplicate.get_json()['code'] == 'duplicate_email'
    assert register(client, tournament['slug'], second['id'], 'ana@example.com').status_code == 201

    assert patch_registration(client, headers, tournament['id'], first_id, status='rejected').status_code == 200
    assert register(client, tournament['slug'], category['id'], 'ana@example.com').status_code == 201


def test_pending_requests_do_not_use_up_places_but_confirmed_ones_do(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Full', min_entries=2, max_entries=2)
    ids = [signup(client, tournament, category, f'p{n}@example.com') for n in range(3)]
    assert [registration_row(i)['status'] for i in ids] == ['pending'] * 3  # 3 pending, only 2 places: still fine

    for registration_id in ids[:2]:
        assert patch_registration(client, headers, tournament['id'], registration_id, status='confirmed').status_code == 200

    late = register(client, tournament['slug'], category['id'], 'late@example.com')
    assert late.status_code == 201
    assert late.get_json()['waitlisted'] is True and late.get_json()['registration']['status'] == 'waitlist'
    assert 'lista de espera' in late.get_json()['message']


def test_only_approved_lapen_members_are_linked(client, people):
    tournament, category = open_tournament(client, people.admin.headers)
    cases = [(people.member, True), (people.pending, False), (people.plain, False)]
    for index, (person, linked) in enumerate(cases):
        response = register(client, tournament['slug'], category['id'], f'm{index}@example.com', headers=person.headers)
        assert response.status_code == 201
        row = registration_row(response.get_json()['registration']['id'])
        assert row['user_id'] == (person.id if linked else None)


def test_invalid_token_is_treated_as_a_visitor(client, people):
    tournament, category = open_tournament(client, people.admin.headers)
    response = register(client, tournament['slug'], category['id'], headers={'Authorization': 'Bearer lixo'})
    assert response.status_code == 201
    assert registration_row(response.get_json()['registration']['id'])['user_id'] is None


def test_a_member_cannot_hold_two_registrations_in_a_category(client, people):
    tournament, category = open_tournament(client, people.admin.headers)
    assert register(client, tournament['slug'], category['id'], 'um@example.com', headers=people.member.headers).status_code == 201
    again = register(client, tournament['slug'], category['id'], 'dois@example.com', headers=people.member.headers)
    assert again.status_code == 409 and again.get_json()['code'] == 'duplicate_member'


def test_sign_ups_are_rate_limited_per_ip(client, people):
    tournament, category = open_tournament(client, people.admin.headers)
    for n in range(svc.REGISTRATION_RATE_LIMIT_PER_HOUR):
        assert register(client, tournament['slug'], category['id'], f'r{n}@example.com', ip='203.0.113.50').status_code == 201

    limited = register(client, tournament['slug'], category['id'], 'extra@example.com', ip='203.0.113.50')
    assert limited.status_code == 429 and limited.get_json()['code'] == 'rate_limited'
    assert register(client, tournament['slug'], category['id'], 'extra@example.com', ip='203.0.113.51').status_code == 201

    sql("UPDATE tournament_registrations SET created_at = CURRENT_TIMESTAMP - INTERVAL '2 hours'")
    assert register(client, tournament['slug'], category['id'], 'depois@example.com', ip='203.0.113.50').status_code == 201


# --- admin: listing ---------------------------------------------------------------------------

def test_admin_lists_registrations_with_filters_and_counts(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn List')
    other = create_category(client, headers, tournament['id'], 'Feminino')
    jose = add_registration(category['id'], 'jose', 'pending', full_name='José Álvaro', display_name='José')
    add_registration(category['id'], 'maria', 'confirmed', full_name='Maria Souza', display_name='Maria')
    add_registration(other['id'], 'carla', 'waitlist', full_name='Carla Dias', display_name='Carla')
    base = f"/api/admin/tournaments/{tournament['id']}/registrations"

    everything = client.get(base, headers=headers).get_json()
    assert len(everything['registrations']) == 3
    first = everything['registrations'][0]
    assert first['email'] and first['phone']  # admins see contact data...
    assert 'ip_hash' not in first  # ...but never the hash
    assert everything['counts'][str(category['id'])]['pending'] == 1
    assert everything['counts'][str(category['id'])]['confirmed'] == 1
    assert everything['counts'][str(other['id'])]['waitlist'] == 1

    assert [r['id'] for r in client.get(base + '?q=jose', headers=headers).get_json()['registrations']] == [jose]  # accent-insensitive
    assert len(client.get(base + '?q=maria', headers=headers).get_json()['registrations']) == 1
    assert len(client.get(base + '?q=carla%40ttourn', headers=headers).get_json()['registrations']) == 1  # e-mail fragment
    assert len(client.get(base + '?q=%25', headers=headers).get_json()['registrations']) == 0  # '%' is not a wildcard
    assert len(client.get(base + f"?category_id={other['id']}", headers=headers).get_json()['registrations']) == 1
    assert len(client.get(base + '?status=confirmed', headers=headers).get_json()['registrations']) == 1
    assert client.get(base + '?status=bogus', headers=headers).status_code == 400
    assert client.get('/api/admin/tournaments/999999/registrations', headers=headers).status_code == 404


# --- admin: status changes --------------------------------------------------------------------

def test_confirm_reject_and_cancel(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Review', num_seeds=2)
    a, b, c = (signup(client, tournament, category, f'{n}@example.com') for n in 'abc')

    confirmed = patch_registration(client, headers, tournament['id'], a, status='confirmed')
    assert confirmed.status_code == 200 and confirmed.get_json()['registration']['status'] == 'confirmed'
    assert registration_row(a)['reviewed_at'] is not None

    rejected = patch_registration(client, headers, tournament['id'], b, status='rejected', rejection_reason='Fora da faixa etária')
    assert rejected.get_json()['registration']['rejection_reason'] == 'Fora da faixa etária'

    patch_registration(client, headers, tournament['id'], c, status='confirmed')
    assert patch_registration(client, headers, tournament['id'], c, seed=1).status_code == 200
    cancelled = patch_registration(client, headers, tournament['id'], c, status='cancelled')
    assert cancelled.status_code == 200 and cancelled.get_json()['registration']['seed'] is None

    # Terminal states do not come back
    assert patch_registration(client, headers, tournament['id'], b, status='confirmed').status_code == 409
    assert patch_registration(client, headers, tournament['id'], c, status='pending').get_json()['code'] == 'invalid_transition'
    assert patch_registration(client, headers, tournament['id'], a, status='bogus').status_code == 400
    assert 'registration_updated' in audit_actions(tournament['id'])


def test_places_are_limited_and_a_freed_place_goes_to_the_waitlist(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Cap', min_entries=2, max_entries=2)
    ids = [signup(client, tournament, category, f'p{n}@example.com') for n in range(3)]
    for registration_id in ids[:2]:
        patch_registration(client, headers, tournament['id'], registration_id, status='confirmed')

    full = patch_registration(client, headers, tournament['id'], ids[2], status='confirmed')
    assert full.status_code == 409 and full.get_json()['code'] == 'category_full'

    waitlisted = signup(client, tournament, category, 'late@example.com')
    assert registration_row(waitlisted)['status'] == 'waitlist'
    patch_registration(client, headers, tournament['id'], ids[0], status='cancelled')
    assert patch_registration(client, headers, tournament['id'], waitlisted, status='confirmed').status_code == 200


def test_after_the_draw_only_withdrawals_change_who_is_in(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Drawn')
    confirmed, pending, other = (signup(client, tournament, category, f'{n}@example.com') for n in 'xyz')
    patch_registration(client, headers, tournament['id'], confirmed, status='confirmed')

    # Withdrawing makes no sense before the draw is public
    assert patch_registration(client, headers, tournament['id'], confirmed, status='withdrawn').get_json()['code'] == 'draw_not_published'

    sql("UPDATE tournament_categories SET status = 'published' WHERE id = %s", (category['id'],))
    assert patch_registration(client, headers, tournament['id'], pending, status='confirmed').get_json()['code'] == 'draw_exists'
    assert patch_registration(client, headers, tournament['id'], confirmed, status='cancelled').get_json()['code'] == 'draw_exists'
    assert patch_registration(client, headers, tournament['id'], pending, status='rejected').status_code == 200
    assert patch_registration(client, headers, tournament['id'], confirmed, status='withdrawn').status_code == 200
    assert patch_registration(client, headers, tournament['id'], other, status='withdrawn').status_code == 409  # never confirmed


def test_batch_review_reports_each_item(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Batch', min_entries=2, max_entries=2)
    ids = [signup(client, tournament, category, f'b{n}@example.com') for n in range(3)]
    url = f"/api/admin/tournaments/{tournament['id']}/registrations/batch"

    result = client.post(url, json={'ids': ids + [999999], 'status': 'confirmed'}, headers=headers).get_json()
    assert result['updated'] == ids[:2]
    assert {item['id']: item['code'] for item in result['failed']} == {ids[2]: 'category_full', 999999: None}
    assert [registration_row(i)['status'] for i in ids] == ['confirmed', 'confirmed', 'pending']

    rejected = client.post(url, json={'ids': [ids[2]], 'status': 'rejected', 'rejection_reason': 'Sem vaga'}, headers=headers).get_json()
    assert rejected['updated'] == [ids[2]]
    assert registration_row(ids[2])['rejection_reason'] == 'Sem vaga'

    for bad in ({'ids': [], 'status': 'confirmed'}, {'ids': 'x', 'status': 'confirmed'}, {'ids': [1], 'status': 'pending'}):
        assert client.post(url, json=bad, headers=headers).status_code == 400


# --- admin: manual sign-up --------------------------------------------------------------------

def test_admin_registers_someone_manually(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Manual', min_entries=2, max_entries=2)
    base = f"/api/admin/tournaments/{tournament['id']}/registrations"
    payload = {'category_id': category['id'], 'full_name': 'Carlos Pereira', 'email': 'carlos@example.com', 'phone': '24 98888-7777'}

    created = client.post(base, json=payload, headers=headers)
    assert created.status_code == 201
    body = created.get_json()['registration']
    assert (body['status'], body['display_name'], body['phone']) == ('confirmed', 'Carlos Pereira', '24988887777')
    assert registration_row(body['id'])['reviewed_at'] is not None

    assert client.post(base, json=payload, headers=headers).get_json()['code'] == 'duplicate_email'
    add_registration(category['id'], 'preenche')  # second and last place
    full = client.post(base, json={**payload, 'email': 'outro@example.com'}, headers=headers)
    assert full.status_code == 409 and full.get_json()['code'] == 'category_full'
    pending = client.post(base, json={**payload, 'email': 'pendente@example.com', 'status': 'pending'}, headers=headers)
    assert pending.status_code == 201 and pending.get_json()['registration']['status'] == 'pending'
    assert client.post(base, json={**payload, 'email': 'x@example.com', 'status': 'waitlist'}, headers=headers).status_code == 400
    assert client.post(base, json={**payload, 'category_id': None}, headers=headers).status_code == 400
    assert 'registration_created_manual' in audit_actions(tournament['id'])


def test_manual_registration_can_link_an_approved_member_only(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Link')
    base = f"/api/admin/tournaments/{tournament['id']}/registrations"
    payload = {'category_id': category['id'], 'full_name': 'Sócio Aprovado', 'email': 's@example.com', 'phone': '24988887777'}

    linked = client.post(base, json={**payload, 'user_id': people.member.id}, headers=headers)
    assert linked.status_code == 201 and linked.get_json()['registration']['is_member'] is True
    refused = client.post(base, json={**payload, 'email': 't@example.com', 'user_id': people.pending.id}, headers=headers)
    assert refused.status_code == 400 and refused.get_json()['code'] == 'not_approved_member'
    assert client.post(base, json={**payload, 'email': 'u@example.com', 'user_id': 999999}, headers=headers).status_code == 404


def test_manual_registration_is_blocked_once_the_category_is_drawn(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn DrawnManual')
    sql("UPDATE tournament_categories SET status = 'drawn' WHERE id = %s", (category['id'],))
    response = client.post(f"/api/admin/tournaments/{tournament['id']}/registrations", headers=headers,
                           json={'category_id': category['id'], 'full_name': 'Tarde Demais', 'email': 'x@example.com', 'phone': '24988887777'})
    assert response.status_code == 409 and response.get_json()['code'] == 'draw_exists'


def test_client_ip_hash_is_salted_stable_and_optional(client):
    from backend.tournament_support import app
    with app.app_context():
        first, again, other = svc.hash_client_ip('198.51.100.1'), svc.hash_client_ip('198.51.100.1'), svc.hash_client_ip('198.51.100.2')
        assert first == again and first != other and '198.51.100.1' not in first
        assert svc.hash_client_ip(None) is None and svc.hash_client_ip('') is None


@pytest.mark.parametrize('changes', [{'status': 'in_progress'}, {'status': 'finished'}, {'status': 'cancelled'}])
def test_manual_registration_is_blocked_once_the_tournament_moved_on(client, people, changes):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Late')
    sql('UPDATE tournaments SET status = %s WHERE id = %s', (changes['status'], tournament['id']))
    response = client.post(f"/api/admin/tournaments/{tournament['id']}/registrations", headers=headers,
                           json={'category_id': category['id'], 'full_name': 'Tarde Demais', 'email': 'x@example.com', 'phone': '24988887777'})
    assert response.status_code == 409


# --- admin: editing a registration ---------------------------------------------------------------

def test_admin_links_and_unlinks_members(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Linking')
    first = signup(client, tournament, category, 'a@example.com')
    second = signup(client, tournament, category, 'b@example.com')

    linked = patch_registration(client, headers, tournament['id'], first, user_id=people.member.id)
    assert linked.status_code == 200 and linked.get_json()['registration']['user_id'] == people.member.id

    assert patch_registration(client, headers, tournament['id'], second, user_id=people.pending.id).get_json()['code'] == 'not_approved_member'
    assert patch_registration(client, headers, tournament['id'], second, user_id=people.plain.id).status_code == 400
    assert patch_registration(client, headers, tournament['id'], second, user_id=999999).status_code == 404
    duplicate = patch_registration(client, headers, tournament['id'], second, user_id=people.member.id)
    assert duplicate.status_code == 409 and duplicate.get_json()['code'] == 'duplicate_member'

    unlinked = patch_registration(client, headers, tournament['id'], first, user_id=None)
    assert unlinked.get_json()['registration']['user_id'] is None


def test_seeds_follow_the_category_settings(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Seeds', num_seeds=2)
    a, b, c = (signup(client, tournament, category, f'{n}@example.com') for n in 'abc')

    assert patch_registration(client, headers, tournament['id'], a, seed=1).get_json()['code'] == 'not_confirmed'
    for registration_id in (a, b, c):
        patch_registration(client, headers, tournament['id'], registration_id, status='confirmed')

    assert patch_registration(client, headers, tournament['id'], a, seed=1).status_code == 200
    assert patch_registration(client, headers, tournament['id'], b, seed=1).get_json()['code'] == 'seed_taken'
    assert patch_registration(client, headers, tournament['id'], b, seed=2).status_code == 200
    assert patch_registration(client, headers, tournament['id'], c, seed=3).get_json()['code'] == 'seed_out_of_range'
    assert patch_registration(client, headers, tournament['id'], c, seed=0).status_code == 400
    assert patch_registration(client, headers, tournament['id'], b, seed=None).get_json()['registration']['seed'] is None
    assert patch_registration(client, headers, tournament['id'], c, seed=2).status_code == 200  # freed

    sql("UPDATE tournament_categories SET status = 'published' WHERE id = %s", (category['id'],))
    assert patch_registration(client, headers, tournament['id'], a, seed=None).get_json()['code'] == 'draw_exists'
    assert patch_registration(client, headers, tournament['id'], c, seed=2).get_json()['code'] == 'draw_exists'  # nor assign new ones


def test_seeds_need_a_configured_number_of_seeds(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn NoSeeds')  # num_seeds = 0
    registration_id = signup(client, tournament, category, 'a@example.com')
    patch_registration(client, headers, tournament['id'], registration_id, status='confirmed')
    assert patch_registration(client, headers, tournament['id'], registration_id, seed=1).get_json()['code'] == 'no_seeds_configured'


def test_registration_moves_between_categories_before_the_draw(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Move', num_seeds=2)
    target = create_category(client, headers, tournament['id'], 'Feminino', min_entries=2, max_entries=2)
    registration_id = signup(client, tournament, category, 'a@example.com')
    patch_registration(client, headers, tournament['id'], registration_id, status='confirmed')
    patch_registration(client, headers, tournament['id'], registration_id, seed=1)

    moved = patch_registration(client, headers, tournament['id'], registration_id, category_id=target['id'])
    assert moved.status_code == 200
    assert (moved.get_json()['registration']['category_id'], moved.get_json()['registration']['seed']) == (target['id'], None)

    # A category of another tournament is not reachable
    other_tournament = create_tournament(client, headers, 'Test Tourn Elsewhere')
    foreign = create_category(client, headers, other_tournament['id'])
    assert patch_registration(client, headers, tournament['id'], registration_id, category_id=foreign['id']).status_code == 404

    sql("UPDATE tournament_categories SET status = 'drawn' WHERE id = %s", (target['id'],))
    assert patch_registration(client, headers, tournament['id'], registration_id, category_id=category['id']).get_json()['code'] == 'draw_exists'

    rejected = signup(client, tournament, category, 'z@example.com')
    patch_registration(client, headers, tournament['id'], rejected, status='rejected')
    assert patch_registration(client, headers, tournament['id'], rejected, category_id=target['id']).get_json()['code'] == 'invalid_transition'


def test_move_respects_destination_capacity_and_duplicates(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn MoveCap')
    target = create_category(client, headers, tournament['id'], 'Feminino', min_entries=2, max_entries=2)
    add_registration(target['id'], 'x1')
    add_registration(target['id'], 'x2')
    mover = signup(client, tournament, category, 'mover@example.com')
    patch_registration(client, headers, tournament['id'], mover, status='confirmed')

    full = patch_registration(client, headers, tournament['id'], mover, category_id=target['id'])
    assert full.status_code == 409 and full.get_json()['code'] == 'category_full'

    add_registration(category['id'], 'dup', 'pending', email='dup@example.com')
    add_registration(target['id'], 'dup2', 'waitlist', email='dup@example.com')
    clash = patch_registration(client, headers, tournament['id'], sql(
        "SELECT id FROM tournament_registrations WHERE category_id = %s AND email = 'dup@example.com'", (category['id'],))[0]['id'],
        category_id=target['id'])
    assert clash.status_code == 409 and clash.get_json()['code'] == 'duplicate_email'


def test_admin_corrects_contact_details(client, people):
    headers = people.admin.headers
    tournament, category = open_tournament(client, headers, 'Test Tourn Edit')
    a = signup(client, tournament, category, 'a@example.com')
    b = signup(client, tournament, category, 'b@example.com')

    edited = patch_registration(client, headers, tournament['id'], a, display_name='Aninha', phone='(21) 97777-6666', notes='Prefere manhã')
    body = edited.get_json()['registration']
    assert (body['display_name'], body['phone'], body['notes']) == ('Aninha', '21977776666', 'Prefere manhã')

    assert patch_registration(client, headers, tournament['id'], a, email='b@example.com').get_json()['code'] == 'duplicate_email'
    assert patch_registration(client, headers, tournament['id'], a, email='nope').status_code == 400
    assert patch_registration(client, headers, tournament['id'], 999999, notes='x').status_code == 404
    noop = patch_registration(client, headers, tournament['id'], b)
    assert noop.status_code == 200

    # The audit trail records who changed what, without copying contact data into it
    trail = sql("SELECT payload::text AS payload FROM tournament_audit_log WHERE tournament_id = %s AND action = 'registration_updated'",
                (tournament['id'],))
    assert trail and all('97777' not in row['payload'] and '@' not in row['payload'] for row in trail)


def test_registration_of_another_tournament_is_not_reachable(client, people):
    headers = people.admin.headers
    one, category = open_tournament(client, headers, 'Test Tourn One')
    registration_id = signup(client, one, category, 'a@example.com')
    two = create_tournament(client, headers, 'Test Tourn Two')
    assert patch_registration(client, headers, two['id'], registration_id, notes='x').status_code == 404
