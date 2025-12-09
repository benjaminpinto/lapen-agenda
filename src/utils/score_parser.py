"""Score parsing utilities for unified match results"""

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
    
    for set_score in sets:
        try:
            g1, g2 = map(int, set_score.split('-'))
            p1_games += g1
            p2_games += g2
            if g1 > g2:
                p1_sets += 1
            elif g2 > g1:
                p2_sets += 1
        except (ValueError, AttributeError):
            continue
    
    return {
        'p1_sets': p1_sets,
        'p2_sets': p2_sets,
        'p1_games': p1_games,
        'p2_games': p2_games
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
