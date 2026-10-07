"""Schema-level guarantees of the tournament module (migration 014 / postgres_schema.sql).

These tests talk straight to PostgreSQL: they prove the database itself rejects
invalid states, regardless of what the application code does.
"""
import datetime
import os
import sys

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, ROOT)

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.database import get_db

MIGRATION_FILE = os.path.join(ROOT, 'src', 'database', 'migrations', '014_add_tournaments.sql')

UNIQUE_VIOLATION = '23505'
CHECK_VIOLATION = '23514'

ACTIVE_STATUSES = "('registration_open', 'registration_closed', 'in_progress')"


def sqlstate(exc):
    return getattr(exc, 'pgcode', None) or getattr(exc, 'sqlstate', None)


def expect_error(db, code, fn, *args, **kwargs):
    """Run fn and assert PostgreSQL rejects it with the given SQLSTATE, then roll back."""
    with pytest.raises(Exception) as exc_info:
        fn(db, *args, **kwargs)
    db.rollback()
    assert sqlstate(exc_info.value) == code, f'expected SQLSTATE {code}, got {exc_info.value!r}'


def insert(db, table, values):
    columns = ', '.join(values)
    placeholders = ', '.join(['%s'] * len(values))
    cursor = db.execute(f'INSERT INTO {table} ({columns}) VALUES ({placeholders}) RETURNING id', list(values.values()))
    return cursor.fetchone()['id']


def make_tournament(db, slug, status='draft', **extra):
    values = {'name': f'Torneio {slug}', 'slug': slug, 'start_date': '2099-01-10', 'end_date': '2099-01-12', 'status': status}
    values.update(extra)
    return insert(db, 'tournaments', values)


def make_category(db, tournament_id, name='Categoria A', **extra):
    values = {'tournament_id': tournament_id, 'name': name}
    values.update(extra)
    return insert(db, 'tournament_categories', values)


def make_user(db, label):
    return insert(db, 'users', {
        'email': f'{label}@tschema.test', 'password_hash': 'hash',
        'name': f'TSchema {label}', 'short_name': f'TSchema {label}', 'is_verified': True,
    })


def make_registration(db, category_id, email, status='pending', **extra):
    now = datetime.datetime.now()
    values = {
        'category_id': category_id, 'full_name': 'Fulano de Tal', 'display_name': 'Fulano',
        'email': email, 'phone': '24999990000', 'status': status,
        'terms_accepted_at': now, 'data_consent_at': now,
    }
    values.update(extra)
    return insert(db, 'tournament_registrations', values)


def make_match(db, category_id, **extra):
    values = {'category_id': category_id, 'stage': 'knockout', 'round_number': 1, 'bracket_position': 1}
    values.update(extra)
    return insert(db, 'tournament_matches', values)


def make_schedule(db, court_id, start_time='08:00'):
    return insert(db, 'schedules', {
        'court_id': court_id, 'date': '2099-01-10', 'start_time': start_time,
        'player1_name': 'TSchema P1', 'player2_name': 'TSchema P2', 'match_type': 'Torneio',
    })


def make_stats(db, **source):
    values = {
        'player1_name': 'TSchema P1', 'player2_name': 'TSchema P2', 'winner_name': 'TSchema P1',
        'score': '6-4, 6-3', 'match_type': 'Torneio', 'match_date': '2099-01-10',
    }
    values.update(source)
    return insert(db, 'match_statistics_unified', values)


def cleanup(db):
    db.execute("DELETE FROM match_statistics_unified WHERE player1_name LIKE 'TSchema%'")
    db.execute("DELETE FROM tournaments WHERE slug LIKE 'test-schema-%'")
    db.execute("DELETE FROM schedules WHERE player1_name LIKE 'TSchema%'")
    db.execute('''
        DELETE FROM ranking_matches WHERE round_id IN (
            SELECT r.id FROM ranking_rounds r JOIN ranking_seasons s ON s.id = r.season_id
            WHERE s.description = 'TSchema season')
    ''')
    db.execute("DELETE FROM ranking_rounds WHERE season_id IN (SELECT id FROM ranking_seasons WHERE description = 'TSchema season')")
    db.execute("DELETE FROM ranking_seasons WHERE description = 'TSchema season'")
    db.execute("DELETE FROM users WHERE email LIKE '%@tschema.test'")
    db.execute("DELETE FROM courts WHERE name = 'TSchema Court'")


