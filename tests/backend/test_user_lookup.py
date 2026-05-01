"""Tests for user_lookup helpers (#1–#5 of name normalization audit)."""

import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')

from src.auth import hash_password
from src.database import get_db
from src.utils.user_lookup import find_user_by_display_name, names_match

EMAIL_DOMAIN = '@lookuptest.com'


@pytest.fixture
def setup_users():
    db = get_db()
    db.execute("DELETE FROM users WHERE email LIKE %s", ('%' + EMAIL_DOMAIN,))
    db.execute('''
        INSERT INTO users (email, password_hash, name, short_name, lapen_approved, is_verified)
        VALUES
            (%s, %s, %s, %s, TRUE, TRUE),
            (%s, %s, %s, %s, TRUE, TRUE),
            (%s, %s, %s, %s, FALSE, FALSE)
    ''', (
        f'a{EMAIL_DOMAIN}', hash_password('x'), 'Alexandre Souza Barroso', 'Alexandre Barroso',
        f'b{EMAIL_DOMAIN}', hash_password('x'), 'Bruno Acioli Santos', 'Bruno Acioli',
        f'c{EMAIL_DOMAIN}', hash_password('x'), 'Pending User', 'Pending'
    ))
    db.commit()
    db.close()
    yield
    db = get_db()
    db.execute("DELETE FROM users WHERE email LIKE %s", ('%' + EMAIL_DOMAIN,))
    db.commit()
    db.close()


def test_find_by_short_name_exact(setup_users):
    db = get_db()
    user = find_user_by_display_name(db, 'Alexandre Barroso')
    db.close()
    assert user is not None
    assert user['short_name'] == 'Alexandre Barroso'


def test_find_by_full_name(setup_users):
    db = get_db()
    user = find_user_by_display_name(db, 'Alexandre Souza Barroso')
    db.close()
    assert user is not None
    assert user['name'] == 'Alexandre Souza Barroso'


def test_find_case_insensitive(setup_users):
    db = get_db()
    user = find_user_by_display_name(db, 'BRUNO ACIOLI')
    db.close()
    assert user is not None
    assert user['short_name'] == 'Bruno Acioli'


def test_find_with_trailing_whitespace(setup_users):
    db = get_db()
    user = find_user_by_display_name(db, '  Bruno Acioli  ')
    db.close()
    assert user is not None
    assert user['short_name'] == 'Bruno Acioli'


def test_unapproved_user_excluded_by_default(setup_users):
    db = get_db()
    user = find_user_by_display_name(db, 'Pending')
    db.close()
    assert user is None


def test_unapproved_user_included_when_flag_set(setup_users):
    db = get_db()
    user = find_user_by_display_name(db, 'Pending', require_approved=False)
    db.close()
    assert user is not None
    assert user['short_name'] == 'Pending'


def test_short_name_priority_over_name(setup_users):
    """If a query string matches one user's short_name and another user's name,
    short_name match wins."""
    db = get_db()
    db.execute('''
        INSERT INTO users (email, password_hash, name, short_name, lapen_approved, is_verified)
        VALUES (%s, %s, %s, %s, TRUE, TRUE)
    ''', (f'collision{EMAIL_DOMAIN}', hash_password('x'), 'Bruno Acioli', 'Some Other Nick'))
    db.commit()

    user = find_user_by_display_name(db, 'Bruno Acioli')
    assert user['short_name'] == 'Bruno Acioli'
    db.close()


def test_empty_input_returns_none(setup_users):
    db = get_db()
    assert find_user_by_display_name(db, '') is None
    assert find_user_by_display_name(db, '   ') is None
    assert find_user_by_display_name(db, None) is None
    db.close()


def test_names_match_basic():
    assert names_match('foo', 'foo') is True
    assert names_match('foo', 'bar') is False


def test_names_match_case_insensitive():
    assert names_match('Bruno Acioli', 'bruno acioli') is True
    assert names_match('BRUNO', 'bruno') is True


def test_names_match_trims_whitespace():
    assert names_match('Bruno Acioli ', 'Bruno Acioli') is True
    assert names_match('  Bruno  ', 'Bruno') is True


def test_names_match_handles_none():
    assert names_match(None, '') is True
    assert names_match(None, None) is True
    assert names_match(None, 'foo') is False


def test_users_table_check_constraint_rejects_untrimmed():
    """Migration 013 added CHECK constraints. New rows with whitespace must fail."""
    db = get_db()
    with pytest.raises(Exception):
        db.execute(
            'INSERT INTO users (email, password_hash, name, short_name) VALUES (%s, %s, %s, %s)',
            (f'bad{EMAIL_DOMAIN}', hash_password('x'), '  Untrimmed  ', 'X')
        )
        db.commit()
    db.rollback()
    db.execute("DELETE FROM users WHERE email = %s", (f'bad{EMAIL_DOMAIN}',))
    db.commit()
    db.close()
