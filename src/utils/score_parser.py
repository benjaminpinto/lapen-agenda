"""Score parsing utilities for unified match results"""

SET_SCORE_ERRORS = {
    'invalid_format': 'Formato de set inválido: {set}',
    'zero_zero': 'Set 0-0 não é válido',
    'regular_set_max': 'Set regular inválido: {set} (máximo 7 games)',
    'regular_set_no_winner': 'Set regular sem vencedor claro: {set}',
    'super_tiebreak_min': 'Super tiebreak inválido: {set} (mínimo {points} pontos)',
    'super_tiebreak_no_winner': 'Super tiebreak sem vencedor claro: {set} (diferença mínima de 2)',
    'third_set_not_needed': 'Terceiro set informado mas placar já tem vencedor nos dois primeiros sets',
    'third_set_required': 'Terceiro set obrigatório quando sets estão empatados em 1-1',
    'regular_set_incomplete': 'Set inválido: {set} (um set termina em 6 com 2 de diferença, 7-5 ou 7-6)',
    'single_set_count': 'Este formato tem um único set',
    'single_set_invalid': 'Placar inválido: {set} ({rule})',
    'retired_set_incomplete': 'Só o último set pode estar incompleto na desistência: {set}',
    'retired_decided': 'Com esse placar a partida já estava decidida: não houve desistência',
    'retired_too_many_sets': 'Placar com sets demais para o formato',
}

# Formats of a single set: name -> (rule description, completeness test on (winner games, loser games))
SINGLE_SET_FORMATS = {
    'pro_set_8': ('set pro: 8-0 a 8-6 ou 9-8', lambda hi, lo: (hi == 8 and lo <= 6) or (hi == 9 and lo == 8)),
    'single_set_6': ('set único: 6-0 a 6-4, 7-5 ou 7-6', lambda hi, lo: (hi == 6 and lo <= 4) or (hi == 7 and lo in (5, 6))),
}


def _is_complete_regular_set(g1, g2):
    hi, lo = max(g1, g2), min(g1, g2)
    return (hi == 6 and lo <= 4) or (hi == 7 and lo in (5, 6))


def _is_complete_super_tiebreak(g1, g2, points=10):
    return max(g1, g2) >= points and abs(g1 - g2) >= 2


def _parse_set(part):
    g1, g2 = map(int, part.split('-'))
    return g1, g2

def validate_score(score_text, match_format='best_of_3_super_tb', super_tiebreak_points=10, strict=False):
    """
    Validate score text for logical consistency.
    Returns (is_valid, error_message).

    Defaults keep the original behaviour (best of 3 with a 10-point super tiebreak, lenient sets).
    Tournaments pass their own format and points, and strict=True to accept only sets that can really end
    (6-0..6-4, 7-5, 7-6) instead of anything up to 7 games.
    """
    if not score_text or score_text.startswith('W.O.'):
        return True, None

    if match_format in SINGLE_SET_FORMATS:
        return _validate_single_set(score_text, match_format)

    parts = [s.strip() for s in score_text.split(',')]
    if len(parts) < 2 or len(parts) > 3:
        return False, 'Placar deve ter 2 ou 3 sets'

    parsed_sets = []
    for i, part in enumerate(parts):
        try:
            g1, g2 = map(int, part.split('-'))
        except (ValueError, AttributeError):
            return False, SET_SCORE_ERRORS['invalid_format'].format(set=part)

        if g1 == 0 and g2 == 0:
            return False, SET_SCORE_ERRORS['zero_zero']

        is_super_tiebreak = i == 2  # third set is always super tiebreak
        if is_super_tiebreak:
            if max(g1, g2) < super_tiebreak_points:
                return False, SET_SCORE_ERRORS['super_tiebreak_min'].format(set=part, points=super_tiebreak_points)
            if abs(g1 - g2) < 2:
                return False, SET_SCORE_ERRORS['super_tiebreak_no_winner'].format(set=part)
        else:
            if max(g1, g2) > 7:
                return False, SET_SCORE_ERRORS['regular_set_max'].format(set=part)
            if g1 == g2:
                return False, SET_SCORE_ERRORS['regular_set_no_winner'].format(set=part)
            if strict and not _is_complete_regular_set(g1, g2):
                return False, SET_SCORE_ERRORS['regular_set_incomplete'].format(set=part)

        parsed_sets.append((g1, g2))

    p1_sets = sum(1 for g1, g2 in parsed_sets[:2] if g1 > g2)
    p2_sets = sum(1 for g1, g2 in parsed_sets[:2] if g2 > g1)

    if len(parts) == 3 and p1_sets != 1:
        return False, SET_SCORE_ERRORS['third_set_not_needed']
    if len(parts) == 2 and p1_sets == 1 and p2_sets == 1:
        return False, SET_SCORE_ERRORS['third_set_required']

    return True, None

def _validate_single_set(score_text, match_format):
    parts = [p.strip() for p in score_text.split(',')]
    if len(parts) != 1:
        return False, SET_SCORE_ERRORS['single_set_count']
    rule, is_complete = SINGLE_SET_FORMATS[match_format]
    try:
        g1, g2 = _parse_set(parts[0])
    except (ValueError, AttributeError):
        return False, SET_SCORE_ERRORS['invalid_format'].format(set=parts[0])
    if not is_complete(max(g1, g2), min(g1, g2)):
        return False, SET_SCORE_ERRORS['single_set_invalid'].format(set=parts[0], rule=rule)
    return True, None