@pytest.fixture
def db():
    conn = get_db()
    foreign_active = conn.execute(
        f"SELECT slug FROM tournaments WHERE status IN {ACTIVE_STATUSES} AND slug NOT LIKE 'test-schema-%'"
    ).fetchone()
    if foreign_active:
        conn.close()
        pytest.skip(f"database already has an active tournament ({foreign_active['slug']}): would collide with the unique-active rule")
    cleanup(conn)
    conn.commit()
    yield conn
    conn.rollback()
    cleanup(conn)
    conn.commit()
    conn.close()


@pytest.fixture
def court_id(db):
    # Explicit high id: CI seeds court id 1 by hand, which leaves the serial sequence behind
    court = insert(db, 'courts', {'id': 9999, 'name': 'TSchema Court', 'type': 'Saibro'})
    db.commit()
    return court


# --- tournaments -------------------------------------------------------------

def test_only_one_active_tournament_at_a_time(db):
    first = make_tournament(db, 'test-schema-a', 'registration_open')
    db.commit()

    for status in ('registration_open', 'registration_closed', 'in_progress'):
        expect_error(db, UNIQUE_VIOLATION, make_tournament, f'test-schema-{status}', status)

    # Non-active statuses are unlimited
    for status in ('draft', 'finished', 'cancelled'):
        make_tournament(db, f'test-schema-{status}', status)
    db.commit()

    # Once the first one finishes, another can become active
    db.execute("UPDATE tournaments SET status = 'finished' WHERE id = %s", (first,))
    make_tournament(db, 'test-schema-next', 'in_progress')
    db.commit()


def test_tournament_value_checks(db):
    expect_error(db, CHECK_VIOLATION, make_tournament, 'test-schema-bad-status', 'unknown')
    expect_error(db, CHECK_VIOLATION, make_tournament, 'test-schema-bad-format', match_format='best_of_5')
    expect_error(db, CHECK_VIOLATION, make_tournament, 'test-schema-bad-dates', start_date='2099-02-01', end_date='2099-01-01')
    expect_error(db, CHECK_VIOLATION, make_tournament, 'test-schema-bad-window',
                 registration_opens_at='2099-01-05 10:00', registration_closes_at='2099-01-04 10:00')
    expect_error(db, CHECK_VIOLATION, make_tournament, 'test-schema-bad-tiebreak', match_tiebreak_points=0)
    expect_error(db, UNIQUE_VIOLATION, lambda d: (make_tournament(d, 'test-schema-dup'), make_tournament(d, 'test-schema-dup')))


def test_tournament_defaults_match_the_agreed_standard(db):
    tournament_id = make_tournament(db, 'test-schema-defaults')
    row = db.execute('SELECT status, match_format, no_ad, match_tiebreak_points FROM tournaments WHERE id = %s', (tournament_id,)).fetchone()
    assert row['status'] == 'draft'
    assert row['match_format'] == 'best_of_3_super_tb'
    assert row['no_ad'] is True
    assert row['match_tiebreak_points'] == 10


# --- categories --------------------------------------------------------------

def test_category_constraints(db):
    tournament_id = make_tournament(db, 'test-schema-cat')
    make_category(db, tournament_id, 'Masculino')
    db.commit()

    expect_error(db, UNIQUE_VIOLATION, make_category, tournament_id, 'Masculino')
    expect_error(db, CHECK_VIOLATION, make_category, tournament_id, 'Sem config de grupos', draw_format='groups_knockout')
    expect_error(db, CHECK_VIOLATION, make_category, tournament_id, 'Grupo de 5', draw_format='groups_knockout', group_target_size=5, qualifiers_per_group=2)
    expect_error(db, CHECK_VIOLATION, make_category, tournament_id, 'Classifica 3', draw_format='groups_knockout', group_target_size=4, qualifiers_per_group=3)
    expect_error(db, CHECK_VIOLATION, make_category, tournament_id, 'Max menor que min', min_entries=6, max_entries=4)
    expect_error(db, CHECK_VIOLATION, make_category, tournament_id, 'Min 1', min_entries=1)
    expect_error(db, CHECK_VIOLATION, make_category, tournament_id, 'Formato', draw_format='compass')
    expect_error(db, CHECK_VIOLATION, make_category, tournament_id, 'Status', status='open')

    make_category(db, tournament_id, 'Grupos ok', draw_format='groups_knockout', group_target_size=4, qualifiers_per_group=2)
    make_category(db, tournament_id, 'Sem limite', max_entries=None)
    db.commit()


