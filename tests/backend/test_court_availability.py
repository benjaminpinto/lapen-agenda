"""The court availability grid: what takes each 90-minute slot of each court."""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from src.services.court_availability import build_cells, week_dates

SLOTS = ['07:30', '09:00', '15:00', '16:30', '18:00', '19:30']
COURTS = [{'id': 1, 'name': 'Q1', 'type': 'Saibro'}, {'id': 2, 'name': 'Q2', 'type': 'Saibro'}]
MONDAY = '2026-11-23'


def cells_of(schedules=(), blocks=(), recurring=(), dates=(MONDAY,)):
    cells = build_cells(list(dates), SLOTS, COURTS, list(schedules), list(blocks), list(recurring))
    return {(c['court_id'], c['date'], c['slot']): c['items'] for c in cells}


def booking(court_id, start_time, day=MONDAY, **extra):
    return {'id': 7, 'court_id': court_id, 'date': day, 'start_time': start_time,
            'player1_name': 'Ana', 'player2_name': 'Bia', 'match_type': 'Amistoso', **extra}


def test_week_dates_run_monday_to_sunday():
    assert week_dates('2026-11-26') == [f'2026-11-{d}' for d in range(23, 30)]
    assert week_dates('2026-11-29')[0] == MONDAY


def test_free_week_has_no_cells():
    assert cells_of() == {}


def test_booking_takes_only_its_own_slot_and_court():
    cells = cells_of(schedules=[booking(1, '16:30')])
    assert list(cells) == [(1, MONDAY, '16:30')]
    assert cells[(1, MONDAY, '16:30')][0]['kind'] == 'booked'
    assert cells[(1, MONDAY, '16:30')][0]['player1_name'] == 'Ana'


def test_booking_carries_player_ids_so_the_grid_knows_whose_game_it_is():
    item = cells_of(schedules=[booking(1, '16:30', player1_id=3, player2_id=None)])[(1, MONDAY, '16:30')][0]
    assert (item['player1_id'], item['player2_id']) == (3, None)


def test_off_grid_booking_takes_both_slots_it_overlaps():
    cells = cells_of(schedules=[booking(2, '16:00')])
    assert set(cells) == {(2, MONDAY, '15:00'), (2, MONDAY, '16:30')}


def test_full_day_block_takes_every_slot_of_every_court():
    cells = cells_of(blocks=[{'date': MONDAY, 'start_time': None, 'end_time': None, 'description': 'Feriado'}])
    assert len(cells) == len(SLOTS) * len(COURTS)
    assert cells[(2, MONDAY, '07:30')][0] == {'kind': 'blocked', 'description': 'Feriado',
                                              'start_time': None, 'end_time': None}


def test_partial_block_takes_only_overlapping_slots():
    cells = cells_of(blocks=[{'date': MONDAY, 'start_time': '08:00', 'end_time': '10:00', 'description': 'Manutenção'}])
    assert {slot for _, _, slot in cells} == {'07:30', '09:00'}


def test_recurring_applies_on_its_weekday_inside_its_date_range_only():
    rec = {'court_id': 1, 'day_of_week': 0, 'start_time': '18:00', 'end_time': '19:30', 'description': 'Aula',
           'start_date': '2026-02-01', 'end_date': '2026-12-31'}
    tuesday = '2026-11-24'
    cells = cells_of(recurring=[rec], dates=[MONDAY, tuesday])
    assert list(cells) == [(1, MONDAY, '18:00')]
    assert cells_of(recurring=[{**rec, 'end_date': '2026-11-22'}]) == {}


def test_hourly_recurring_of_one_class_collapses_into_one_item():
    rec = {'court_id': 1, 'day_of_week': 0, 'description': 'Aula', 'start_date': '2026-01-01', 'end_date': '2026-12-31'}
    cells = cells_of(recurring=[{**rec, 'start_time': '18:00', 'end_time': '19:30'},
                                {**rec, 'start_time': '19:00', 'end_time': '20:30'}])
    items = cells[(1, MONDAY, '18:00')]
    assert items == [{'kind': 'recurring', 'description': 'Aula', 'start_time': '18:00', 'end_time': '20:30'}]
    assert len(cells[(1, MONDAY, '19:30')]) == 1
