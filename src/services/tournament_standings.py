"""Group standings in ATP round-robin order. Pure: no database, no Flask.

Order inside a group:
  1. most wins
  2. most matches played on court (a 2-1 record beats a 2-0 one; W.O. does not count as played)
  3. head-to-head, for two players tied
  4. highest percentage of sets won
  5. highest percentage of games won
  6. what is left tied is decided by the organizer (manual_ranks)
Criteria 4-5 serve ties of three or more. As soon as one of them splits the group, the players still tied
go back to head-to-head (two of them) or to the next criterion (more of them).

Counting (see parse_tournament_score): a finished super tiebreak is 1 set and 1 game to 0, a W.O. is a win or
a loss with no sets or games, a retirement keeps the sets and games played until it stopped, and a double W.O.
is a loss for both.
"""
from fractions import Fraction

from src.utils.score_parser import parse_tournament_score


def _pct(won, lost):
    return Fraction(won, won + lost) if won + lost else Fraction(0)


def compute_standings(entries, matches, qualifiers, match_format='best_of_3_super_tb', super_tiebreak_points=10,
                      manual_ranks=None):
    """Standings of one group.

    entries: ids of the group members.
    matches: dicts with entry1, entry2, status, outcome, winner (id) and score (from entry1's side).
    qualifiers: how many positions advance.
    manual_ranks: {entry: rank} chosen by the organizer for players the criteria could not separate.

    Returns {'rows', 'complete', 'blocked', 'confirmed', 'ties'}. Each row has the table columns plus
    'position' (tied players share one), 'tied' and 'state':
      provisional / open        group still being played (provisional = inside the qualifying places and
                                already with a win)
      qualified / eliminated    group finished
      tie_pending               group finished but a tie that matters could not be broken
    'blocked' means a tie inside or across the qualifying places is waiting for the organizer; 'confirmed'
    (finished and not blocked) is when the qualifiers are final.
    """
    manual_ranks = manual_ranks or {}
    stats = {e: dict(played=0, played_on_court=0, wins=0, losses=0, sets_won=0, sets_lost=0, games_won=0, games_lost=0)
             for e in entries}
    decided = {}  # frozenset({a, b}) -> winner (None for a double W.O.)
    pending = 0
    for match in matches:
        if match['status'] != 'completed':
            pending += 1
            continue
        a, b = match['entry1'], match['entry2']
        if match['outcome'] == 'double_wo':
            for entry in (a, b):
                stats[entry]['played'] += 1
                stats[entry]['losses'] += 1
            decided[frozenset((a, b))] = None
            continue
        winner = match['winner']
        loser = b if winner == a else a
        stats[winner]['wins'] += 1
        stats[loser]['losses'] += 1
        for entry in (a, b):
            stats[entry]['played'] += 1
        decided[frozenset((a, b))] = winner
        if match['outcome'] in ('normal', 'retired'):
            parsed = parse_tournament_score(match['score'], match_format, super_tiebreak_points)
            for entry, sets_won, sets_lost, games_won, games_lost in (
                    (a, parsed['p1_sets'], parsed['p2_sets'], parsed['p1_games'], parsed['p2_games']),
                    (b, parsed['p2_sets'], parsed['p1_sets'], parsed['p2_games'], parsed['p1_games'])):
                stats[entry]['played_on_court'] += 1
                stats[entry]['sets_won'] += sets_won
                stats[entry]['sets_lost'] += sets_lost
                stats[entry]['games_won'] += games_won
                stats[entry]['games_lost'] += games_lost

    def sets_pct(entry):
        return _pct(stats[entry]['sets_won'], stats[entry]['sets_lost'])

    def games_pct(entry):
        return _pct(stats[entry]['games_won'], stats[entry]['games_lost'])

    def resolve(bucket):
        """Split players level on wins and matches played. Returns buckets, best first (more than one player = still tied)."""
        if len(bucket) == 1:
            return [bucket]
        if len(bucket) == 2:
            winner = decided.get(frozenset(bucket))
            if winner is not None:
                return [[winner], [bucket[0] if bucket[1] == winner else bucket[1]]]
        for criterion in (sets_pct, games_pct):
            groups = {}
            for entry in bucket:
                groups.setdefault(criterion(entry), []).append(entry)
            if len(groups) > 1:
                ordered = []
                for value in sorted(groups, reverse=True):
                    ordered += resolve(groups[value])
                return ordered
        return [bucket]

    by_record = {}
    for entry in entries:
        by_record.setdefault((stats[entry]['wins'], stats[entry]['played_on_court']), []).append(entry)
    ordered = []
    for record in sorted(by_record, reverse=True):
        ordered += resolve(sorted(by_record[record]))

    placed = []  # (bucket, still tied)
    for bucket in ordered:
        ranks = [manual_ranks.get(entry) for entry in bucket]
        if len(bucket) > 1 and None not in ranks and len(set(ranks)) == len(ranks):
            placed += [([entry], False) for _, entry in sorted(zip(ranks, bucket))]
        else:
            placed.append((bucket, len(bucket) > 1))

    complete = pending == 0
    rows, ties, blocked, position = [], [], False, 1
    for bucket, tied in placed:
        start, end = position, position + len(bucket) - 1
        relevant = tied and start <= qualifiers
        if tied:
            ties.append({'entries': bucket, 'relevant': relevant})
        blocked = blocked or (complete and relevant)
        for offset, entry in enumerate(bucket):
            place = start if tied else start + offset
            if complete:
                state = 'tie_pending' if relevant else ('qualified' if place <= qualifiers else 'eliminated')
            else:
                inside = end <= qualifiers if tied else place <= qualifiers
                state = 'provisional' if inside and stats[entry]['wins'] > 0 else 'open'
            rows.append(dict(
                entry=entry, position=place, tied=tied, state=state, **stats[entry],
                sets_pct=float(sets_pct(entry)), games_pct=float(games_pct(entry))))
        position = end + 1
    return {'rows': rows, 'complete': complete, 'blocked': blocked, 'confirmed': complete and not blocked, 'ties': ties}


def campaign_order(group_winners):
    """Rank the winners of different groups, best first: [(group name, standings row)].

    Groups differ in size, so wins count as a share of the matches played (W.O. included), then the percentage of
    sets and of games, then the group order. Used to give byes and seeds in the knockout phase.
    """
    def key(item):
        name, row = item
        return (-_pct(row['wins'], row['losses']), -_pct(row['sets_won'], row['sets_lost']),
                -_pct(row['games_won'], row['games_lost']), name)
    return sorted(group_winners, key=key)