# --- registrations -----------------------------------------------------------

def test_email_is_unique_only_among_live_registrations(db):
    tournament_id = make_tournament(db, 'test-schema-email')
    cat_a = make_category(db, tournament_id, 'A')
    cat_b = make_category(db, tournament_id, 'B')
    first = make_registration(db, cat_a, 'Ana@Example.com')
    db.commit()

    # Case-insensitive duplicate in the same category is rejected, whatever the live status
    expect_error(db, UNIQUE_VIOLATION, make_registration, cat_a, 'ana@example.com')
    expect_error(db, UNIQUE_VIOLATION, make_registration, cat_a, 'ANA@EXAMPLE.COM', 'waitlist')

    # Another category is fine
    make_registration(db, cat_b, 'ana@example.com')
    db.commit()

    # After a rejection the person can try again
    db.execute("UPDATE tournament_registrations SET status = 'rejected' WHERE id = %s", (first,))
    make_registration(db, cat_a, 'ana@example.com')
    db.commit()


def test_member_and_seed_are_unique_per_category(db):
    tournament_id = make_tournament(db, 'test-schema-member')
    cat_a = make_category(db, tournament_id, 'A')
    cat_b = make_category(db, tournament_id, 'B')
    member = make_user(db, 'member')
    first = make_registration(db, cat_a, 'one@example.com', user_id=member, seed=1)
    db.commit()

    expect_error(db, UNIQUE_VIOLATION, make_registration, cat_a, 'two@example.com', user_id=member)
    expect_error(db, UNIQUE_VIOLATION, make_registration, cat_a, 'three@example.com', seed=1)
    expect_error(db, CHECK_VIOLATION, make_registration, cat_a, 'four@example.com', seed=0)

    # Same member in another category is allowed (D-2)
    make_registration(db, cat_b, 'one@example.com', user_id=member, seed=1)
    db.commit()

    # A cancelled registration frees both the member slot and the seed
    db.execute("UPDATE tournament_registrations SET status = 'cancelled' WHERE id = %s", (first,))
    make_registration(db, cat_a, 'five@example.com', user_id=member, seed=1)
    db.commit()


def test_registration_status_check(db):
    category_id = make_category(db, make_tournament(db, 'test-schema-regstatus'))
    db.commit()
    expect_error(db, CHECK_VIOLATION, make_registration, category_id, 'x@example.com', 'approved')


def test_deleting_a_user_keeps_the_registration_unlinked(db):
    category_id = make_category(db, make_tournament(db, 'test-schema-userdel'))
    member = make_user(db, 'gone')
    registration = make_registration(db, category_id, 'gone@example.com', user_id=member)
    db.commit()

    db.execute('DELETE FROM users WHERE id = %s', (member,))
    row = db.execute('SELECT user_id FROM tournament_registrations WHERE id = %s', (registration,)).fetchone()
    assert row['user_id'] is None


# --- groups and matches ------------------------------------------------------

def test_registration_belongs_to_a_single_group(db):
    category_id = make_category(db, make_tournament(db, 'test-schema-groups'))
    group_a = insert(db, 'tournament_groups', {'category_id': category_id, 'name': 'A'})
    group_b = insert(db, 'tournament_groups', {'category_id': category_id, 'name': 'B'})
    registration = make_registration(db, category_id, 'g@example.com')
    db.execute('INSERT INTO tournament_group_entries (group_id, registration_id) VALUES (%s, %s)', (group_a, registration))
    db.commit()

    expect_error(db, UNIQUE_VIOLATION,
                 lambda d: d.execute('INSERT INTO tournament_group_entries (group_id, registration_id) VALUES (%s, %s)', (group_b, registration)))
    expect_error(db, UNIQUE_VIOLATION, lambda d: insert(d, 'tournament_groups', {'category_id': category_id, 'name': 'A'}))


