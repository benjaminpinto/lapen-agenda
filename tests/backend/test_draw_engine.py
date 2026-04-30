import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.database import get_db
from src.services.draw_engine import DrawEngine, _pair_key
from src.services.ranking_config import RankingConfigService

SEASON_ID = 8888
USER_ID_BASE = 80000
EMAIL_DOMAIN = '@drawtest.com'


def _cleanup():
    db = get_db()
    db.execute("DELETE FROM ranking_draws WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id = %s)", (SEASON_ID,))
    db.execute("DELETE FROM ranking_matches WHERE round_id IN (SELECT id FROM ranking_rounds WHERE season_id = %s)", (SEASON_ID,))
    db.execute("DELETE FROM ranking_rounds WHERE season_id = %s", (SEASON_ID,))
    db.execute("DELETE FROM ranking_participants WHERE season_id = %s", (SEASON_ID,))
    db.execute("DELETE FROM ranking_season_config WHERE season_id = %s", (SEASON_ID,))
    db.execute("DELETE FROM ranking_seasons WHERE id = %s", (SEASON_ID,))
    db.execute("DELETE FROM users WHERE email LIKE %s", ('%' + EMAIL_DOMAIN,))
    db.commit()
    db.close()


def _make_users(count, approved=True):
    db = get_db()
    user_ids = []
    for i in range(count):
        uid = USER_ID_BASE + i
        db.execute('''
            INSERT INTO users (id, email, password_hash, name, short_name, is_verified, lapen_approved)
            VALUES (%s, %s, %s, %s, %s, true, %s)
        ''', (uid, f'p{i}{EMAIL_DOMAIN}', 'hash', f'Player {i}', f'P{i}', approved))
        user_ids.append(uid)
    db.commit()
    db.close()
    return user_ids


def _make_season():
    db = get_db()
    db.execute('''
        INSERT INTO ranking_seasons (id, year, start_date, end_date, status)
        VALUES (%s, 2027, '2027-01-01', '2027-12-31', 'active')
    ''', (SEASON_ID,))
    db.commit()
    db.close()
    RankingConfigService._cache.pop(SEASON_ID, None)


def _set_config(**overrides):
    cfg = dict(RankingConfigService.DEFAULT_CONFIG)
    cfg.update(overrides)
    db = get_db()
    RankingConfigService.set_config(SEASON_ID, cfg, db)
    db.commit()
    db.close()


def _make_participants(user_ids, positions=None):
    db = get_db()
    for i, uid in enumerate(user_ids):
        pos = positions[i] if positions is not None else (i + 1)
        db.execute('''
            INSERT INTO ranking_participants (season_id, user_id, position, total_points, is_active)
            VALUES (%s, %s, %s, 0, true)
        ''', (SEASON_ID, uid, pos))
    db.commit()
    db.close()


def _make_round(round_number, status='pending'):
    db = get_db()
    cursor = db.execute('''
        INSERT INTO ranking_rounds (season_id, round_number, month, year, status)
        VALUES (%s, %s, %s, 2027, %s) RETURNING id
    ''', (SEASON_ID, round_number, round_number, status))
    rid = cursor.fetchone()['id']
    db.commit()
    db.close()
    return rid


def _seed_draw(round_id, group_type, pairs):
    db = get_db()
    for p1, p2 in pairs:
        db.execute('''
            INSERT INTO ranking_draws (round_id, player1_id, player2_id, group_type)
            VALUES (%s, %s, %s, %s)
        ''', (round_id, p1, p2, group_type))
    db.commit()
    db.close()


@pytest.fixture
def setup_db():
    _cleanup()
    _make_season()
    _set_config()
    yield
    _cleanup()


def test_basic_eight_player_elite_each_plays_twice(setup_db):
    users = _make_users(8)
    _make_participants(users)
    rid = _make_round(1)

    result = DrawEngine.generate_draw(rid, seed=42)

    assert len(result['matches']) == 8
    assert result['undermatched'] == []

    counts = {uid: 0 for uid in users}
    for m in result['matches']:
        counts[m['player1_id']] += 1
        counts[m['player2_id']] += 1
    assert all(c == 2 for c in counts.values())

    pairs = {_pair_key(m['player1_id'], m['player2_id']) for m in result['matches']}
    assert len(pairs) == 8


