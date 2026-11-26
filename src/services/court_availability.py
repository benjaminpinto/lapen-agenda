"""Court availability grid: which standard slots of each court are taken, and by what.

A slot is the 90-minute window [start, start + 90). It is taken by anything that overlaps it:
a booking (also 90 minutes long), a recurring reservation (its own start/end), or a holiday/block
(the whole day when it has no times, otherwise its own start/end; blocks apply to every court).
"""
from datetime import date, datetime, timedelta

from src.utils.time_utils import normalize_time

SLOT_MINUTES = 90


def to_minutes(value):
    hours, minutes = normalize_time(value)[:5].split(':')
    return int(hours) * 60 + int(minutes)


def _overlaps(start_a, end_a, start_b, end_b):
    return start_a < end_b and start_b < end_a


def _iso(value):
    return value if isinstance(value, str) else value.strftime('%Y-%m-%d')


def week_dates(day):
    """The seven dates (Monday to Sunday, ISO strings) of the week that holds `day`."""
    if isinstance(day, str):
        day = datetime.strptime(day, '%Y-%m-%d').date()
    monday = day - timedelta(days=day.weekday())
    return [(monday + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(7)]


def build_cells(dates, slots, courts, schedules, blocks, recurring):
    """Every taken (court, date, slot), with the items that take it. Free slots are left out."""
    cells = []
    for day in dates:
        weekday = date.fromisoformat(day).weekday()
        day_schedules = [s for s in schedules if _iso(s['date']) == day]
        day_blocks = [b for b in blocks if _iso(b['date']) == day]
        day_recurring = [r for r in recurring
                         if r['day_of_week'] == weekday and _iso(r['start_date']) <= day <= _iso(r['end_date'])]

        for slot in slots:
            slot_start = to_minutes(slot)
            slot_end = slot_start + SLOT_MINUTES

            shared = []
            for block in day_blocks:
                if not block['start_time'] or not block['end_time']:
                    shared.append({'kind': 'blocked', 'description': block.get('description') or 'Bloqueado',
                                   'start_time': None, 'end_time': None})
                elif _overlaps(slot_start, slot_end, to_minutes(block['start_time']), to_minutes(block['end_time'])):
                    shared.append({'kind': 'blocked', 'description': block.get('description') or 'Bloqueado',
                                   'start_time': normalize_time(block['start_time'])[:5],
                                   'end_time': normalize_time(block['end_time'])[:5]})

            for court in courts:
                items = list(shared)
                for s in day_schedules:
                    start = to_minutes(s['start_time'])
                    if s['court_id'] == court['id'] and _overlaps(slot_start, slot_end, start, start + SLOT_MINUTES):
                        items.append({'kind': 'booked', 'id': s['id'], 'start_time': normalize_time(s['start_time'])[:5],
                                      'player1_name': s['player1_name'], 'player2_name': s['player2_name'],
                                      'player1_id': s.get('player1_id'), 'player2_id': s.get('player2_id'),
                                      'match_type': s['match_type']})
                recurring_by_description = {}  # hourly reservations of one class collapse into one item
                for r in sorted(day_recurring, key=lambda r: to_minutes(r['start_time'])):
                    if r['court_id'] != court['id'] or not _overlaps(
                            slot_start, slot_end, to_minutes(r['start_time']), to_minutes(r['end_time'])):
                        continue
                    description = r.get('description') or 'Horário fixo'
                    item = recurring_by_description.get(description)
                    if item:
                        item['end_time'] = max(item['end_time'], normalize_time(r['end_time'])[:5])
                    else:
                        item = {'kind': 'recurring', 'description': description,
                                'start_time': normalize_time(r['start_time'])[:5],
                                'end_time': normalize_time(r['end_time'])[:5]}
                        recurring_by_description[description] = item
                        items.append(item)
                if items:
                    cells.append({'court_id': court['id'], 'date': day, 'slot': slot, 'items': items})
    return cells
