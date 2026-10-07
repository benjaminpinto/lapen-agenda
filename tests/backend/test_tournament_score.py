"""Score rules of the tournament module (extensions of src/utils/score_parser.py)."""
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from src.utils.score_parser import (
    parse_tournament_score, strip_retirement, validate_retired_score, validate_score,
)


def ok(result):
    return result[0]


# --- the original behaviour is untouched ---------------------------------------------------------------

@pytest.mark.parametrize('score', ['6-5, 6-4', '7-3, 6-4', '6-4, 4-6, 10-8'])
def test_the_default_validator_stays_lenient(score):
    assert ok(validate_score(score))


# --- strict sets (used by tournaments) --------------------------------------------------------------------

@pytest.mark.parametrize('score,valid', [
    ('6-0, 6-4', True), ('7-5, 6-4', True), ('7-6, 6-7', False), ('6-7, 7-6, 10-8', True), ('6-4, 4-6, 10-8', True),
    ('6-5, 6-4', False), ('7-4, 6-4', False), ('7-7, 6-4', False), ('5-4, 6-4', False),
])
def test_strict_mode_only_accepts_sets_that_can_end(score, valid):
    assert ok(validate_score(score, strict=True)) is valid


def test_strict_mode_explains_what_is_wrong():
    assert 'termina em 6' in validate_score('6-5, 6-4', strict=True)[1]


# --- match tiebreak points ----------------------------------------------------------------------------------

@pytest.mark.parametrize('points,score,valid', [
    (10, '6-4, 3-6, 10-8', True), (10, '6-4, 3-6, 7-5', False), (7, '6-4, 3-6, 7-5', True), (7, '6-4, 3-6, 7-6', False),
    (10, '6-4, 3-6, 11-9', True), (10, '6-4, 3-6, 10-9', False),
])
def test_the_super_tiebreak_points_are_a_parameter(points, score, valid):
    assert ok(validate_score(score, super_tiebreak_points=points, strict=True)) is valid


def test_the_message_names_the_configured_points():
    assert 'mínimo 7 pontos' in validate_score('6-4, 3-6, 6-4', super_tiebreak_points=7)[1]
    assert 'mínimo 10 pontos' in validate_score('6-4, 3-6, 6-4')[1]  # the original text


# --- one-set formats -------------------------------------------------------------------------------------------

@pytest.mark.parametrize('score,valid', [('8-0', True), ('8-6', True), ('9-8', True), ('8-7', False), ('7-5', False), ('9-7', False), ('8-6, 6-4', False)])
def test_pro_set_to_eight(score, valid):
    assert ok(validate_score(score, 'pro_set_8')) is valid


@pytest.mark.parametrize('score,valid', [('6-0', True), ('6-4', True), ('7-5', True), ('7-6', True), ('6-5', False), ('7-4', False), ('5-3', False), ('6-4, 6-4', False)])
def test_single_set_to_six(score, valid):
    assert ok(validate_score(score, 'single_set_6')) is valid


@pytest.mark.parametrize('fmt', ['pro_set_8', 'single_set_6'])
def test_a_one_set_score_must_be_numbers(fmt):
    assert not ok(validate_score('abc', fmt))
    assert ok(validate_score('W.O.', fmt))


# --- retirement ---------------------------------------------------------------------------------------------------

@pytest.mark.parametrize('score,valid', [
    ('2-1', True), ('6-4, 2-1', True), ('6-4, 6-6', True), ('6-4, 3-6, 5-3', True), ('4-6, 6-4', True), ('6-4, 3-6', True),
    ('6-4, 6-3', False),                  # already decided
    ('6-4, 3-6, 10-8', False),            # already decided by the super tiebreak
    ('2-1, 6-4', False),                  # only the last set may be unfinished
    ('6-4, 2-1, 5-3', False),             # a third set needs 1-1 in finished sets
    ('0-0', False), ('', False), ('6-4, 3-6, 5-3, 1-0', False), ('9-1', False), ('x', False),
])
def test_retirement_scores(score, valid):
    assert ok(validate_retired_score(score)) is valid


def test_a_retired_one_set_match_can_only_be_unfinished():
    assert ok(validate_retired_score('5-4', 'single_set_6'))
    assert not ok(validate_retired_score('6-4', 'single_set_6'))  # the set was over: the match was too
    assert ok(validate_retired_score('6-6', 'pro_set_8')) is True and not ok(validate_retired_score('8-6', 'pro_set_8'))
    assert not ok(validate_retired_score('2-1, 3-2', 'pro_set_8'))


def test_retirement_suffix_is_optional_in_validation():
    assert ok(validate_retired_score('6-4, 2-1 ret.'))
    assert strip_retirement('6-4, 2-1 ret.') == ('6-4, 2-1', True)
    assert strip_retirement('6-4, 6-3') == ('6-4, 6-3', False)
    assert strip_retirement(None) == ('', False)


# --- counting sets and games ---------------------------------------------------------------------------------------

def counted(score, *args):
    parsed = parse_tournament_score(score, *args)
    return parsed['p1_sets'], parsed['p2_sets'], parsed['p1_games'], parsed['p2_games']


@pytest.mark.parametrize('score,expected', [
    ('6-4, 6-3', (2, 0, 12, 7)),
    ('6-4, 3-6, 10-8', (2, 1, 10, 10)),      # the super tiebreak is 1 set and 1 game, its points are not games
    ('4-6, 6-3, 7-10', (1, 2, 4 + 6 + 0, 6 + 3 + 1)),
    ('7-6, 6-7, 10-2', (2, 1, 7 + 6 + 1, 6 + 7)),
    ('W.O.', (0, 0, 0, 0)),
    ('', (0, 0, 0, 0)),
    (None, (0, 0, 0, 0)),
])
def test_counting_a_normal_result(score, expected):
    assert counted(score) == expected


@pytest.mark.parametrize('score,expected', [
    ('6-4, 2-1 ret.', (1, 0, 8, 5)),          # the unfinished set adds games but no set
    ('3-2 ret.', (0, 0, 3, 2)),
    ('6-4, 3-6, 5-3 ret.', (1, 1, 9, 10)),    # an unfinished super tiebreak adds nothing
    ('4-6, 6-4 ret.', (1, 1, 10, 10)),
])
def test_counting_a_retired_result(score, expected):
    assert counted(score) == expected
    assert parse_tournament_score(score)['retired'] is True


def test_counting_other_formats_and_points():
    assert counted('8-6', 'pro_set_8') == (1, 0, 8, 6)
    assert counted('7-5', 'single_set_6') == (1, 0, 7, 5)
    assert counted('6-4, 3-6, 7-5', 'best_of_3_super_tb', 7) == (2, 1, 10, 10)
    assert counted('6-4, 3-6, 7-5') == (1, 1, 9, 10)  # 7-5 does not finish a 10-point super tiebreak
