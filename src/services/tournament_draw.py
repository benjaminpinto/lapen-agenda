"""Pure draw algorithms for the tournament module (no database, no Flask).

Every random choice goes through an injectable `random.Random`, so a draw can be replayed
exactly from its seed. Entries are opaque hashable values: registration ids in real draws,
placeholder labels (like "1º Grupo A") while the groups are still being played.

Bracket lines are 1-based, top to bottom. Round 1 pairs lines (1, 2), (3, 4), ...
"""
import random


class DrawError(ValueError):
    """The draw cannot be built with the given entries or settings."""


# --- sizes and names ------------------------------------------------------------------

def bracket_size(n):
    """Smallest power of two that holds n entries."""
    if n < 2:
        raise DrawError('São necessários ao menos 2 inscritos.')
    return 1 << (n - 1).bit_length()


def round_count(size):
    return size.bit_length() - 1


def round_name(round_number, total_rounds):
    matches = 1 << (total_rounds - round_number)
    return {1: 'Final', 2: 'Semifinal', 4: 'Quartas de final', 8: 'Oitavas de final'}.get(matches, f'{round_number}ª rodada')


def winner_label(round_number, position, total_rounds):
    """Label of a slot that will be filled by the winner of a match of this round."""
    matches = 1 << (total_rounds - round_number)
    if matches == 1:
        return 'Vencedor da final'
    if matches == 2:
        return f'Vencedor da semifinal {position}'
    if matches == 4:
        return f'Vencedor das quartas {position}'
    if matches == 8:
        return f'Vencedor das oitavas {position}'
    return f'Vencedor da {round_number}ª rodada, jogo {position}'


def qualifier_label(position, group_name):
    return f'{position}º Grupo {group_name}'


def group_name(index):
    return chr(ord('A') + index)


# --- seeds (ITF placement) -------------------------------------------------------------

def seed_blocks(size, count):
    """Lines available to each block of seeds: [[seed 1], [seed 2], [3-4], [5-8], [9-16], ...].

    Seeds of a block are drawn among its lines. Seed 1 takes the first line and seed 2 the last. Seeds 3-4 take
    the top of the 2nd quarter and the bottom of the 3rd. Each following block takes, next to every seed already
    placed, the far end of the neighbouring block, which gives the ITF tables
    (size 32: 1 | 32 | 9, 24 | 8, 16, 17, 25).
    """
    blocks = [[1], [size]]
    if count <= 2:
        return blocks
    placed = [1, size]
    quarter = size // 4
    blocks.append([quarter + 1, 3 * quarter])
    placed += blocks[-1]
    width = size // 8
    while sum(len(block) for block in blocks) < count:  # place_seeds caps count at half the lines, so width stays >= 1
        new = []
        for line in sorted(placed):
            block = (line - 1) // width
            sibling = block ^ 1
            new.append((sibling + 1) * width if sibling > block else sibling * width + 1)
        blocks.append(sorted(new))
        placed += new
        width //= 2
    return blocks


def place_seeds(size, count, rng):
    """{seed number: line}. At most half of the lines can be seeded."""
    if count > size // 2:
        raise DrawError(f'No máximo {size // 2} cabeças de chave para uma chave de {size}.')
    lines, number = {}, 1
    for block in seed_blocks(size, count):
        take = min(len(block), count - number + 1)
        if take <= 0:
            break
        for line in rng.sample(block, take):
            lines[number] = line
            number += 1
    return lines


def _partner(line):
    """The other line of the round-1 match."""
    return line + 1 if line % 2 == 1 else line - 1


# --- single elimination ------------------------------------------------------------------

def _section(line, size, parts):
    return (line - 1) * parts // size


def _pick_bye_pair(candidates, bye_pairs, pair_count, rng):
    """Walk the bracket halving it, always entering the half with fewer byes: spreads byes as evenly as possible."""
    low, high = 0, pair_count
    while high - low > 1:
        middle = (low + high) // 2
        options = [(sum(1 for pair in bye_pairs if a <= pair < b), a, b)
                   for a, b in ((low, middle), (middle, high)) if any(a <= pair < b for pair in candidates)]
        fewest = min(count for count, _, _ in options)
        low, high = rng.choice([(a, b) for count, a, b in options if count == fewest])
    return low


def _assign_apart(constrained, free_lines, allowed, rng, budget=20000):
    """Randomised backtracking: a line for each constrained entry, or None when there is no solution."""
    chosen, spent = {}, [0]

    def solve(pending, available):
        if not pending:
            return True
        spent[0] += 1
        if spent[0] > budget:
            return False
        options = {entry: [line for line in available if allowed(entry, line)] for entry in pending}
        entry = min(pending, key=lambda e: (len(options[e]), rng.random()))
        rest = [e for e in pending if e != entry]
        candidates = options[entry]
        rng.shuffle(candidates)
        for line in candidates:
            chosen[entry] = line
            if solve(rest, [free for free in available if free != line]):
                return True
            del chosen[entry]
        return False

    return chosen if solve(list(constrained), list(free_lines)) else None


