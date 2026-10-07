"""Group standings (ATP order): pure, no database."""
import itertools
import os
import random
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from src.services.tournament_standings import campaign_order, compute_standings
from src.utils.score_parser import parse_tournament_score


def res(a, b, score, outcome='normal', winner=None, fmt='best_of_3_super_tb'):
    """A finished match; the score is written from a's side. The winner follows the sets unless given."""
    if winner is None:
        parsed = parse_tournament_score(score, fmt)
        winner = a if parsed['p1_sets'] > parsed['p2_sets'] else b
    return {'entry1': a, 'entry2': b, 'status': 'completed', 'outcome': outcome, 'winner': winner, 'score': score}


def todo(a, b):
    return {'entry1': a, 'entry2': b, 'status': 'pending', 'outcome': None, 'winner': None, 'score': None}


def order(result):
    return [row['entry'] for row in result['rows']]


def by_entry(result):
    return {row['entry']: row for row in result['rows']}


WIN = '6-0, 6-0'


# --- ordering ---------------------------------------------------------------------------------

def test_a_clear_table_and_the_qualifying_places():
    matches = [res('A', 'B', WIN), res('A', 'C', WIN), res('A', 'D', WIN), res('B', 'C', WIN), res('B', 'D', WIN), res('C', 'D', WIN)]
    result = compute_standings(list('DCBA'), matches, qualifiers=2)
    assert order(result) == ['A', 'B', 'C', 'D']
    assert [(r['position'], r['state']) for r in result['rows']] == [(1, 'qualified'), (2, 'qualified'), (3, 'eliminated'), (4, 'eliminated')]
    assert (result['complete'], result['blocked'], result['confirmed'], result['ties']) == (True, False, True, [])
    a, d = by_entry(result)['A'], by_entry(result)['D']
    assert (a['wins'], a['losses'], a['sets_won'], a['sets_lost'], a['games_won'], a['games_lost']) == (3, 0, 6, 0, 36, 0)
    assert (d['wins'], d['losses'], d['sets_pct'], d['games_pct']) == (0, 3, 0.0, 0.0)


def test_a_super_tiebreak_counts_as_one_set_and_one_game():
    result = compute_standings(['A', 'B'], [res('A', 'B', '6-4, 3-6, 10-8')], qualifiers=1)
    a, b = by_entry(result)['A'], by_entry(result)['B']
    assert (a['sets_won'], a['sets_lost'], a['games_won'], a['games_lost']) == (2, 1, 10, 10)  # 6+3+1 and 4+6+0
    assert (b['sets_won'], b['sets_lost'], b['games_won'], b['games_lost']) == (1, 2, 10, 10)


def cycle_with_a_clear_leader():
    """A, B and C beat each other in a cycle and all beat D. B and C end level on sets, C ahead on games."""
    return [
        res('A', 'B', '6-1, 6-1'), res('B', 'C', '6-4, 6-4'), res('C', 'A', '6-4, 3-6, 10-8'),
        res('A', 'D', WIN), res('B', 'D', '6-4, 3-6, 10-8'), res('C', 'D', WIN),
    ]


def test_a_three_way_tie_goes_back_to_head_to_head_once_one_player_is_split_off():
    result = compute_standings(list('ABCD'), cycle_with_a_clear_leader(), qualifiers=2)
    rows = by_entry(result)
    assert (rows['A']['wins'], rows['B']['wins'], rows['C']['wins']) == (2, 2, 2)
    assert rows['A']['sets_pct'] > rows['B']['sets_pct'] == rows['C']['sets_pct']  # 5/7 against 4/7 and 4/7
    assert rows['C']['games_pct'] > rows['B']['games_pct']  # C is better on games...
    assert order(result) == ['A', 'B', 'C', 'D']  # ...but B beat C, and head-to-head comes before games
    assert result['confirmed'] is True


def test_head_to_head_beats_sets_for_two_players_tied():
    # A and B both finish 2-1; A beat B but has the worse sets percentage
    matches = [
        res('A', 'B', '7-5, 7-5'), res('A', 'C', '6-4, 3-6, 10-8'), res('D', 'A', '6-0, 6-0'),
        res('B', 'C', WIN), res('B', 'D', WIN), res('C', 'D', '6-4, 6-4'),
    ]
    result = compute_standings(list('ABCD'), matches, qualifiers=2)
    rows = by_entry(result)
    assert rows['A']['wins'] == rows['B']['wins'] == 2 and rows['B']['sets_pct'] > rows['A']['sets_pct']
    assert order(result)[:2] == ['A', 'B']