def test_match_integrity_rules(db):
    category_id = make_category(db, make_tournament(db, 'test-schema-match'))
    group_id = insert(db, 'tournament_groups', {'category_id': category_id, 'name': 'A'})
    reg1 = make_registration(db, category_id, 'm1@example.com')
    reg2 = make_registration(db, category_id, 'm2@example.com')
    reg3 = make_registration(db, category_id, 'm3@example.com')
    db.commit()

    # Stage and group must agree
    expect_error(db, CHECK_VIOLATION, make_match, category_id, stage='group')
    expect_error(db, CHECK_VIOLATION, make_match, category_id, stage='knockout', group_id=group_id)
    expect_error(db, CHECK_VIOLATION, make_match, category_id, stage='semifinal')

    # A completed match has an outcome and vice versa
    expect_error(db, CHECK_VIOLATION, make_match, category_id, status='completed', entry1_id=reg1, entry2_id=reg2, winner_entry_id=reg1)
    expect_error(db, CHECK_VIOLATION, make_match, category_id, outcome='normal')
    expect_error(db, CHECK_VIOLATION, make_match, category_id, status='completed', outcome='armageddon', entry1_id=reg1, entry2_id=reg2, winner_entry_id=reg1)

    # Entries and winner
    expect_error(db, CHECK_VIOLATION, make_match, category_id, entry1_id=reg1, entry2_id=reg1)
    expect_error(db, CHECK_VIOLATION, make_match, category_id, status='completed', outcome='normal', entry1_id=reg1, entry2_id=reg2, winner_entry_id=reg3)
    expect_error(db, CHECK_VIOLATION, make_match, category_id, status='completed', outcome='normal', entry1_id=reg1, entry2_id=reg2)

    # next_slot is 1 or 2
    expect_error(db, CHECK_VIOLATION, make_match, category_id, next_slot=3)

    # Valid shapes: normal result, bye (single entry), double W.O. (nobody wins), open slot with only a label
    make_match(db, category_id, bracket_position=1, status='completed', outcome='normal', entry1_id=reg1, entry2_id=reg2, winner_entry_id=reg2, score='6-4, 6-3')
    make_match(db, category_id, bracket_position=2, status='completed', outcome='bye', entry1_id=reg3, winner_entry_id=reg3)
    make_match(db, category_id, bracket_position=3, status='completed', outcome='double_wo', entry1_id=reg1, entry2_id=reg2)
    make_match(db, category_id, bracket_position=4, entry1_source='1o Grupo A', entry2_source='Vencedor do jogo 3')
    db.commit()


def test_match_positions_and_windows_are_unique(db, court_id):
    tournament_id = make_tournament(db, 'test-schema-pos')
    cat_a = make_category(db, tournament_id, 'A')
    cat_b = make_category(db, tournament_id, 'B')
    group_id = insert(db, 'tournament_groups', {'category_id': cat_a, 'name': 'A'})
    first = make_match(db, cat_a, round_number=1, bracket_position=1)
    second = make_match(db, cat_a, round_number=1, bracket_position=2)
    make_match(db, cat_a, stage='group', group_id=group_id, round_number=1, bracket_position=1)
    db.commit()

    expect_error(db, UNIQUE_VIOLATION, make_match, cat_a, round_number=1, bracket_position=1)
    expect_error(db, UNIQUE_VIOLATION, make_match, cat_a, stage='group', group_id=group_id, round_number=1, bracket_position=1)
    make_match(db, cat_b, round_number=1, bracket_position=1)  # same position, other category
    db.commit()

    # One window (court, day, start time) holds one match
    plan = "UPDATE tournament_matches SET court_id = %s, planned_date = '2099-01-10', planned_time = %s WHERE id = %s"
    db.execute(plan, (court_id, '08:00', first))
    db.commit()
    expect_error(db, UNIQUE_VIOLATION, lambda d: d.execute(plan, (court_id, '08:00', second)))
    db.execute(plan, (court_id, '09:30', second))  # another time of the same court is a different window
    db.commit()

    # Date and time come together
    lone = make_match(db, cat_b, round_number=1, bracket_position=2)
    db.commit()
    expect_error(db, CHECK_VIOLATION, lambda d: d.execute("UPDATE tournament_matches SET planned_date = '2099-01-11' WHERE id = %s", (lone,)))
    expect_error(db, CHECK_VIOLATION, lambda d: d.execute("UPDATE tournament_matches SET planned_time = '08:00' WHERE id = %s", (lone,)))

    # Deleting a court keeps the match and its day and time (the schedule screen then flags the window)
    db.execute('DELETE FROM courts WHERE id = %s', (court_id,))
    row = db.execute('SELECT court_id, planned_date FROM tournament_matches WHERE id = %s', (first,)).fetchone()
    assert row['court_id'] is None and row['planned_date'] is not None


