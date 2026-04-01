import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from src.utils.score_parser import parse_score, validate_score


class TestParseScore:
    def test_two_set_match(self):
        r = parse_score('6-4, 6-3')
        assert r == {'p1_sets': 2, 'p2_sets': 0, 'p1_games': 12, 'p2_games': 7, 'has_super_tiebreak': False}

    def test_three_set_with_super_tiebreak(self):
        r = parse_score('6-4, 4-6, 10-8')
        assert r['p1_sets'] == 2
        assert r['p2_sets'] == 1
        assert r['has_super_tiebreak'] is True

    def test_super_tiebreak_lost(self):
        r = parse_score('6-4, 4-6, 8-10')
        assert r['p2_sets'] == 2
        assert r['has_super_tiebreak'] is True

    def test_no_super_tiebreak_in_two_sets(self):
        r = parse_score('6-4, 6-3')
        assert r['has_super_tiebreak'] is False

    def test_wo_score(self):
        r = parse_score('W.O. - motivo')
        assert r == {'p1_sets': 0, 'p2_sets': 0, 'p1_games': 0, 'p2_games': 0, 'has_super_tiebreak': False}

    def test_empty_score(self):
        r = parse_score('')
        assert r['p1_sets'] == 0

    def test_malformed_set_skipped(self):
        r = parse_score('6-4, abc, 10-8')
        assert r['p1_sets'] == 2  # first + third set counted (abc skipped)
        assert r['has_super_tiebreak'] is True  # 10-8 still detected


class TestValidateScore:
    def test_valid_two_set(self):
        ok, err = validate_score('6-4, 6-3')
        assert ok is True
        assert err is None

    def test_valid_three_set_super_tiebreak(self):
        ok, err = validate_score('6-4, 4-6, 10-8')
        assert ok is True

    def test_valid_wo(self):
        ok, err = validate_score('W.O. - motivo')
        assert ok is True

    def test_zero_zero_set(self):
        ok, err = validate_score('6-4, 0-0')
        assert ok is False
        assert 'Set 0-0' in err

    def test_zero_zero_third_set(self):
        ok, err = validate_score('6-4, 4-6, 0-0')
        assert ok is False

    def test_regular_set_exceeds_max(self):
        ok, err = validate_score('55-7, 6-3')
        assert ok is False
        assert 'máximo 7' in err

    def test_regular_set_tied(self):
        ok, err = validate_score('6-6, 6-3')
        assert ok is False
        assert 'sem vencedor' in err

    def test_super_tiebreak_below_10(self):
        ok, err = validate_score('6-4, 4-6, 9-7')
        assert ok is False
        assert 'mínimo 10' in err

    def test_super_tiebreak_no_two_point_lead(self):
        ok, err = validate_score('6-4, 4-6, 10-9')
        assert ok is False
        assert 'diferença mínima' in err

    def test_third_set_not_needed(self):
        ok, err = validate_score('6-4, 6-3, 10-8')
        assert ok is False
        assert 'já tem vencedor' in err

    def test_third_set_required(self):
        ok, err = validate_score('6-4, 4-6')
        assert ok is False
        assert 'obrigatório' in err

    def test_wrong_number_of_sets(self):
        ok, err = validate_score('6-4')
        assert ok is False

    def test_invalid_format(self):
        ok, err = validate_score('abc, 6-3')
        assert ok is False
        assert 'inválido' in err

    def test_real_bad_data_110(self):
        """Reproduces the bad record id=110 from production"""
        ok, err = validate_score('6-7, 55-7, 0-0')
        assert ok is False

    def test_real_bad_data_111(self):
        """Reproduces the bad record id=111 from production"""
        ok, err = validate_score('6-2, 6-4, 0-0')
        assert ok is False
