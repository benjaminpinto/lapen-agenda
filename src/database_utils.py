"""
Database utility functions
"""

def row_to_dict(row):
    """Convert database row to JSON-serializable dict"""
    from datetime import date, time, datetime
    result = dict(row)
    for key, value in result.items():
        if isinstance(value, (date, time, datetime)):
            result[key] = str(value)
    return result