def test_more_matches_played_beats_fewer_with_the_same_wins():
    matches = [res('A', 'B', WIN), res('A', 'C', WIN), res('B', 'C', WIN), res('B', 'D', WIN), todo('A', 'D'), todo('C', 'D')]
    result = compute_standings(list('ABCD'), matches, qualifiers=2)
    assert order(result) == ['B', 'A', 'C', 'D']  # B is 2-1 (3 played), A is 2-0 (2 played)
    assert result['complete'] is False and result['confirmed'] is False
    assert [r['state'] for r in result['rows']] == ['provisional', 'provisional', 'open', 'open']


def test_a_walkover_is_a_win_but_not_a_match_played_and_adds_no_sets_or_games():
    matches = [res('A', 'B', 'W.O.', 'wo', winner='A'), res('B', 'C', WIN), res('C', 'A', WIN)]
    result = compute_standings(list('ABC'), matches, qualifiers=1)
    rows = by_entry(result)
    assert (rows['A']['wins'], rows['A']['played'], rows['A']['played_on_court']) == (1, 2, 1)
    assert (rows['B']['losses'], rows['B']['sets_won'], rows['B']['sets_lost']) == (1, 2, 0)  # only the match against C
    # all three have one win: C played twice on court, then A and B are split by their head-to-head (the walkover)
    assert order(result) == ['C', 'A', 'B']


def test_a_double_walkover_is_a_loss_for_both_and_decides_nothing():
    matches = [res('A', 'B', WIN), res('A', 'C', WIN), res('B', 'C', 'W.O.', 'double_wo', winner=None)]
    result = compute_standings(list('ABC'), matches, qualifiers=1)
    rows = by_entry(result)
    assert (rows['B']['wins'], rows['B']['losses'], rows['B']['played'], rows['B']['played_on_court']) == (0, 2, 2, 1)
    assert (rows['C']['wins'], rows['C']['losses'], rows['C']['played'], rows['C']['played_on_court']) == (0, 2, 2, 1)
    assert order(result)[0] == 'A'
    assert rows['B']['tied'] and rows['C']['tied'] and rows['B']['position'] == rows['C']['position'] == 2


def test_a_retirement_keeps_what_was_played():
    result = compute_standings(['A', 'B'], [res('A', 'B', '6-4, 2-1 ret.', 'retired', winner='A')], qualifiers=1)
    a, b = by_entry(result)['A'], by_entry(result)['B']
    assert (a['wins'], a['played_on_court'], a['sets_won'], a['sets_lost'], a['games_won'], a['games_lost']) == (1, 1, 1, 0, 8, 5)
    assert (b['losses'], b['sets_won'], b['games_won'], b['games_lost']) == (1, 0, 5, 8)


def test_other_formats_count_their_own_sets():
    result = compute_standings(['A', 'B'], [res('A', 'B', '8-6', fmt='pro_set_8')], qualifiers=1, match_format='pro_set_8')
    a = by_entry(result)['A']
    assert (a['sets_won'], a['games_won'], a['games_lost']) == (1, 8, 6)


# --- ties the criteria cannot break ----------------------------------------------------------------------

def identical_cycle():
    return [res('A', 'B', '6-4, 6-4'), res('B', 'C', '6-4, 6-4'), res('C', 'A', '6-4, 6-4')]


def test_a_tie_nothing_can_break_blocks_the_group_until_the_organizer_decides():
    result = compute_standings(list('ABC'), identical_cycle(), qualifiers=1)
    assert [(r['position'], r['tied'], r['state']) for r in result['rows']] == [(1, True, 'tie_pending')] * 3
    assert (result['complete'], result['blocked'], result['confirmed']) == (True, True, False)
    assert result['ties'] == [{'entries': ['A', 'B', 'C'], 'relevant': True}]

    decided = compute_standings(list('ABC'), identical_cycle(), qualifiers=1, manual_ranks={'B': 1, 'C': 2, 'A': 3})
    assert order(decided) == ['B', 'C', 'A']
    assert [(r['position'], r['state']) for r in decided['rows']] == [(1, 'qualified'), (2, 'eliminated'), (3, 'eliminated')]
    assert (decided['blocked'], decided['confirmed'], decided['ties']) == (False, True, [])


@pytest.mark.parametrize('ranks', [{'B': 1, 'C': 2}, {'A': 1, 'B': 1, 'C': 2}, {}])
def test_an_incomplete_or_repeated_decision_leaves_the_tie_open(ranks):
    result = compute_standings(list('ABC'), identical_cycle(), qualifiers=1, manual_ranks=ranks)
    assert result['blocked'] is True and all(r['tied'] for r in result['rows'])


