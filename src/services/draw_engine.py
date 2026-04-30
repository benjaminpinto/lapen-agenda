import random

from src.database import get_db
from src.logger import get_logger
from src.services.ranking_config import RankingConfigService

logger = get_logger()


def _pair_key(a, b):
    return (min(a, b), max(a, b))


class DrawEngine:
    """Generate draws for ranking rounds.

    Algorithm: for the default 2 matches per player, build a Hamilton cycle on
    the group's player list — each player ends up with exactly two distinct
    neighbors. Multiple shuffle attempts pick the cycle with fewest recent-pair
    conflicts. Greedy fallback covers k != 2 and tiny groups.
    """

    @staticmethod
    def generate_draw(round_id, seed=None):
        """Generate draw for a round.

        Returns {'matches': [...], 'undermatched': [user_id, ...]}.
        Raises ValueError if the round is not 'pending' or has too few players.
        """
        db = get_db()
        try:
            return DrawEngine._generate(db, round_id, seed)
        finally:
            db.close()

    @staticmethod
    def _generate(db, round_id, seed):
        round_info = db.execute('''
            SELECT r.id, r.season_id, r.round_number, r.status
            FROM ranking_rounds r
            WHERE r.id = %s
        ''', (round_id,)).fetchone()

        if not round_info:
            raise ValueError("Rodada não encontrada")

        if round_info['status'] != 'pending':
            raise ValueError("Sorteio só pode ser gerado em rodadas pendentes")

        config = RankingConfigService.get_config(round_info['season_id'])
        elite_cutoff = config['elite_cutoff']
        challenger_cutoff = config['challenger_cutoff']
        target = config.get('matches_per_round', 2)

        participants = db.execute('''
            SELECT rp.user_id, rp.position
            FROM ranking_participants rp
            JOIN users u ON rp.user_id = u.id
            WHERE rp.season_id = %s AND rp.is_active = true
              AND u.lapen_approved = TRUE AND u.deleted_at IS NULL
            ORDER BY rp.position ASC NULLS LAST
        ''', (round_info['season_id'],)).fetchall()

        null_positions = [p['user_id'] for p in participants if p['position'] is None]
        if null_positions:
            logger.warning(
                f"Round {round_id}: {len(null_positions)} participant(s) with NULL position "
                f"placed at end of list: {null_positions}"
            )

        if len(participants) < 2:
            raise ValueError("Participantes insuficientes para realizar o sorteio")

        elite_players = list(participants[:elite_cutoff])
        challenger_players = list(participants[elite_cutoff:challenger_cutoff])
        nextgen_players = list(participants[challenger_cutoff:])

        if len(nextgen_players) == 1:
            logger.warning(f"Round {round_id}: NextGen has 1 player, merged into Challenger")
            challenger_players += nextgen_players
            nextgen_players = []
        if len(challenger_players) == 1:
            logger.warning(f"Round {round_id}: Challenger has 1 player, merged into Elite")
            elite_players += challenger_players
            challenger_players = []

        recent_pairs = DrawEngine._load_recent_pairs(db, round_id)
        rng = random.Random(seed)

        matches = []
        undermatched = []
        for players, group_type in [
            (elite_players, 'elite'),
            (challenger_players, 'challenger'),
            (nextgen_players, 'nextgen'),
        ]:
            group_matches, group_undermatched = DrawEngine._build_group_matches(
                players, group_type, recent_pairs, target, rng
            )
            matches.extend(group_matches)
            undermatched.extend(group_undermatched)

        # Atomic claim: only the first concurrent caller flips status from 'pending'.
        # Without this WHERE clause two simultaneous /draw calls can both insert matches.
        cursor = db.execute(
            "UPDATE ranking_rounds SET status = 'drawn' WHERE id = %s AND status = 'pending'",
            (round_id,)
        )
        if cursor.rowcount == 0:
            raise ValueError("Sorteio só pode ser gerado em rodadas pendentes")

        for m in matches:
            db.execute('''
                INSERT INTO ranking_matches (round_id, player1_id, player2_id, group_type)
                VALUES (%s, %s, %s, %s)
            ''', (round_id, m['player1_id'], m['player2_id'], m['group_type']))
            db.execute('''
                INSERT INTO ranking_draws (round_id, player1_id, player2_id, group_type)
                VALUES (%s, %s, %s, %s)
            ''', (round_id, m['player1_id'], m['player2_id'], m['group_type']))

        db.commit()

        if undermatched:
            logger.warning(
                f"Round {round_id}: {len(undermatched)} player(s) under target "
                f"of {target} matches: {undermatched}"
            )

        return {'matches': matches, 'undermatched': undermatched}

    @staticmethod
    def _load_recent_pairs(db, round_id):
        rows = db.execute('''
            WITH cur AS (
                SELECT season_id, round_number FROM ranking_rounds WHERE id = %s
            )
            SELECT d.player1_id, d.player2_id
            FROM ranking_draws d
            JOIN ranking_rounds r ON r.id = d.round_id
            JOIN cur ON cur.season_id = r.season_id
            WHERE r.round_number >= cur.round_number - 2
        ''', (round_id,)).fetchall()
        return {_pair_key(r['player1_id'], r['player2_id']) for r in rows}

    @staticmethod
    def _build_group_matches(players, group_type, recent_pairs, target, rng):
        if len(players) < 2:
            return [], [p['user_id'] for p in players]

        ids = [p['user_id'] for p in players]

        if target == 2 and len(ids) >= 3:
            cycle = DrawEngine._build_cycle_avoiding_recent(ids, recent_pairs, rng)
            matches = [
                {
                    'player1_id': cycle[i],
                    'player2_id': cycle[(i + 1) % len(cycle)],
                    'group_type': group_type,
                }
                for i in range(len(cycle))
            ]
            return matches, []

        return DrawEngine._greedy_match(ids, group_type, recent_pairs, target, rng)

    @staticmethod
    def _build_cycle_avoiding_recent(ids, recent_pairs, rng, max_attempts=200):
        best = None
        best_conflicts = None
        for _ in range(max_attempts):
            shuffled = ids[:]
            rng.shuffle(shuffled)
            conflicts = sum(
                1 for i in range(len(shuffled))
                if _pair_key(shuffled[i], shuffled[(i + 1) % len(shuffled)]) in recent_pairs
            )
            if conflicts == 0:
                return shuffled
            if best_conflicts is None or conflicts < best_conflicts:
                best = shuffled
                best_conflicts = conflicts
        return best

    @staticmethod
    def _greedy_match(ids, group_type, recent_pairs, target, rng):
        player_matches = {pid: 0 for pid in ids}
        used_pairs = set()
        matches = []
        max_attempts = max(len(ids) * target * 4, 50)
        attempts = 0

        while attempts < max_attempts:
            attempts += 1
            min_count = min(player_matches.values())
            if min_count >= target:
                break

            candidates = [pid for pid in ids if player_matches[pid] == min_count]
            rng.shuffle(candidates)

            matched = False
            for pid in candidates:
                if player_matches[pid] >= target:
                    continue
                opponents = sorted(
                    (other for other in ids if other != pid and player_matches[other] < target),
                    key=lambda o: player_matches[o]
                )
                # Pass 1 prefers non-recent opponents; pass 2 accepts any to avoid undermatch.
                for prefer_non_recent in (True, False):
                    for opponent in opponents:
                        key = _pair_key(pid, opponent)
                        if key in used_pairs:
                            continue
                        if prefer_non_recent and key in recent_pairs:
                            continue
                        matches.append({
                            'player1_id': pid,
                            'player2_id': opponent,
                            'group_type': group_type,
                        })
                        player_matches[pid] += 1
                        player_matches[opponent] += 1
                        used_pairs.add(key)
                        matched = True
                        break
                    if matched:
                        break
                if matched:
                    break

            if not matched:
                break

        undermatched = [pid for pid, count in player_matches.items() if count < target]
        return matches, undermatched
