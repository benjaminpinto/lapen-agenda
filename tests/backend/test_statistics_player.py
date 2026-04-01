"""
Tests for GET /api/statistics/player

Covers:
- winner_name resolved to current short_name (not stale stored name)
- Match ordering: date DESC, id ASC (deterministic same-date ordering)
- Win/loss counts via winner_id
- Carrasco/Frequês data is derivable from correct winner_name in response
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.database import get_db

# IDs in a range unlikely to conflict with real data
P1_ID  = 8801
P2_ID  = 8802
P3_ID  = 8803

EMAIL_SUFFIX = '@stattest.com'
TEST_COURT_NAME = 'TEST_STAT_COURT'

_test_court_id = None


@pytest.fixture(autouse=True)
def setup_db():
    global _test_court_id
    db = get_db()
    _cleanup(db)

    court = db.execute(
        "INSERT INTO courts (name, type, active) VALUES (%s, 'Saibro', true) RETURNING id",
        (TEST_COURT_NAME,)
    ).fetchone()
    _test_court_id = court['id']

    db.execute("""
        INSERT INTO users (id, email, password_hash, name, short_name, is_verified, lapen_approved)
        VALUES
          (%s, %s, 'hash', 'Player One', 'P1', true, true),
          (%s, %s, 'hash', 'Player Two', 'P2', true, true),
          (%s, %s, 'hash', 'Player Three', 'P3', true, true)
    """, (P1_ID, f'p1{EMAIL_SUFFIX}', P2_ID, f'p2{EMAIL_SUFFIX}', P3_ID, f'p3{EMAIL_SUFFIX}'))
    db.commit()
    db.close()

    yield

    db = get_db()
    _cleanup(db)
    db.commit()
    db.close()


def _cleanup(db):
    db.execute("DELETE FROM match_statistics_unified WHERE player1_id IN (%s, %s, %s) OR player2_id IN (%s, %s, %s)",
               (P1_ID, P2_ID, P3_ID, P1_ID, P2_ID, P3_ID))
    db.execute("DELETE FROM schedules WHERE player1_name = 'TEST_STAT' OR player2_name = 'TEST_STAT'")
    db.execute("DELETE FROM users WHERE email LIKE %s", (f'%{EMAIL_SUFFIX}',))
    db.execute("DELETE FROM courts WHERE name = %s", (TEST_COURT_NAME,))


def _insert_match(db, *, player1_id, player2_id, winner_id,
                  player1_name, player2_name, winner_name,
                  match_date):
    """Create a schedule then insert into match_statistics_unified (satisfies NOT NULL constraint)."""
    sched = db.execute("""
        INSERT INTO schedules (court_id, date, start_time, player1_name, player2_name, match_type)
        VALUES (%s, %s, '08:00', 'TEST_STAT', 'TEST_STAT', 'Amistoso') RETURNING id
    """, (_test_court_id, match_date,)).fetchone()
    schedule_id = sched['id']

    row = db.execute("""
        INSERT INTO match_statistics_unified
          (schedule_id, player1_id, player2_id, winner_id,
           player1_name, player2_name, winner_name,
           score, match_type, match_date)
        VALUES (%s, %s, %s, %s, %s, %s, %s, '6-4, 6-3', 'Amistoso', %s)
        RETURNING id
    """, (schedule_id, player1_id, player2_id, winner_id,
          player1_name, player2_name, winner_name, match_date)).fetchone()
    db.commit()
    return row['id']


# ── winner_name resolution ────────────────────────────────────────────────────

class TestWinnerNameResolution:
    def test_winner_name_uses_current_short_name(self):
        """winner_name in response must reflect users.short_name, not stored stale name."""
        from main import app
        db = get_db()
        # Store winner_name with a stale/different value than current short_name
        _insert_match(db,
            player1_id=P1_ID, player2_id=P2_ID, winner_id=P1_ID,
            player1_name='P1', player2_name='P2',
            winner_name='Old Name For P1',   # stale stored name
            match_date='2026-01-01')
        db.close()

        with app.test_client() as client:
            resp = client.get('/api/statistics/player?player1=P1')
            assert resp.status_code == 200
            data = resp.get_json()
            assert data['total_matches'] == 1
            assert data['wins'] == 1
            match = data['matches'][0]
            # winner_name must be current short_name, not the stale stored value
            assert match['winner_name'] == 'P1', (
                f"Expected 'P1' (current short_name) but got '{match['winner_name']}'"
            )

    def test_winner_name_matches_player1_filter_value(self):
        """winner_name returned by the API must equal player1 query param for wins."""
        from main import app
        db = get_db()
        _insert_match(db,
            player1_id=P1_ID, player2_id=P2_ID, winner_id=P1_ID,
            player1_name='P1', player2_name='P2',
            winner_name='Completely Different Stored Name',
            match_date='2026-01-01')
        db.close()

        with app.test_client() as client:
            resp = client.get('/api/statistics/player?player1=P1')
            data = resp.get_json()
            match = data['matches'][0]
            # The frontend compares match.winner_name === player1 to colour wins green
            assert match['winner_name'] == 'P1'

    def test_loss_winner_name_is_opponent_short_name(self):
        """When P1 loses, winner_name should be P2's current short_name."""
        from main import app
        db = get_db()
        _insert_match(db,
            player1_id=P1_ID, player2_id=P2_ID, winner_id=P2_ID,
            player1_name='P1', player2_name='P2',
            winner_name='Stored Old P2 Name',
            match_date='2026-01-01')
        db.close()

        with app.test_client() as client:
            resp = client.get('/api/statistics/player?player1=P1')
            data = resp.get_json()
            match = data['matches'][0]
            assert match['winner_name'] == 'P2'


