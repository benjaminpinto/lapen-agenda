def normalize_time(time_value):
    """Convert time to string format for comparison"""
    if isinstance(time_value, str):
        return time_value
    elif hasattr(time_value, 'strftime'):
        return time_value.strftime('%H:%M')
    return str(time_value)
