"""Score parsing utilities for unified match results"""

SET_SCORE_ERRORS = {
    'invalid_format': 'Formato de set inválido: {set}',
    'zero_zero': 'Set 0-0 não é válido',
    'regular_set_max': 'Set regular inválido: {set} (máximo 7 games)',
    'regular_set_no_winner': 'Set regular sem vencedor claro: {set}',
    'super_tiebreak_min': 'Super tiebreak inválido: {set} (mínimo 10 pontos)',
    'super_tiebreak_no_winner': 'Super tiebreak sem vencedor claro: {set} (diferença mínima de 2)',
    'third_set_not_needed': 'Terceiro set informado mas placar já tem vencedor nos dois primeiros sets',
    'third_set_required': 'Terceiro set obrigatório quando sets estão empatados em 1-1',
}

def validate_score(score_text):
    """
    Validate score text for logical consistency.
    Returns (is_valid, error_message).
    """
    if not score_text or score_text.startswith('W.O.'):
        return True, None

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
            if max(g1, g2) < 10:
                return False, SET_SCORE_ERRORS['super_tiebreak_min'].format(set=part)
            if abs(g1 - g2) < 2:
                return False, SET_SCORE_ERRORS['super_tiebreak_no_winner'].format(set=part)
        else:
            if max(g1, g2) > 7:
                return False, SET_SCORE_ERRORS['regular_set_max'].format(set=part)
            if g1 == g2:
                return False, SET_SCORE_ERRORS['regular_set_no_winner'].format(set=part)

        parsed_sets.append((g1, g2))

    p1_sets = sum(1 for g1, g2 in parsed_sets[:2] if g1 > g2)
    p2_sets = sum(1 for g1, g2 in parsed_sets[:2] if g2 > g1)

    if len(parts) == 3 and p1_sets != 1:
        return False, SET_SCORE_ERRORS['third_set_not_needed']
    if len(parts) == 2 and p1_sets == 1 and p2_sets == 1:
        return False, SET_SCORE_ERRORS['third_set_required']

    return True, None

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