def test_group_split_18_players(setup_db):
    users = _make_users(18)
    _make_participants(users)
    rid = _make_round(1)

    result = DrawEngine.generate_draw(rid, seed=1)
    matches = result['matches']

    by_group = {'elite': [], 'challenger': [], 'nextgen': []}
    for m in matches:
        by_group[m['group_type']].append(m)
    assert len(by_group['elite']) == 8
    assert len(by_group['challenger']) == 8
    # NextGen has only 2 players → max 1 unique pair; both undermatched
    assert len(by_group['nextgen']) == 1
    assert set(result['undermatched']) == set(users[16:])

    elite_ids = set(users[:8])
    challenger_ids = set(users[8:16])
    nextgen_ids = set(users[16:])
    for m in by_group['elite']:
        assert m['player1_id'] in elite_ids and m['player2_id'] in elite_ids
    for m in by_group['challenger']:
        assert m['player1_id'] in challenger_ids and m['player2_id'] in challenger_ids
    for m in by_group['nextgen']:
        assert m['player1_id'] in nextgen_ids and m['player2_id'] in nextgen_ids


def test_recent_pair_avoidance(setup_db):
    users = _make_users(8)
    _make_participants(users)

    prev = _make_round(1, status='closed')
    prior_pairs = [
        (users[0], users[1]),
        (users[2], users[3]),
        (users[4], users[5]),
        (users[6], users[7]),
    ]
    _seed_draw(prev, 'elite', prior_pairs)

    rid = _make_round(2)
    result = DrawEngine.generate_draw(rid, seed=7)

    new_pairs = {_pair_key(m['player1_id'], m['player2_id']) for m in result['matches']}
    prior = {_pair_key(a, b) for a, b in prior_pairs}
    assert new_pairs.isdisjoint(prior)


def test_rejects_when_round_not_pending(setup_db):
    users = _make_users(4)
    _make_participants(users)
    rid = _make_round(1, status='drawn')

    with pytest.raises(ValueError, match='pendentes'):
        DrawEngine.generate_draw(rid, seed=0)


def test_atomic_claim_blocks_double_draw(setup_db):
    users = _make_users(6)
    _make_participants(users)
    rid = _make_round(1)

    DrawEngine.generate_draw(rid, seed=1)

    with pytest.raises(ValueError, match='pendentes'):
        DrawEngine.generate_draw(rid, seed=2)

    db = get_db()
    count = db.execute(
        'SELECT COUNT(*) AS c FROM ranking_matches WHERE round_id = %s', (rid,)
    ).fetchone()['c']
    db.close()
    assert count == 6


def test_seed_determinism(setup_db):
    users = _make_users(8)
    _make_participants(users)

    rid_a = _make_round(1)
    matches_a = DrawEngine.generate_draw(rid_a, seed=123)['matches']
    pairs_a = sorted(_pair_key(m['player1_id'], m['player2_id']) for m in matches_a)

    _cleanup()
    _make_season()
    _set_config()
    users = _make_users(8)
    _make_participants(users)
    rid_b = _make_round(1)
    matches_b = DrawEngine.generate_draw(rid_b, seed=123)['matches']
    pairs_b = sorted(_pair_key(m['player1_id'], m['player2_id']) for m in matches_b)

    assert pairs_a == pairs_b


def test_nextgen_solo_player_merged_into_challenger(setup_db):
    users = _make_users(17)
    _make_participants(users)
    rid = _make_round(1)

    result = DrawEngine.generate_draw(rid, seed=5)

    by_group = {}
    for m in result['matches']:
        by_group.setdefault(m['group_type'], []).append(m)
    assert 'nextgen' not in by_group
    assert result['undermatched'] == []

    challenger_ids = set(users[8:])
    for m in by_group['challenger']:
        assert m['player1_id'] in challenger_ids and m['player2_id'] in challenger_ids


def test_null_position_placed_last_with_warning(setup_db, caplog):
    import logging
    caplog.set_level(logging.WARNING, logger='lapen_agenda')

    users = _make_users(4)
    _make_participants(users, positions=[1, 2, 3, None])
    rid = _make_round(1)

    result = DrawEngine.generate_draw(rid, seed=0)
    assert len(result['matches']) == 4
    assert any('NULL position' in rec.message for rec in caplog.records)


def test_matches_per_round_config_respected(setup_db):
    _set_config(matches_per_round=1)

    users = _make_users(6)
    _make_participants(users)
    rid = _make_round(1)

    result = DrawEngine.generate_draw(rid, seed=11)

    counts = {uid: 0 for uid in users}
    for m in result['matches']:
        counts[m['player1_id']] += 1
        counts[m['player2_id']] += 1
    assert all(c == 1 for c in counts.values())
    assert len(result['matches']) == 3


def test_undermatched_reported_when_constraints_impossible(setup_db):
    users = _make_users(2)
    _make_participants(users)
    rid = _make_round(1)

    result = DrawEngine.generate_draw(rid, seed=0)
    assert len(result['matches']) == 1
    assert set(result['undermatched']) == set(users)