def test_a_tie_beyond_the_qualifying_places_does_not_block():
    base = [res('A', 'B', WIN), res('A', 'C', WIN), res('A', 'D', WIN), res('B', 'C', WIN), res('B', 'D', WIN)]
    matches = base + [res('C', 'D', 'W.O.', 'double_wo', winner=None)]
    two = compute_standings(list('ABCD'), matches, qualifiers=2)
    assert two['ties'] == [{'entries': ['C', 'D'], 'relevant': False}]
    assert (two['blocked'], two['confirmed']) == (False, True)
    assert [r['state'] for r in two['rows']] == ['qualified', 'qualified', 'eliminated', 'eliminated']

    three = compute_standings(list('ABCD'), matches, qualifiers=3)  # now third place is at stake
    assert three['blocked'] is True
    assert [r['state'] for r in three['rows']][2:] == ['tie_pending', 'tie_pending']


# --- states while the group is being played -------------------------------------------------------------------

def test_nobody_advances_provisionally_without_a_win():
    nothing = compute_standings(list('ABCD'), [todo(a, b) for a, b in itertools.combinations('ABCD', 2)], qualifiers=2)
    assert {r['state'] for r in nothing['rows']} == {'open'} and {r['position'] for r in nothing['rows']} == {1}

    one = compute_standings(list('ABCD'), [res('A', 'B', WIN)] + [todo(a, b) for a, b in itertools.combinations('ABCD', 2) if (a, b) != ('A', 'B')],
                            qualifiers=2)
    assert order(one)[:2] == ['A', 'B']
    assert [r['state'] for r in one['rows']][:2] == ['provisional', 'open']


def test_a_tie_that_spans_the_cut_is_open_not_provisional():
    matches = [res('A', 'B', WIN), res('A', 'C', WIN), todo('A', 'D'), todo('B', 'C'), todo('B', 'D'), todo('C', 'D')]
    result = compute_standings(list('ABCD'), matches, qualifiers=2)
    states = {r['entry']: r['state'] for r in result['rows']}
    assert states['A'] == 'provisional' and states['B'] == states['C'] == 'open'


# --- properties --------------------------------------------------------------------------------------------------

SCORES_FOR_FIRST = ['6-0, 6-0', '6-4, 6-3', '7-5, 6-4', '6-4, 3-6, 10-8']
SCORES_FOR_SECOND = ['0-6, 0-6', '4-6, 3-6', '5-7, 4-6', '4-6, 6-3, 7-10']


def random_group(rng, size):
    players = [chr(65 + i) for i in range(size)]
    matches = []
    for a, b in itertools.combinations(players, 2):
        score = rng.choice(SCORES_FOR_FIRST if rng.random() < 0.5 else SCORES_FOR_SECOND)
        matches.append(res(a, b, score))
    return players, matches


@pytest.mark.parametrize('size', [3, 4, 5, 6])
def test_the_table_does_not_depend_on_the_order_of_the_input(size):
    rng = random.Random(size)
    for _ in range(150):
        players, matches = random_group(rng, size)
        reference = compute_standings(players, matches, qualifiers=2)
        wins = [r['wins'] for r in reference['rows']]
        assert wins == sorted(wins, reverse=True)
        assert sorted(r['entry'] for r in reference['rows']) == players
        assert reference['complete'] is True
        for _ in range(3):
            shuffled_players, shuffled_matches = players[:], matches[:]
            rng.shuffle(shuffled_players)
            rng.shuffle(shuffled_matches)
            again = compute_standings(shuffled_players, shuffled_matches, qualifiers=2)
            assert [(r['entry'], r['position'], r['state']) for r in again['rows']] == [(r['entry'], r['position'], r['state']) for r in reference['rows']]


# --- campaign across groups ---------------------------------------------------------------------------------------

def row(wins, losses, sets=(0, 0), games=(0, 0)):
    return {'wins': wins, 'losses': losses, 'sets_won': sets[0], 'sets_lost': sets[1], 'games_won': games[0], 'games_lost': games[1]}


def test_campaign_compares_win_rates_because_groups_differ_in_size():
    ordered = campaign_order([('A', row(2, 1, (5, 3))), ('B', row(2, 0, (4, 0)))])  # B is a group of 3
    assert [name for name, _ in ordered] == ['B', 'A']


def test_campaign_falls_back_to_sets_then_games_then_group_order():
    ordered = campaign_order([
        ('A', row(2, 0, (4, 1), (30, 20))), ('B', row(2, 0, (4, 0), (30, 20))),
        ('C', row(2, 0, (4, 1), (31, 20))), ('D', row(2, 0, (4, 1), (31, 20))),
    ])
    assert [name for name, _ in ordered] == ['B', 'C', 'D', 'A']
