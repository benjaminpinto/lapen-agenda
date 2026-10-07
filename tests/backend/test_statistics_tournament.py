"""What the statistics screens do with tournament results: the "Torneio" type, "Amistosos" without them, H2H and challenges."""
import pytest

from backend.test_tournament_statistics import final_match, tournament_with
from backend.tournament_support import (  # noqa: F401  (fixtures are used by name)
    clean_db, client, draw_matches, draw_of, ensure_court, make_user, people, play, sql, stats_rows,
)

ADA, BIA = 'TTourn member', 'TTourn member2'


@pytest.fixture
def both(client, people):
    """Two members. They met in a tournament final (played 2099-03-04) and in a friendly (2099-03-01, the other one won)."""
    other = make_user('member2', member=True, approved=True)
    tournament, category, _ = tournament_with(client, people, 2, {0: people.member.id, 1: other.id})
    match = final_match(client, people, tournament, category)
    assert play(client, people.admin.headers, tournament, match, side=1, played_at='2099-03-04').status_code == 200
    (row,) = stats_rows()
    tournament_winner = row['winner_id']
    friendly_winner = other.id if tournament_winner == people.member.id else people.member.id

    court = ensure_court()
    schedule = sql("INSERT INTO schedules (court_id, date, start_time, player1_name, player2_name, match_type) "
                   "VALUES (%s, '2099-03-01', '08:00', 'TT stats', 'TT stats', 'Amistoso') RETURNING id", (court,))[0]['id']
    sql("INSERT INTO match_statistics_unified (schedule_id, player1_id, player2_id, winner_id, player1_name, player2_name, winner_name, score, "
        "match_type, match_date) VALUES (%s, %s, %s, %s, %s, %s, 'x', '6-0, 6-0', 'Amistoso', '2099-03-01')",
        (schedule, people.member.id, other.id, friendly_winner, ADA, BIA))
    yield {'members': (people.member.id, other.id), 'tournament_winner': tournament_winner, 'friendly_winner': friendly_winner}
    sql('DELETE FROM match_statistics_unified WHERE schedule_id = %s', (schedule,))
    sql('DELETE FROM schedules WHERE id = %s', (schedule,))


def player(client, **params):
    response = client.get('/api/statistics/player', query_string=dict(player1=ADA, **params))
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def general(client, **params):
    response = client.get('/api/statistics/general', query_string=params)
    assert response.status_code == 200
    return response.get_json()


def test_the_player_screen_counts_the_tournament_and_can_filter_it(client, both):
    everything = player(client)
    assert everything['total_matches'] == 2
    assert sorted(m['match_type'] for m in everything['matches']) == ['Amistoso', 'Torneio']

    only_tournament = player(client, match_type='Torneio')
    assert [m['match_type'] for m in only_tournament['matches']] == ['Torneio']
    assert '04 Mar 2099' in only_tournament['matches'][0]['match_date']          # the day the result says it was played
    assert only_tournament['total_matches'] == 1

    friendly = player(client, match_type='Amistoso')
    assert [m['match_type'] for m in friendly['matches']] == ['Amistoso']      # a tournament match is not a friendly


def test_head_to_head_includes_the_tournament_match(client, both):
    h2h = player(client, player2=BIA)['head_to_head']
    assert h2h['player1_wins'] + h2h['player2_wins'] == 2
    assert h2h['player1_wins'] == h2h['player2_wins'] == 1                    # one each: the tournament final and the friendly
    only = player(client, player2=BIA, match_type='Torneio')['head_to_head']
    assert only['player1_wins'] + only['player2_wins'] == 1


def test_a_tournament_match_keeps_its_scores_in_the_totals(client, both):
    only = player(client, match_type='Torneio')
    assert (only['sets_won'] + only['sets_lost'], only['games_won'] + only['games_lost']) == (2, 19)   # 6-4, 6-3 (either side)


def test_friendlies_in_the_general_view_leave_the_tournament_out(client, both):
    everything = general(client)
    assert everything['match_types'].get('Torneio', 0) >= 1 and everything['match_types'].get('Amistoso', 0) >= 1
    friendlies = general(client, season='amistosos')
    assert 'Torneio' not in friendlies['match_types'] and 'Ranking' not in friendlies['match_types']
    assert friendlies['match_types'].get('Amistoso', 0) >= 1
    assert everything['total_matches'] - friendlies['total_matches'] >= 1     # the tournament match is only in "all"


def test_a_tournament_match_belongs_to_no_ranking_season(client, both):
    row = sql("SELECT season_id FROM match_statistics_unified WHERE match_type = 'Torneio' ORDER BY id DESC LIMIT 1")[0]
    assert row['season_id'] is None
    assert 'Torneio' not in general(client, season='999999').get('match_types', {})


def test_it_appears_in_the_recent_results_but_not_as_a_result_to_register(client, both):
    recent = client.get('/api/statistics/recent-results', query_string={'limit': 200}).get_json()
    assert any(r['match_type'] == 'Torneio' and r['tournament_match_id'] for r in recent)
    pending = client.get('/api/statistics/past-matches').get_json()['matches']
    assert not any(m.get('match_type') == 'Torneio' for m in pending)           # a tournament result is never entered by hand


def test_challenges_still_count_only_friendlies(client, both):
    from src.database import get_db
    from src.routes.challenges import get_challenge_progress
    first, second = both['members']
    db = get_db()
    try:
        progress = get_challenge_progress(db, {'start_date': '2099-01-01', 'end_date': '2099-12-31', 'challenger_id': first, 'challenged_id': second})
    finally:
        db.close()
    assert progress['matches_played'] == 1                                       # the friendly, not the tournament final
    assert (progress['challenger']['victories'], progress['challenged']['victories']) == ((1, 0) if both['friendly_winner'] == first else (0, 1))
