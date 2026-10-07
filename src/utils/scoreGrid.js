// Score grid: one row per player, one column per set. Shared by the ranking and the tournament result forms.

export const SCORE_COLUMNS = {
  best_of_3_super_tb: [
    { key: 'set1', label: '1º Set', max: 7 },
    { key: 'set2', label: '2º Set', max: 7 },
    { key: 'stb', label: 'STB', max: 99 },
  ],
  pro_set_8: [{ key: 'set1', label: 'Set', max: 9 }],
  single_set_6: [{ key: 'set1', label: 'Set', max: 7 }],
}

const KEYS = ['set1', 'set2', 'stb']

export const emptyGrid = () => ({ set1: ['', ''], set2: ['', ''], stb: ['', ''] })

export const isFilled = (pair) => pair[0] !== '' && pair[1] !== ''

const games = (pair) => [parseInt(pair[0], 10) || 0, parseInt(pair[1], 10) || 0]

/** '6-4, 3-6, 10-8' (optionally ending in 'ret.') -> grid. */
export const gridFromScore = (score) => {
  const grid = emptyGrid()
  String(score || '').replace(/\s*ret\.$/, '').split(',').map((part) => part.trim()).filter(Boolean).slice(0, KEYS.length)
    .forEach((part, index) => {
      const [first = '', second = ''] = part.split('-').map((value) => value.trim())
      grid[KEYS[index]] = [first, second]
    })
  return grid
}

/** Grid -> '6-4, 3-6, 10-8': only the sets of the format that have both numbers. */
export const scoreFromGrid = (grid, columns = SCORE_COLUMNS.best_of_3_super_tb) =>
  columns.filter((column) => isFilled(grid[column.key]))
    .map((column) => games(grid[column.key]).join('-'))
    .join(', ')

/** Sets won by each side. A set counts when both numbers are filled and the games differ (the super tiebreak counts as a set). */
export const setsWon = (grid, columns = SCORE_COLUMNS.best_of_3_super_tb) => {
  const won = [0, 0]
  for (const column of columns) {
    if (!isFilled(grid[column.key])) continue
    const [first, second] = games(grid[column.key])
    if (first > second) won[0] += 1
    else if (second > first) won[1] += 1
  }
  return won
}

/** The super tiebreak is only played when the two regular sets are split 1-1. */
export const needsSuperTiebreak = (grid) => {
  if (!isFilled(grid.set1) || !isFilled(grid.set2)) return false
  const [first, second] = setsWon(grid, SCORE_COLUMNS.best_of_3_super_tb.slice(0, 2))
  return first === 1 && second === 1
}

/** 1 or 2 once the score decides the match (one set in one-set formats, two sets in best of 3), otherwise null. */
export const winnerSide = (grid, columns = SCORE_COLUMNS.best_of_3_super_tb) => {
  const [first, second] = setsWon(grid, columns)
  if (Math.max(first, second) < (columns.length === 1 ? 1 : 2) || first === second) return null
  return first > second ? 1 : 2
}
