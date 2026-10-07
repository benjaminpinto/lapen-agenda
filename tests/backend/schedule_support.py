"""Shared scenario for the schedule tests: a started tournament with two test courts, and a thin client for its schedule."""
from types import SimpleNamespace

import pytest
from backend.tournament_support import ensure_courts, started_tournament

DAY1, DAY2, DAY3 = '2099-02-10', '2099-02-11', '2099-02-12'


class Event(SimpleNamespace):
    """A started tournament (8 entries: 2 groups of 4, then semifinals and a final) with two test courts."""

    def url(self, path=''):
        return f'/api/admin/tournaments/{self.tid}/schedule{path}'

    def get(self):
        response = self.client.get(self.url(), headers=self.h)
        assert response.status_code == 200, response.get_json()
        return response.get_json()

    def call(self, method, path, body=None):
        return getattr(self.client, method)(self.url(path), json=body, headers=self.h)

    def session(self, day=DAY1, start='08:00', end='17:00', courts=None):
        return self.call('post', '/sessions', {'date': day, 'start': start, 'end': end, 'court_ids': courts or self.courts})

    def place(self, match_id, court, day, time, force=False):
        return self.call('post', '/place', {'match_id': match_id, 'court_id': court, 'date': day, 'time': time, 'force': force})

    def swap(self, first, second, force=False):
        return self.call('post', '/swap', {'match_id': first, 'other_match_id': second, 'force': force})

    def matches(self, **where):
        found = self.get()['matches']
        return [m for m in found if all(m[k] == v for k, v in where.items())]

    def window_of(self, match_id):
        return next(m for m in self.get()['matches'] if m['id'] == match_id)['window']

    def players(self, match):
        return [side['registration_id'] for side in match['sides']]


@pytest.fixture
def event(client, people):
    courts = ensure_courts(2)
    tournament, category, ids = started_tournament(
        client, people.admin.headers, 8, 'Test Tourn Sched', draw_format='groups_knockout', group_target_size=4, qualifiers_per_group=2)
    ev = Event(client=client, h=people.admin.headers, t=tournament, tid=tournament['id'], c=category, courts=courts, ids=ids)
    return ev


def group_matches(ev, round_number=None):
    return [m for m in ev.matches(stage='group') if round_number in (None, m['round_number'])]


def first_pair_of_one_player(ev):
    """Two group matches sharing a player."""
    groups = group_matches(ev)
    for first in groups:
        for second in groups:
            if first['id'] < second['id'] and set(ev.players(first)) & set(ev.players(second)):
                return first, second
    raise AssertionError('no shared player')


def disjoint_pair(ev):
    """Two group matches with no player in common."""
    groups = group_matches(ev)
    for first in groups:
        for second in groups:
            if first['id'] < second['id'] and not set(ev.players(first)) & set(ev.players(second)):
                return first, second
    raise AssertionError('no disjoint pair')
