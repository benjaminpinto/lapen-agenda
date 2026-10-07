from datetime import datetime, timedelta, timezone


def normalize_time(time_value):
    """Convert time to string format for comparison"""
    if isinstance(time_value, str):
        return time_value
    elif hasattr(time_value, 'strftime'):
        return time_value.strftime('%H:%M')
    return str(time_value)


try:
    from zoneinfo import ZoneInfo
    _LOCAL_TZ = ZoneInfo('America/Sao_Paulo')
except Exception:  # zoneinfo or tz database unavailable: Brazil has had no DST since 2019
    _LOCAL_TZ = timezone(timedelta(hours=-3))


def local_now():
    """Current wall-clock time in Brazil as a naive datetime.

    The database server runs in UTC, but dates and times typed by admins (schedules,
    tournament registration windows) are naive Brazil local time.
    """
    return datetime.now(_LOCAL_TZ).replace(tzinfo=None)
