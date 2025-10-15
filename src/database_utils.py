"""
Database utility functions for cross-database compatibility
"""
import os
from datetime import time, date, datetime

def get_current_date_sql():
    """Get current date SQL expression for the current database"""
    if os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL'):
        return "CURRENT_DATE"
    return "date('now')"

def get_current_time_sql():
    """Get current time SQL expression for the current database"""
    if os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL'):
        return "CURRENT_TIME"
    return "time('now')"

def get_current_timestamp_sql():
    """Get current timestamp SQL expression for the current database"""
    if os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL'):
        return "CURRENT_TIMESTAMP"
    return "datetime('now')"

def get_month_comparison_sql(date_column):
    """Get month comparison SQL for the current database"""
    if os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL'):
        return f"DATE_TRUNC('month', {date_column}) = DATE_TRUNC('month', CURRENT_DATE)"
    return f"strftime('%Y-%m', {date_column}) = strftime('%Y-%m', 'now')"

def get_boolean_true():
    """Get boolean true value for the current database"""
    if os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL'):
        return True
    return 1

def get_boolean_false():
    """Get boolean false value for the current database"""
    if os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL'):
        return False
    return 0

def get_concat_sql(*args):
    """Get string concatenation SQL for the current database"""
    if os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL'):
        return f"CONCAT({', '.join(args)})"
    return ' || '.join(args)

def is_postgres():
    """Check if using PostgreSQL"""
    return bool(os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL'))

def row_to_dict(row):
    """Convert database row to dictionary (handles both dict-like and tuple rows)"""
    if row is None:
        return None
    if hasattr(row, 'keys'):
        result = {}
        for k in row.keys():
            v = row[k]
            if isinstance(v, time):
                result[k] = v.strftime('%H:%M')
            elif isinstance(v, date) and not isinstance(v, datetime):
                result[k] = v.strftime('%Y-%m-%d')
            elif isinstance(v, datetime):
                result[k] = v.isoformat()
            else:
                result[k] = v
        return result
    if isinstance(row, (list, tuple)):
        return dict(enumerate(row))
    return dict(row)

def rows_to_dicts(rows):
    """Convert list of database rows to list of dictionaries"""
    return [row_to_dict(row) for row in rows]
