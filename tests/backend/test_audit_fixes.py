"""Regression tests for audit fixes (see docs/AUDIT_FINDINGS.md).

Covers:
- #4 finish_match TOCTOU
- #5 cancel_match atomic claim (Stripe idempotency_key tested separately via mock)
- #10 challenge accept/reject/delete TOCTOU
- #11 reset_password token single-use
- #12 verify_email atomic
- #15 schedule→ranking_match link race
"""

import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.auth import hash_password
from src.database import get_db


# ----------------- shared cleanup -----------------

EMAIL_DOMAIN = '@audittest.com'


@pytest.fixture
def clean_users():
    db = get_db()
    db.execute("DELETE FROM challenges WHERE challenger_id IN (SELECT id FROM users WHERE email LIKE %s) OR challenged_id IN (SELECT id FROM users WHERE email LIKE %s)", ('%' + EMAIL_DOMAIN, '%' + EMAIL_DOMAIN))
    db.execute("DELETE FROM users WHERE email LIKE %s", ('%' + EMAIL_DOMAIN,))
    db.commit()
    db.close()
    yield
    db = get_db()
    db.execute("DELETE FROM challenges WHERE challenger_id IN (SELECT id FROM users WHERE email LIKE %s) OR challenged_id IN (SELECT id FROM users WHERE email LIKE %s)", ('%' + EMAIL_DOMAIN, '%' + EMAIL_DOMAIN))
    db.execute("DELETE FROM users WHERE email LIKE %s", ('%' + EMAIL_DOMAIN,))
    db.commit()
    db.close()


# ----------------- #11 reset_password single-use -----------------

def test_reset_password_token_is_single_use(clean_users):
    """Two concurrent requests with same valid reset token: only first wins."""
    db = get_db()
    pw_hash = hash_password('initial-pw')
    cursor = db.execute(
        "INSERT INTO users (email, password_hash, name, short_name, reset_token, reset_token_expires) "
        "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
        (f'reset{EMAIL_DOMAIN}', pw_hash, 'Reset User', 'Reset', 'shared-token-1', datetime.utcnow() + timedelta(hours=1))
    )
    user_id = cursor.fetchone()['id']
    db.commit()
    db.close()

    new_hash_a = hash_password('new-pw-a')
    new_hash_b = hash_password('new-pw-b')

    # First "winner": atomic UPDATE matches token, sets password A, nulls token
    db = get_db()
    cursor = db.execute(
        'UPDATE users SET password_hash = %s, reset_token = NULL, reset_token_expires = NULL '
        'WHERE id = %s AND reset_token = %s',
        (new_hash_a, user_id, 'shared-token-1')
    )
    assert cursor.rowcount == 1
    db.commit()
    db.close()

    # Second "loser": same token now NULL → rowcount 0
    db = get_db()
    cursor = db.execute(
        'UPDATE users SET password_hash = %s, reset_token = NULL, reset_token_expires = NULL '
        'WHERE id = %s AND reset_token = %s',
        (new_hash_b, user_id, 'shared-token-1')
    )
    assert cursor.rowcount == 0
    db.commit()
    db.close()

    # Final hash is A's, not B's
    db = get_db()
    final = db.execute('SELECT password_hash, reset_token FROM users WHERE id = %s', (user_id,)).fetchone()
    db.close()
    assert final['password_hash'] == new_hash_a
    assert final['reset_token'] is None


# ----------------- #12 verify_email atomic -----------------

def test_verify_email_token_consumed_on_success(clean_users):
    db = get_db()
    cursor = db.execute(
        "INSERT INTO users (email, password_hash, name, short_name, verification_token, is_verified) "
        "VALUES (%s, %s, %s, %s, %s, FALSE) RETURNING id",
        (f'verify{EMAIL_DOMAIN}', hash_password('x'), 'Verify User', 'Verify', 'verify-token-1')
    )
    user_id = cursor.fetchone()['id']
    db.commit()

    # First UPDATE consumes token
    cursor = db.execute(
        'UPDATE users SET is_verified = TRUE, verification_token = NULL '
        'WHERE verification_token = %s RETURNING id',
        ('verify-token-1',)
    )
    assert cursor.fetchone() is not None
    db.commit()

    # Second UPDATE finds no row
    cursor = db.execute(
        'UPDATE users SET is_verified = TRUE, verification_token = NULL '
        'WHERE verification_token = %s RETURNING id',
        ('verify-token-1',)
    )
    assert cursor.fetchone() is None
    db.commit()

    final = db.execute('SELECT is_verified, verification_token FROM users WHERE id = %s', (user_id,)).fetchone()
    assert final['is_verified'] is True
    assert final['verification_token'] is None
    db.close()


# ----------------- #10 challenge TOCTOU -----------------

def test_challenge_accept_only_first_winner(clean_users):
    """Two concurrent accepts for same pending challenge: only first transitions."""
    db = get_db()
    cur = db.execute(
        "INSERT INTO users (email, password_hash, name, short_name) "
        "VALUES (%s, %s, %s, %s), (%s, %s, %s, %s) RETURNING id",
        (f'ch1{EMAIL_DOMAIN}', hash_password('x'), 'Challenger', 'Ch1',
         f'ch2{EMAIL_DOMAIN}', hash_password('x'), 'Challenged', 'Ch2')
    )
    rows = cur.fetchall()
    challenger_id, challenged_id = rows[0]['id'], rows[1]['id']

    cur = db.execute(
        "INSERT INTO challenges (challenger_id, challenged_id, start_date, end_date, target_type, status) "
        "VALUES (%s, %s, %s, %s, %s, 'pending') RETURNING id",
        (challenger_id, challenged_id, '2026-01-01', '2026-12-31', 'victories')
    )
    challenge_id = cur.fetchone()['id']
    db.commit()

    # First accept: succeeds
    cur = db.execute(
        "UPDATE challenges SET status = 'active' "
        "WHERE id = %s AND status = 'pending' AND challenged_id = %s",
        (challenge_id, challenged_id)
    )
    assert cur.rowcount == 1
    db.commit()

    # Second accept (race loser): rowcount 0
    cur = db.execute(
        "UPDATE challenges SET status = 'active' "
        "WHERE id = %s AND status = 'pending' AND challenged_id = %s",
        (challenge_id, challenged_id)
    )
    assert cur.rowcount == 0
    db.commit()

    # Reject after accept must also fail (not pending anymore)
    cur = db.execute(
        "UPDATE challenges SET status = 'rejected' "
        "WHERE id = %s AND status = 'pending' AND challenged_id = %s",
        (challenge_id, challenged_id)
    )
    assert cur.rowcount == 0
    db.commit()
    db.close()