def test_schedule_tables_constraints_and_cascades(db, court_id):
    tournament_id = make_tournament(db, 'test-schema-schedule')
    category_id = make_category(db, tournament_id)
    session_id = insert(db, 'tournament_sessions', {'tournament_id': tournament_id, 'play_date': '2099-01-10', 'start_time': '08:00', 'end_time': '17:00'})
    db.execute('INSERT INTO tournament_session_courts (session_id, court_id) VALUES (%s, %s)', (session_id, court_id))
    db.commit()

    # A session ends after it starts, and lists a court once
    expect_error(db, CHECK_VIOLATION, lambda d: insert(d, 'tournament_sessions', {'tournament_id': tournament_id, 'play_date': '2099-01-10', 'start_time': '10:00', 'end_time': '10:00'}))
    expect_error(db, UNIQUE_VIOLATION, lambda d: d.execute('INSERT INTO tournament_session_courts (session_id, court_id) VALUES (%s, %s)', (session_id, court_id)))

    # A window is blocked once
    block = {'tournament_id': tournament_id, 'court_id': court_id, 'play_date': '2099-01-10', 'start_time': '09:30'}
    insert(db, 'tournament_slot_blocks', block)
    db.commit()
    expect_error(db, UNIQUE_VIOLATION, lambda d: insert(d, 'tournament_slot_blocks', block))

    # Unavailability: whole day (no times) or a range that ends after it starts
    reg = make_registration(db, category_id, 'sch1@example.com')
    insert(db, 'tournament_unavailability', {'registration_id': reg, 'play_date': '2099-01-10'})
    insert(db, 'tournament_unavailability', {'registration_id': reg, 'play_date': '2099-01-10', 'start_time': '08:00', 'end_time': '12:00', 'note': 'trabalho'})
    db.commit()
    for values in ({'start_time': '08:00'}, {'end_time': '12:00'}, {'start_time': '12:00', 'end_time': '12:00'}, {'start_time': '12:00', 'end_time': '08:00'}):
        expect_error(db, CHECK_VIOLATION, lambda d, v=values: insert(d, 'tournament_unavailability', {'registration_id': reg, 'play_date': '2099-01-10', **v}))

    # Everything hangs from the tournament (or the registration) and goes away with it
    db.execute('DELETE FROM tournament_registrations WHERE id = %s', (reg,))
    assert db.execute('SELECT COUNT(*) AS n FROM tournament_unavailability').fetchone()['n'] == 0
    db.execute('DELETE FROM tournaments WHERE id = %s', (tournament_id,))
    for table in ('tournament_sessions', 'tournament_session_courts', 'tournament_slot_blocks'):
        assert db.execute(f'SELECT COUNT(*) AS n FROM {table}').fetchone()['n'] == 0, table
    db.commit()


# --- statistics: exactly one origin -------------------------------------------