def strip_retirement(score_text):
    """('6-4, 2-1 ret.' -> ('6-4, 2-1', True))"""
    text = (score_text or '').strip()
    if text.endswith('ret.'):
        return text[:-4].strip().rstrip(',').strip(), True
    return text, False


def validate_retired_score(score_text, match_format='best_of_3_super_tb', super_tiebreak_points=10):
    """Score of a match stopped by a retirement: finished sets plus, optionally, a last unfinished one.

    The match must still have been undecided when it stopped. Returns (is_valid, error_message).
    """
    text, _ = strip_retirement(score_text)
    if not text:
        return False, 'Informe o placar até o momento da desistência'
    parts = [p.strip() for p in text.split(',')]
    single = match_format in SINGLE_SET_FORMATS
    if len(parts) > (1 if single else 3):
        return False, SET_SCORE_ERRORS['retired_too_many_sets']

    p1_sets = p2_sets = 0
    for index, part in enumerate(parts):
        try:
            g1, g2 = _parse_set(part)
        except (ValueError, AttributeError):
            return False, SET_SCORE_ERRORS['invalid_format'].format(set=part)
        if g1 == 0 and g2 == 0:
            return False, SET_SCORE_ERRORS['zero_zero']
        is_super = not single and index == 2
        if single:
            complete = SINGLE_SET_FORMATS[match_format][1](max(g1, g2), min(g1, g2))
        elif is_super:
            complete = _is_complete_super_tiebreak(g1, g2, super_tiebreak_points)
        else:
            complete = _is_complete_regular_set(g1, g2)
        if index < len(parts) - 1 and not complete:
            return False, SET_SCORE_ERRORS['retired_set_incomplete'].format(set=part)
        if complete:
            p1_sets += g1 > g2
            p2_sets += g2 > g1
        elif not is_super and not single and max(g1, g2) > 6:
            return False, SET_SCORE_ERRORS['regular_set_incomplete'].format(set=part)
    if max(p1_sets, p2_sets) >= (1 if single else 2):
        return False, SET_SCORE_ERRORS['retired_decided']
    return True, None


def parse_tournament_score(score_text, match_format='best_of_3_super_tb', super_tiebreak_points=10):
    """Sets and games of a tournament result, counted the way the group table counts them.

    A finished super tiebreak is 1 set and 1 game to 0 (its points are not games). In a retired match an
    unfinished set adds its games but no set (an unfinished super tiebreak adds nothing).
    Returns {'p1_sets', 'p2_sets', 'p1_games', 'p2_games', 'retired'}; the first side is the first number.
    """
    result = {'p1_sets': 0, 'p2_sets': 0, 'p1_games': 0, 'p2_games': 0, 'retired': False}
    if not score_text or score_text.startswith('W.O.'):
        return result
    text, result['retired'] = strip_retirement(score_text)
    single = match_format in SINGLE_SET_FORMATS
    for index, part in enumerate([p.strip() for p in text.split(',')]):
        g1, g2 = _parse_set(part)
        if single:
            complete = SINGLE_SET_FORMATS[match_format][1](max(g1, g2), min(g1, g2))
        elif index == 2:
            complete = _is_complete_super_tiebreak(g1, g2, super_tiebreak_points)
            if complete:
                g1, g2 = (1, 0) if g1 > g2 else (0, 1)
            else:
                g1 = g2 = 0
        else:
            complete = _is_complete_regular_set(g1, g2)
        result['p1_games'] += g1
        result['p2_games'] += g2
        if complete:
            result['p1_sets'] += g1 > g2
            result['p2_sets'] += g2 > g1
    return result


def parse_score(score_text):
    """
    Parse score text into stats dict
    
    Args:
        score_text: String like "6-4, 3-6, 10-8" or "2-1"
    
    Returns:
        dict: {'p1_sets': int, 'p2_sets': int, 'p1_games': int, 'p2_games': int}
    """
    if not score_text:
        return {'p1_sets': 0, 'p2_sets': 0, 'p1_games': 0, 'p2_games': 0}
    
    sets = score_text.split(', ')
    p1_sets = p1_games = p2_sets = p2_games = 0
    
    has_super_tiebreak = False
    for set_score in sets:
        try:
            g1, g2 = map(int, set_score.split('-'))
            p1_games += g1
            p2_games += g2
            if g1 > g2:
                p1_sets += 1
            elif g2 > g1:
                p2_sets += 1
            if max(g1, g2) >= 10:
                has_super_tiebreak = True
        except (ValueError, AttributeError):
            continue
    
    return {
        'p1_sets': p1_sets,
        'p2_sets': p2_sets,
        'p1_games': p1_games,
        'p2_games': p2_games,
        'has_super_tiebreak': has_super_tiebreak
    }

def format_score(p1_sets, p2_sets, p1_games, p2_games):
    """
    Format stats into score text (simple format)
    
    Args:
        p1_sets, p2_sets, p1_games, p2_games: Integers
    
    Returns:
        str: Formatted score like "2-1 (12-10 games)"
    """
    return f"{p1_sets}-{p2_sets} ({p1_games}-{p2_games} games)"