def build_knockout(entries, seeds=(), rng=None, apart=()):
    """Place entries on a single-elimination bracket. Returns a list of `size` lines; None marks a bye.

    seeds: entries in seed order (seed 1 first).
    apart: pairs (entry, seeded_entry): the first should land in the other half of the bracket than the second
           (falls back to the other quarter, then to no restriction, when that cannot be satisfied).
    Byes go to the top seeds first (a bye is the empty line next to a seed), the rest are spread evenly.
    """
    rng = rng or random.Random()
    entries, seeds = list(entries), list(seeds)
    n = len(entries)
    size = bracket_size(n)
    if len(set(entries)) != n:
        raise DrawError('Há inscritos repetidos.')
    if len(set(seeds)) != len(seeds) or not set(seeds) <= set(entries):
        raise DrawError('Cabeças de chave inválidos.')

    seed_lines = place_seeds(size, len(seeds), rng)
    lines = [None] * size
    line_of = {}
    for number, entry in enumerate(seeds, start=1):
        lines[seed_lines[number] - 1] = entry
        line_of[entry] = seed_lines[number]

    byes = size - n
    seeded_byes = min(byes, len(seeds))
    bye_lines = {_partner(seed_lines[number]) for number in range(1, seeded_byes + 1)}
    bye_pairs = {(line - 1) // 2 for line in bye_lines}
    candidates = [pair for pair in range(size // 2)
                  if lines[2 * pair] is None and lines[2 * pair + 1] is None and pair not in bye_pairs]
    for _ in range(byes - seeded_byes):
        pair = _pick_bye_pair(candidates, bye_pairs, size // 2, rng)
        candidates.remove(pair)
        bye_pairs.add(pair)
        bye_lines.add(2 * pair + rng.choice((1, 2)))

    seeded = set(seeds)
    unseeded = [entry for entry in entries if entry not in seeded]
    rng.shuffle(unseeded)
    free_lines = [line for line in range(1, size + 1) if lines[line - 1] is None and line not in bye_lines]

    anchors = {}
    for entry, anchor in apart:
        if entry in unseeded and anchor in line_of:
            anchors.setdefault(entry, []).append(anchor)
    constrained = [entry for entry in unseeded if entry in anchors]
    chosen = {}
    if constrained and size >= 4:
        for parts in (2, 4):
            chosen = _assign_apart(
                constrained, free_lines,
                lambda entry, line, parts=parts: all(
                    _section(line, size, parts) != _section(line_of[anchor], size, parts) for anchor in anchors[entry]),
                rng)
            if chosen is not None:
                break
        chosen = chosen or {}
    for entry, line in chosen.items():
        lines[line - 1] = entry
    taken = set(chosen.values())
    rest = [entry for entry in unseeded if entry not in chosen]
    for entry, line in zip(rest, [line for line in free_lines if line not in taken]):
        lines[line - 1] = entry
    return lines


# --- groups and round-robin -----------------------------------------------------------------

def plan_group_sizes(n, target_size):
    """Sizes of balanced groups (differ by at most 1, none below 3). Needs at least 6 entries."""
    if target_size not in (3, 4):
        raise DrawError('O tamanho do grupo deve ser 3 ou 4.')
    if n < 6:
        raise DrawError('Grupos + mata-mata exige no mínimo 6 inscritos.')
    groups = -(-n // target_size)
    while groups > 2 and n // groups < 3:
        groups -= 1
    base, extra = divmod(n, groups)
    return [base + 1] * extra + [base] * (groups - extra)


def build_groups(entries, seeds=(), target_size=4, rng=None):
    """Distribute entries in balanced groups. Seeds are dealt in a snake (A, B, C, then back C, B, A...)."""
    rng = rng or random.Random()
    entries, seeds = list(entries), list(seeds)
    if len(set(entries)) != len(entries):
        raise DrawError('Há inscritos repetidos.')
    if len(set(seeds)) != len(seeds) or not set(seeds) <= set(entries):
        raise DrawError('Cabeças de chave inválidos.')
    sizes = plan_group_sizes(len(entries), target_size)
    groups = [[] for _ in sizes]

    placed, row = 0, 0
    while placed < len(seeds):
        for index in (range(len(sizes)) if row % 2 == 0 else reversed(range(len(sizes)))):
            if placed < len(seeds) and len(groups[index]) < sizes[index]:
                groups[index].append(seeds[placed])
                placed += 1
        row += 1

    seeded = set(seeds)
    unseeded = [entry for entry in entries if entry not in seeded]
    rng.shuffle(unseeded)
    slots = [index for index, size in enumerate(sizes) for _ in range(size - len(groups[index]))]
    rng.shuffle(slots)
    for entry, index in zip(unseeded, slots):
        groups[index].append(entry)
    return groups


def round_robin_rounds(entries):
    """Circle method: a list of rounds, each a list of (entry, entry). Everyone meets everyone once."""
    players = list(entries)
    if len(players) < 2:
        raise DrawError('São necessários ao menos 2 inscritos.')
    if len(players) % 2:
        players.append(None)  # whoever faces None rests in that round
    count = len(players)
    rounds = []
    for _ in range(count - 1):
        rounds.append([(players[i], players[count - 1 - i]) for i in range(count // 2)
                       if players[i] is not None and players[count - 1 - i] is not None])
        players = [players[0]] + [players[-1]] + players[1:-1]
    return rounds


# --- groups to knockout ---------------------------------------------------------------------

def knockout_lines_from_groups(winners, runners_up, rng):
    """Bracket lines for the knockout phase that follows the groups.

    winners / runners_up: lists of (group name, entry). Winners are the seeds, best first (group order while the
    groups are still being played, campaign order once they are over). Each runner-up is kept in the other half
    of the bracket than the winner of its own group, so groups do not rematch before the final.
    """
    winner_of = {group: entry for group, entry in winners}
    entries = [entry for _, entry in winners] + [entry for _, entry in runners_up]
    seeds = [entry for _, entry in winners][:bracket_size(len(entries)) // 2]
    apart = [(entry, winner_of[group]) for group, entry in runners_up if group in winner_of]
    return build_knockout(entries, seeds, rng, apart)