# ── Win / loss counts ─────────────────────────────────────────────────────────

class TestWinLossCounts:
    def test_wins_and_losses_counted_by_winner_id(self):
        from main import app
        db = get_db()
        _insert_match(db, player1_id=P1_ID, player2_id=P2_ID, winner_id=P1_ID,
                      player1_name='P1', player2_name='P2', winner_name='P1',
                      match_date='2026-01-01')
        _insert_match(db, player1_id=P1_ID, player2_id=P2_ID, winner_id=P2_ID,
                      player1_name='P1', player2_name='P2', winner_name='P2',
                      match_date='2026-01-02')
        _insert_match(db, player1_id=P1_ID, player2_id=P3_ID, winner_id=P1_ID,
                      player1_name='P1', player2_name='P3', winner_name='P1',
                      match_date='2026-01-03')
        db.close()

        with app.test_client() as client:
            resp = client.get('/api/statistics/player?player1=P1')
            data = resp.get_json()
            assert data['total_matches'] == 3
            assert data['wins'] == 2
            assert data['losses'] == 1

    def test_wins_correct_when_player1_is_in_player2_slot(self):
        """Wins must be counted regardless of which slot the player occupies."""
        from main import app
        db = get_db()
        _insert_match(db, player1_id=P2_ID, player2_id=P1_ID, winner_id=P1_ID,
                      player1_name='P2', player2_name='P1', winner_name='P1',
                      match_date='2026-01-01')
        db.close()

        with app.test_client() as client:
            resp = client.get('/api/statistics/player?player1=P1')
            data = resp.get_json()
            assert data['wins'] == 1
            assert data['losses'] == 0


# ── Match ordering ────────────────────────────────────────────────────────────

class TestMatchOrdering:
    def test_matches_returned_in_descending_date_order(self):
        from main import app
        db = get_db()
        _insert_match(db, player1_id=P1_ID, player2_id=P2_ID, winner_id=P1_ID,
                      player1_name='P1', player2_name='P2', winner_name='P1',
                      match_date='2026-01-01')
        _insert_match(db, player1_id=P1_ID, player2_id=P2_ID, winner_id=P2_ID,
                      player1_name='P1', player2_name='P2', winner_name='P2',
                      match_date='2026-01-03')
        _insert_match(db, player1_id=P1_ID, player2_id=P2_ID, winner_id=P1_ID,
                      player1_name='P1', player2_name='P2', winner_name='P1',
                      match_date='2026-01-02')
        db.close()

        from datetime import datetime
        with app.test_client() as client:
            resp = client.get('/api/statistics/player?player1=P1')
            raw_dates = [m['match_date'] for m in resp.get_json()['matches']]
            # match_date is serialized by Flask as RFC-7231 (e.g. "Sat, 03 Jan 2026 00:00:00 GMT")
            parsed = [datetime.strptime(d, '%a, %d %b %Y %H:%M:%S %Z') for d in raw_dates]
            assert parsed == sorted(parsed, reverse=True)

    def test_same_date_matches_ordered_by_id_ascending(self):
        """Two matches on the same date must come back with the lower id first."""
        from main import app
        db = get_db()
        # Insert lower-id match first so both get sequential IDs
        _insert_match(db, player1_id=P1_ID, player2_id=P2_ID, winner_id=P2_ID,
                      player1_name='P1', player2_name='P2', winner_name='P2',
                      match_date='2026-03-24')
        _insert_match(db, player1_id=P1_ID, player2_id=P3_ID, winner_id=P1_ID,
                      player1_name='P1', player2_name='P3', winner_name='P1',
                      match_date='2026-03-24')
        db.close()

        with app.test_client() as client:
            resp = client.get('/api/statistics/player?player1=P1')
            matches = resp.get_json()['matches']
            # match_date is RFC-7231; filter by checking both ids are returned
            assert len(matches) == 2
            # Lower id (loss vs P2) must come first (ORDER BY date DESC, id ASC)
            assert matches[0]['winner_name'] == 'P2'
            assert matches[1]['winner_name'] == 'P1'

    def test_match_response_includes_id_field(self):
        """Each match in the response must include an `id` for frontend tie-breaking."""
        from main import app
        db = get_db()
        _insert_match(db, player1_id=P1_ID, player2_id=P2_ID, winner_id=P1_ID,
                      player1_name='P1', player2_name='P2', winner_name='P1',
                      match_date='2026-01-01')
        db.close()

        with app.test_client() as client:
            resp = client.get('/api/statistics/player?player1=P1')
            match = resp.get_json()['matches'][0]
            assert 'id' in match
            assert isinstance(match['id'], int)


