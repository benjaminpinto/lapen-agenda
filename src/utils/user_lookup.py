"""User name resolution helpers.

Single source of truth for matching a "someone typed a name" string to a user
row. Centralizes the case + trim normalization that was previously duplicated
in 5 different SQL queries with subtly different rules.
"""


def find_user_by_display_name(db, display_name, require_approved=True):
    """Resolve a display string to a user row.

    Matches against either short_name or name, both normalized via LOWER+TRIM.
    Tie-break favors short_name match over name match. Returns None if no match
    or input is empty.
    """
    if not display_name or not display_name.strip():
        return None

    where_approved = 'AND lapen_approved = TRUE' if require_approved else ''
    return db.execute(f'''
        SELECT id, name, short_name FROM users
        WHERE (LOWER(TRIM(short_name)) = LOWER(TRIM(%s))
            OR LOWER(TRIM(name)) = LOWER(TRIM(%s)))
          AND deleted_at IS NULL
          {where_approved}
        ORDER BY (CASE WHEN LOWER(TRIM(short_name)) = LOWER(TRIM(%s)) THEN 0 ELSE 1 END), id
        LIMIT 1
    ''', (display_name, display_name, display_name)).fetchone()


def names_match(a, b):
    """Compare two display strings using the same normalization as find_user_by_display_name.

    Use this anywhere code asks "is this name the same as that name?" — never
    plain `==` on user-supplied or DB-stored display strings.
    """
    return (a or '').strip().lower() == (b or '').strip().lower()
