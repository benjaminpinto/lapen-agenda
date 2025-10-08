"""
Database utility functions for cross-database compatibility
"""
import os

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