def test_statistics_require_exactly_one_origin(db, court_id):
    category_id = make_category(db, make_tournament(db, 'test-schema-stats'))
    p1 = make_user(db, 'p1')
    p2 = make_user(db, 'p2')
    reg1 = make_registration(db, category_id, 's1@example.com')
    reg2 = make_registration(db, category_id, 's2@example.com')
    tournament_match = make_match(db, category_id, status='completed', outcome='normal', entry1_id=reg1, entry2_id=reg2, winner_entry_id=reg1)
    schedule_id = make_schedule(db, court_id)

    season = insert(db, 'ranking_seasons', {'year': 2099, 'start_date': '2099-01-01', 'end_date': '2099-12-31', 'description': 'TSchema season'})
    round_id = insert(db, 'ranking_rounds', {'season_id': season, 'round_number': 1, 'month': 1, 'year': 2099})
    ranking_match = insert(db, 'ranking_matches', {'round_id': round_id, 'player1_id': p1, 'player2_id': p2, 'group_type': 'elite'})
    db.commit()

    # No origin, or more than one origin, is rejected
    expect_error(db, CHECK_VIOLATION, make_stats)
    expect_error(db, CHECK_VIOLATION, make_stats, schedule_id=schedule_id, tournament_match_id=tournament_match)
    expect_error(db, CHECK_VIOLATION, make_stats, ranking_match_id=ranking_match, tournament_match_id=tournament_match)
    # Legacy rule preserved: schedule + ranking together are still rejected
    expect_error(db, CHECK_VIOLATION, make_stats, schedule_id=schedule_id, ranking_match_id=ranking_match)

    # Each single origin is accepted, and a tournament match is recorded only once
    make_stats(db, schedule_id=schedule_id)
    make_stats(db, ranking_match_id=ranking_match)
    make_stats(db, tournament_match_id=tournament_match)
    db.commit()
    expect_error(db, UNIQUE_VIOLATION, make_stats, tournament_match_id=tournament_match)


def test_deleting_a_tournament_removes_its_whole_tree(db):
    tournament_id = make_tournament(db, 'test-schema-cascade')
    category_id = make_category(db, tournament_id)
    group_id = insert(db, 'tournament_groups', {'category_id': category_id, 'name': 'A'})
    reg1 = make_registration(db, category_id, 'c1@example.com')
    reg2 = make_registration(db, category_id, 'c2@example.com')
    db.execute('INSERT INTO tournament_group_entries (group_id, registration_id) VALUES (%s, %s)', (group_id, reg1))
    match_id = make_match(db, category_id, status='completed', outcome='normal', entry1_id=reg1, entry2_id=reg2, winner_entry_id=reg1)
    make_stats(db, tournament_match_id=match_id)
    insert(db, 'tournament_audit_log', {'tournament_id': tournament_id, 'category_id': category_id, 'action': 'draw_published'})
    db.commit()

    db.execute('DELETE FROM tournaments WHERE id = %s', (tournament_id,))
    db.commit()

    for table, where in [
        ('tournament_categories', 'tournament_id'), ('tournament_audit_log', 'tournament_id'),
    ]:
        assert db.execute(f'SELECT COUNT(*) AS n FROM {table} WHERE {where} = %s', (tournament_id,)).fetchone()['n'] == 0
    for table in ('tournament_registrations', 'tournament_groups', 'tournament_matches'):
        assert db.execute(f'SELECT COUNT(*) AS n FROM {table} WHERE category_id = %s', (category_id,)).fetchone()['n'] == 0
    assert db.execute('SELECT COUNT(*) AS n FROM tournament_group_entries WHERE group_id = %s', (group_id,)).fetchone()['n'] == 0
    assert db.execute('SELECT COUNT(*) AS n FROM match_statistics_unified WHERE tournament_match_id = %s', (match_id,)).fetchone()['n'] == 0


# --- migration -----------------------------------------------------------------

def test_migration_014_can_run_repeatedly(db):
    """run_migrations.py reruns every file, so 014 must be a no-op on an up-to-date database."""
    with open(MIGRATION_FILE, 'r') as handle:
        sql = handle.read()

    for _ in range(2):
        db.execute(sql)
        db.commit()

    checks = db.execute('''
        SELECT conname, pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conrelid = 'match_statistics_unified'::regclass AND contype = 'c'
    ''').fetchall()
    assert [c['conname'] for c in checks] == ['chk_match_stats_single_source']
    assert 'num_nonnulls' in checks[0]['definition']
