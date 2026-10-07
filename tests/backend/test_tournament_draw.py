"""Pure draw algorithms: no database involved."""
import itertools
import os
import random
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from src.services import tournament_draw as draw
from src.services.tournament_draw import DrawError

RNG_SEEDS = range(8)


def pairs_of(lines):
    return [(lines[i], lines[i + 1]) for i in range(0, len(lines), 2)]


def line_of(lines, entry):
    return lines.index(entry) + 1


def section(line, size, parts):
    return (line - 1) * parts // size


def has_bye(lines, entry):
    line = line_of(lines, entry)
    return lines[(line + 1 if line % 2 == 1 else line - 1) - 1] is None


# --- sizes and names ---------------------------------------------------------------------------

@pytest.mark.parametrize('n,size', [(2, 2), (3, 4), (4, 4), (5, 8), (8, 8), (9, 16), (16, 16), (17, 32), (33, 64), (64, 64), (65, 128)])
def test_bracket_size_is_the_next_power_of_two(n, size):
    assert draw.bracket_size(n) == size


@pytest.mark.parametrize('n', [-1, 0, 1])
def test_a_draw_needs_two_entries(n):
    with pytest.raises(DrawError):
        draw.bracket_size(n)


@pytest.mark.parametrize('size,names', [
    (2, ['Final']),
    (4, ['Semifinal', 'Final']),
    (8, ['Quartas de final', 'Semifinal', 'Final']),
    (16, ['Oitavas de final', 'Quartas de final', 'Semifinal', 'Final']),
    (32, ['1ª rodada', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final']),
])
def test_round_names(size, names):
    total = draw.round_count(size)
    assert [draw.round_name(r, total) for r in range(1, total + 1)] == names


def test_labels_of_open_slots():
    assert draw.winner_label(3, 1, 3) == 'Vencedor da final'
    assert draw.winner_label(2, 2, 3) == 'Vencedor da semifinal 2'
    assert draw.winner_label(1, 3, 3) == 'Vencedor das quartas 3'
    assert draw.winner_label(1, 5, 4) == 'Vencedor das oitavas 5'
    assert draw.winner_label(1, 7, 5) == 'Vencedor da 1ª rodada, jogo 7'
    assert draw.qualifier_label(2, 'B') == '2º Grupo B'
    assert [draw.group_name(i) for i in range(3)] == ['A', 'B', 'C']


# --- seed placement (ITF tables) ------------------------------------------------------------------

@pytest.mark.parametrize('size,count,blocks', [
    (4, 2, [[1], [4]]),
    (8, 4, [[1], [8], [3, 6]]),
    (16, 8, [[1], [16], [5, 12], [4, 8, 9, 13]]),
    (32, 8, [[1], [32], [9, 24], [8, 16, 17, 25]]),
    (64, 16, [[1], [64], [17, 48], [16, 32, 33, 49], [8, 9, 24, 25, 40, 41, 56, 57]]),
    (128, 16, [[1], [128], [33, 96], [32, 64, 65, 97], [16, 17, 48, 49, 80, 81, 112, 113]]),
])
def test_seed_blocks_follow_the_itf_tables(size, count, blocks):
    assert draw.seed_blocks(size, count) == blocks


@pytest.mark.parametrize('size', [8, 16, 32, 64])
def test_seed_blocks_are_mirror_symmetric_and_never_share_a_match(size):
    lines = [line for block in draw.seed_blocks(size, size // 2) for line in block]
    assert len(lines) == len(set(lines)) == size // 2
    assert all(size + 1 - line in lines for line in lines)
    assert len({(line - 1) // 2 for line in lines}) == len(lines)  # no two seeds in the same round-1 match


def test_too_many_seeds_are_refused():
    with pytest.raises(DrawError):
        draw.place_seeds(8, 5, random.Random(0))
    with pytest.raises(DrawError):
        draw.build_knockout(list(range(5)), list(range(5)), random.Random(0))  # 5 entries -> size 8 -> at most 4 seeds


# --- single elimination invariants -------------------------------------------------------------------

def check_knockout(lines, entries, seeds):
    n, size = len(entries), draw.bracket_size(len(entries))
    assert len(lines) == size
    placed = [e for e in lines if e is not None]
    assert sorted(placed) == sorted(entries)  # nobody lost, nobody twice
    assert lines.count(None) == size - n
    assert all(a is not None or b is not None for a, b in pairs_of(lines))  # no empty match

    k = len(seeds)
    if k >= 1:
        assert line_of(lines, seeds[0]) == 1
    if k >= 2:
        assert line_of(lines, seeds[1]) == size
    for power in (1, 2, 3, 4):  # seeds 1..2^p sit in 2^p different sections of the bracket
        parts = 2 ** power
        if k >= parts and size >= parts:
            assert len({section(line_of(lines, s), size, parts) for s in seeds[:parts]}) == parts, (size, seeds[:parts], lines)

    byes = size - n
    for number, seed in enumerate(seeds, start=1):
        assert has_bye(lines, seed) == (number <= byes), f'seed {number} bye mismatch'

    # Seeds 9+ and partly filled blocks are drawn by lot among their lines (ITF), so byes given to them can
    # lean to one side. The even spread is guaranteed whenever the seed blocks are complete.
    bye_pairs = [i // 2 for i, e in enumerate(lines) if e is None]
    for parts in (2, 4):
        if size >= parts * 2 and k in (0, 1, 2, 4, 8):
            counts = [sum(1 for p in bye_pairs if section(2 * p + 1, size, parts) == s) for s in range(parts)]
            assert max(counts) - min(counts) <= 1, f'byes not spread over {parts} sections: {counts}'


def seed_counts_for(size):
    return sorted({count for count in (0, 1, 2, 3, 4, 5, 6, 8, 12) if count <= size // 2} | {size // 2})


@pytest.mark.parametrize('n', range(2, 65))
def test_every_draw_size_respects_seeding_byes_and_balance(n):
    entries = [f'e{i}' for i in range(n)]
    size = draw.bracket_size(n)
    for count in seed_counts_for(size):
        for rng_seed in RNG_SEEDS:
            seeds = entries[:count]
            check_knockout(draw.build_knockout(entries, seeds, random.Random(rng_seed)), entries, seeds)


def test_the_same_seed_replays_the_same_draw_and_others_differ():
    entries = list(range(20))
    first = draw.build_knockout(entries, [0, 1, 2, 3], random.Random(42))
    assert draw.build_knockout(entries, [0, 1, 2, 3], random.Random(42)) == first
    outcomes = {tuple(draw.build_knockout(entries, [0, 1, 2, 3], random.Random(s))) for s in range(10)}
    assert len(outcomes) > 5


def test_seed_placement_does_not_depend_on_the_order_of_the_entries():
    seeds = ['s1', 's2', 's3', 's4']
    others = [f'p{i}' for i in range(12)]
    for rng_seed in RNG_SEEDS:
        lines = draw.build_knockout(others + seeds[::-1], seeds, random.Random(rng_seed))
        assert line_of(lines, 's1') == 1 and line_of(lines, 's2') == 16
        assert {line_of(lines, 's3'), line_of(lines, 's4')} == {5, 12}


def test_seeds_three_and_four_are_drawn_between_their_two_lines():
    seen = {tuple(line_of(draw.build_knockout(list(range(16)), [0, 1, 2, 3], random.Random(s)), e) for e in (2, 3)) for s in range(40)}
    assert seen == {(5, 12), (12, 5)}


def test_six_entries_give_the_two_seeds_a_bye_each():
    lines = draw.build_knockout(list('abcdef'), ['a', 'b'], random.Random(3))
    assert lines[0] == 'a' and lines[1] is None
    assert lines[7] == 'b' and lines[6] is None


def test_without_seeds_byes_are_spread_evenly():
    for n in (9, 10, 12, 13, 17, 20, 24, 33, 40):
        for rng_seed in RNG_SEEDS:
            entries = list(range(n))
            check_knockout(draw.build_knockout(entries, [], random.Random(rng_seed)), entries, [])


def test_byes_beyond_the_seeds_go_to_unseeded_matches():
    # 9 entries -> size 16 -> 7 byes, only 2 seeds: both seeds and 5 more matches get one
    entries = list(range(9))
    for rng_seed in RNG_SEEDS:
        lines = draw.build_knockout(entries, [0, 1], random.Random(rng_seed))
        assert has_bye(lines, 0) and has_bye(lines, 1)
        assert sum(1 for pair in pairs_of(lines) if None in pair) == 7


@pytest.mark.parametrize('entries,seeds', [
    ([1, 1, 2], []),
    ([1, 2, 3], [9]),
    ([1, 2, 3], [1, 1]),
])
def test_invalid_knockout_input_is_refused(entries, seeds):
    with pytest.raises(DrawError):
        draw.build_knockout(entries, seeds, random.Random(0))


def test_keeping_apart_falls_back_to_quarters_when_halves_are_impossible():
    # c and d must both avoid a's half, but only one line is left there: the quarter rule still separates them
    for rng_seed in RNG_SEEDS:
        lines = draw.build_knockout(['a', 'b', 'c', 'd'], ['a', 'b'], random.Random(rng_seed), apart=[('c', 'a'), ('d', 'a')])
        assert lines[0] == 'a' and lines[3] == 'b' and sorted(lines[1:3]) == ['c', 'd']


def test_the_search_for_a_placement_gives_up_when_it_runs_out_of_budget():
    assert draw._assign_apart(['x', 'y'], [1, 2], lambda entry, line: True, random.Random(0), budget=1) is None
    assert draw._assign_apart(['x', 'y'], [1, 2], lambda entry, line: True, random.Random(0)) is not None
    assert draw._assign_apart(['x', 'y'], [1], lambda entry, line: True, random.Random(0)) is None  # more entries than lines


# --- groups ------------------------------------------------------------------------------------------

@pytest.mark.parametrize('n,target,sizes', [
    (6, 3, [3, 3]), (6, 4, [3, 3]), (7, 4, [4, 3]), (8, 4, [4, 4]), (8, 3, [4, 4]), (9, 4, [3, 3, 3]),
    (10, 4, [4, 3, 3]), (11, 3, [4, 4, 3]), (12, 4, [4, 4, 4]), (13, 4, [4, 3, 3, 3]), (14, 3, [4, 4, 3, 3]),
])
def test_group_sizes_are_balanced(n, target, sizes):
    assert draw.plan_group_sizes(n, target) == sizes


def test_group_sizes_for_every_supported_case():
    for n, target in itertools.product(range(6, 61), (3, 4)):
        sizes = draw.plan_group_sizes(n, target)
        assert sum(sizes) == n and min(sizes) >= 3 and max(sizes) - min(sizes) <= 1 and max(sizes) <= target + 1


@pytest.mark.parametrize('n,target', [(5, 3), (2, 4), (8, 5), (8, 2)])
def test_groups_need_six_entries_and_a_valid_target(n, target):
    with pytest.raises(DrawError):
        draw.plan_group_sizes(n, target)


def test_seeds_are_dealt_in_a_snake():
    entries = [f'e{i}' for i in range(8)]
    for rng_seed in RNG_SEEDS:
        groups = draw.build_groups(entries, entries[:4], 4, random.Random(rng_seed))
        assert [[e for e in g if e in entries[:4]] for g in groups] == [['e0', 'e3'], ['e1', 'e2']]


def test_groups_hold_everyone_once_and_spread_the_seeds():
    for n, target in itertools.product(range(6, 31), (3, 4)):
        entries = list(range(n))
        sizes = draw.plan_group_sizes(n, target)
        for k in (0, 1, 2, 4, len(sizes)):
            for rng_seed in (0, 1, 2):
                groups = draw.build_groups(entries, entries[:k], target, random.Random(rng_seed))
                assert [len(g) for g in groups] == sizes
                assert sorted(e for g in groups for e in g) == entries
                holders = [i for i, g in enumerate(groups) for e in g if e < min(k, len(sizes))]
                assert len(set(holders)) == min(k, len(sizes))  # the first seeds sit in different groups


@pytest.mark.parametrize('entries,seeds', [([1, 1, 2, 3, 4, 5], []), ([1, 2, 3, 4, 5, 6], [9]), ([1, 2, 3, 4, 5, 6], [1, 1])])
def test_invalid_group_input_is_refused(entries, seeds):
    with pytest.raises(DrawError):
        draw.build_groups(entries, seeds, 3, random.Random(0))


def test_group_draw_is_replayable():
    entries = list(range(10))
    assert draw.build_groups(entries, [0, 1], 4, random.Random(5)) == draw.build_groups(entries, [0, 1], 4, random.Random(5))


# --- round robin --------------------------------------------------------------------------------------

@pytest.mark.parametrize('n', range(2, 13))
def test_round_robin_pairs_everyone_exactly_once(n):
    rounds = draw.round_robin_rounds(list(range(n)))
    assert len(rounds) == (n - 1 if n % 2 == 0 else n)
    matches = [frozenset(pair) for matches in rounds for pair in matches]
    assert len(matches) == n * (n - 1) // 2
    assert len(set(matches)) == len(matches)
    for matches_of_round in rounds:
        players = [p for pair in matches_of_round for p in pair]
        assert len(players) == len(set(players))  # nobody plays twice in a round


def test_round_robin_needs_two_players():
    with pytest.raises(DrawError):
        draw.round_robin_rounds([1])


# --- groups to knockout --------------------------------------------------------------------------------

def group_entries(groups, runners=True):
    names = [draw.group_name(i) for i in range(groups)]
    winners = [(n, f'W{n}') for n in names]
    seconds = [(n, f'R{n}') for n in names] if runners else []
    return names, winners, seconds


def test_two_groups_cross_over_whatever_the_draw():
    _, winners, seconds = group_entries(2)
    for rng_seed in range(30):
        lines = draw.knockout_lines_from_groups(winners, seconds, random.Random(rng_seed))
        assert sorted(sorted(p) for p in pairs_of(lines)) == [['RA', 'WB'], ['RB', 'WA']]
        assert lines[0] == 'WA' and lines[3] == 'WB'


@pytest.mark.parametrize('groups', [2, 4, 8])
def test_a_runner_up_never_shares_a_half_with_its_own_winner(groups):
    _, winners, seconds = group_entries(groups)
    size = 2 * groups
    for rng_seed in range(25):
        lines = draw.knockout_lines_from_groups(winners, seconds, random.Random(rng_seed))
        assert None not in lines
        for name, _ in winners:
            assert section(line_of(lines, f'W{name}'), size, 2) != section(line_of(lines, f'R{name}'), size, 2)
            assert pairs_ok(lines)


def pairs_ok(lines):
    """No round-1 match between two members of the same group."""
    return all(a is None or b is None or a[1:] != b[1:] for a, b in pairs_of(lines))


def test_winners_alone_form_the_bracket_when_one_qualifies_per_group():
    _, winners, _ = group_entries(4, runners=False)
    for rng_seed in range(10):
        lines = draw.knockout_lines_from_groups(winners, [], random.Random(rng_seed))
        assert sorted(lines) == ['WA', 'WB', 'WC', 'WD']
        assert lines[0] == 'WA' and lines[3] == 'WB'  # A and B are seeds 1 and 2


def test_uneven_qualifiers_give_the_byes_to_the_best_campaigns():
    # 3 groups x 2 -> 6 teams -> size 8 -> 2 byes, for the two best winners
    ranked = [('C', 'WC'), ('A', 'WA'), ('B', 'WB')]  # campaign order, not group order
    seconds = [('A', 'RA'), ('B', 'RB'), ('C', 'RC')]
    for rng_seed in range(20):
        lines = draw.knockout_lines_from_groups(ranked, seconds, random.Random(rng_seed))
        assert has_bye(lines, 'WC') and has_bye(lines, 'WA') and not has_bye(lines, 'WB')
        assert lines[0] == 'WC' and lines[7] == 'WA'
        assert lines.count(None) == 2 and sorted(e for e in lines if e) == sorted(['WA', 'WB', 'WC', 'RA', 'RB', 'RC'])


@pytest.mark.parametrize('groups,per_group', [(3, 1), (5, 1), (6, 1), (3, 2), (5, 2), (6, 2), (7, 2)])
def test_every_uneven_layout_builds_a_valid_bracket(groups, per_group):
    _, winners, seconds = group_entries(groups, runners=per_group == 2)
    entries = [e for _, e in winners + seconds]
    size = draw.bracket_size(len(entries))
    for rng_seed in range(20):
        lines = draw.knockout_lines_from_groups(winners, seconds, random.Random(rng_seed))
        assert len(lines) == size and sorted(e for e in lines if e) == sorted(entries)
        assert lines.count(None) == size - len(entries)
        assert all(a is not None or b is not None for a, b in pairs_of(lines))
        top = min(len(winners), size // 2, size - len(entries))
        for _, winner in winners[:top]:
            assert has_bye(lines, winner)  # byes reach the best-ranked winners first