# ── Carrasco / Frequês derivability ──────────────────────────────────────────

class TestCarrascoFreques:
    """
    The Carrasco/Frequês cards are computed client-side from the matches array.
    The API just needs to return winner_name == player1 short_name for wins.
    These tests confirm the data is suitable for the frontend to derive correct results.
    """

    def test_matches_allow_correct_carrasco_derivation(self):
        """When P1 beats P2 twice and P3 once, the data supports P2 as Carrasco victim."""
        from main import app
        db = get_db()
        _insert_match(db, player1_id=P1_ID, player2_id=P2_ID, winner_id=P1_ID,
                      player1_name='P1', player2_name='P2', winner_name='Stale',
                      match_date='2026-01-01')
        _insert_match(db, player1_id=P1_ID, player2_id=P2_ID, winner_id=P1_ID,
                      player1_name='P1', player2_name='P2', winner_name='Stale',
                      match_date='2026-01-02')
        _insert_match(db, player1_id=P1_ID, player2_id=P3_ID, winner_id=P1_ID,
                      player1_name='P1', player2_name='P3', winner_name='Stale',
                      match_date='2026-01-03')
        db.close()

        with app.test_client() as client:
            resp = client.get('/api/statistics/player?player1=P1')
            matches = resp.get_json()['matches']
            # Count wins per opponent using returned winner_name (must be 'P1')
            opp_wins = {}
            for m in matches:
                opp = m['player2_name'] if m['player1_name'] == 'P1' else m['player1_name']
                if m['winner_name'] == 'P1':
                    opp_wins[opp] = opp_wins.get(opp, 0) + 1
            best = max(opp_wins, key=opp_wins.get)
            assert best == 'P2'
            assert opp_wins[best] == 2

    def test_matches_allow_correct_freques_derivation(self):
        """When P2 beats P1 twice, the data supports P2 as Frequês nemesis."""
        from main import app
        db = get_db()
        _insert_match(db, player1_id=P1_ID, player2_id=P2_ID, winner_id=P2_ID,
                      player1_name='P1', player2_name='P2', winner_name='Stale',
                      match_date='2026-01-01')
        _insert_match(db, player1_id=P1_ID, player2_id=P2_ID, winner_id=P2_ID,
                      player1_name='P1', player2_name='P2', winner_name='Stale',
                      match_date='2026-01-02')
        _insert_match(db, player1_id=P1_ID, player2_id=P3_ID, winner_id=P3_ID,
                      player1_name='P1', player2_name='P3', winner_name='Stale',
                      match_date='2026-01-03')
        db.close()

        with app.test_client() as client:
            resp = client.get('/api/statistics/player?player1=P1')
            matches = resp.get_json()['matches']
            opp_losses = {}
            for m in matches:
                opp = m['player2_name'] if m['player1_name'] == 'P1' else m['player1_name']
                if m['winner_name'] != 'P1':
                    opp_losses[opp] = opp_losses.get(opp, 0) + 1
            worst = max(opp_losses, key=opp_losses.get)
            assert worst == 'P2'
            assert opp_losses[worst] == 2


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