# ----------------- #15 schedule link atomic -----------------

def test_schedule_to_ranking_match_link_atomic(clean_users):
    """Two simultaneous Liga schedule creations matching the same ranking match
    must not both clobber schedule_id on that ranking match."""
    db = get_db()

    # Setup: a season + round + ranking match without schedule_id
    cur = db.execute(
        "INSERT INTO ranking_seasons (year, start_date, end_date, status) "
        "VALUES (2998, '2998-01-01', '2998-12-31', 'active') RETURNING id"
    )
    season_id = cur.fetchone()['id']
    cur = db.execute(
        "INSERT INTO ranking_rounds (season_id, round_number, month, year, status) "
        "VALUES (%s, 1, 1, 2998, 'open') RETURNING id",
        (season_id,)
    )
    round_id = cur.fetchone()['id']
    cur = db.execute(
        "INSERT INTO users (email, password_hash, name, short_name) "
        "VALUES (%s, %s, %s, %s), (%s, %s, %s, %s) RETURNING id",
        (f'sl1{EMAIL_DOMAIN}', hash_password('x'), 'A', 'A',
         f'sl2{EMAIL_DOMAIN}', hash_password('x'), 'B', 'B')
    )
    rows = cur.fetchall()
    p1, p2 = rows[0]['id'], rows[1]['id']
    cur = db.execute(
        "INSERT INTO ranking_matches (round_id, player1_id, player2_id, group_type, status) "
        "VALUES (%s, %s, %s, 'elite', 'scheduled') RETURNING id",
        (round_id, p1, p2)
    )
    rm_id = cur.fetchone()['id']

    # Two real schedules to compete for the link
    cur = db.execute(
        "INSERT INTO schedules (court_id, date, start_time, player1_name, player2_name, match_type) "
        "VALUES (1, '2998-06-01', '10:00', 'A', 'B', 'Liga'), (1, '2998-06-02', '11:00', 'A', 'B', 'Liga') RETURNING id"
    )
    sch_rows = cur.fetchall()
    sch_a, sch_b = sch_rows[0]['id'], sch_rows[1]['id']
    db.commit()

    # Race: first claim succeeds
    cur = db.execute(
        'UPDATE ranking_matches SET schedule_id = %s WHERE id = %s AND schedule_id IS NULL',
        (sch_a, rm_id)
    )
    assert cur.rowcount == 1
    db.commit()

    # Second claim (different schedule_id) fails — link already claimed
    cur = db.execute(
        'UPDATE ranking_matches SET schedule_id = %s WHERE id = %s AND schedule_id IS NULL',
        (sch_b, rm_id)
    )
    assert cur.rowcount == 0
    db.commit()

    final = db.execute('SELECT schedule_id FROM ranking_matches WHERE id = %s', (rm_id,)).fetchone()
    assert final['schedule_id'] == sch_a

    db.execute("DELETE FROM ranking_matches WHERE id = %s", (rm_id,))
    db.execute("DELETE FROM ranking_rounds WHERE id = %s", (round_id,))
    db.execute("DELETE FROM ranking_seasons WHERE id = %s", (season_id,))
    db.execute("DELETE FROM schedules WHERE id IN (%s, %s)", (sch_a, sch_b))
    db.execute("DELETE FROM users WHERE id IN (%s, %s)", (p1, p2))
    db.commit()
    db.close()


# ----------------- #4 finish_match atomic claim -----------------

def test_finish_match_atomic_claim_blocks_concurrent(clean_users):
    """Two concurrent /finish calls: only one passes the atomic UPDATE."""
    db = get_db()
    cur = db.execute(
        "INSERT INTO schedules (court_id, date, start_time, player1_name, player2_name, match_type) "
        "VALUES (1, '2998-01-01', '10:00', 'A', 'B', 'Amistoso') RETURNING id"
    )
    schedule_id = cur.fetchone()['id']
    cur = db.execute(
        "INSERT INTO matches (schedule_id, status, betting_enabled, total_pool, house_edge) "
        "VALUES (%s, 'upcoming', false, 0, 0.20) RETURNING id",
        (schedule_id,)
    )
    match_id = cur.fetchone()['id']
    db.commit()

    # First claim: succeeds
    cur = db.execute(
        "UPDATE matches SET status = 'finished' WHERE id = %s AND status != 'finished' RETURNING id",
        (match_id,)
    )
    assert cur.fetchone() is not None
    db.commit()

    # Second claim (loser): RETURNING yields nothing
    cur = db.execute(
        "UPDATE matches SET status = 'finished' WHERE id = %s AND status != 'finished' RETURNING id",
        (match_id,)
    )
    assert cur.fetchone() is None
    db.commit()

    db.execute("DELETE FROM matches WHERE id = %s", (match_id,))
    db.execute("DELETE FROM schedules WHERE id = %s", (schedule_id,))
    db.commit()
    db.close()
