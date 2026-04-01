/**
 * Calculates additional statistics for a player from their match history.
 * Matches must include an `id` field for deterministic same-date ordering.
 *
 * @param {object} stats - API response from /api/statistics/player
 * @param {string} player1 - The player's short_name (filter value)
 * @returns {object|null}
 */
export function calculateAdditionalStats(stats, player1) {
  if (!stats || !stats.matches || stats.matches.length === 0) return null

  const matches = stats.matches
  let currentStreak = 0
  let currentStreakType = null
  let maxWinStreak = 0
  let maxLossStreak = 0
  let tempStreak = 0
  let tempType = null

  // DESC date, id ASC (lower id = more recent for same date) → newest match first
  const sortedMatchesDesc = [...matches].sort((a, b) => new Date(b.match_date) - new Date(a.match_date) || a.id - b.id)
  // ASC date, id DESC (higher id = earlier for same date) → consistent with display chronological reading
  const sortedMatchesAsc = [...matches].sort((a, b) => new Date(a.match_date) - new Date(b.match_date) || b.id - a.id)

  // Calculate current streak (newest to oldest)
  for (let index = 0; index < sortedMatchesDesc.length; index++) {
    const match = sortedMatchesDesc[index]
    const isPlayer1 = match.player1_name?.trim() === player1?.trim()
    const isPlayer2 = match.player2_name?.trim() === player1?.trim()
    const isWin = (isPlayer1 || isPlayer2) && match.winner_name?.trim() === player1?.trim()

    if (index === 0) {
      currentStreakType = isWin ? 'win' : 'loss'
      currentStreak = 1
    } else if ((currentStreakType === 'win' && isWin) || (currentStreakType === 'loss' && !isWin)) {
      currentStreak++
    } else {
      break
    }
  }

  // Calculate max streaks (oldest to newest, chronological order)
  for (let index = 0; index < sortedMatchesAsc.length; index++) {
    const match = sortedMatchesAsc[index]
    const isPlayer1 = match.player1_name?.trim() === player1?.trim()
    const isPlayer2 = match.player2_name?.trim() === player1?.trim()
    const isWin = (isPlayer1 || isPlayer2) && match.winner_name?.trim() === player1?.trim()

    if (tempType === null) {
      tempType = isWin ? 'win' : 'loss'
      tempStreak = 1
    } else if ((tempType === 'win' && isWin) || (tempType === 'loss' && !isWin)) {
      tempStreak++
    } else {
      if (tempType === 'win') maxWinStreak = Math.max(maxWinStreak, tempStreak)
      else maxLossStreak = Math.max(maxLossStreak, tempStreak)
      tempType = isWin ? 'win' : 'loss'
      tempStreak = 1
    }
  }

  // Final max streak update
  if (tempType === 'win') maxWinStreak = Math.max(maxWinStreak, tempStreak)
  else maxLossStreak = Math.max(maxLossStreak, tempStreak)

  const totalSets = stats.sets_won + stats.sets_lost
  const avgGamesPerSet = totalSets > 0 ? ((stats.games_won + stats.games_lost) / totalSets).toFixed(1) : 0

  const tiebreaks = matches.filter(m => {
    const p1Games = m.player1_name === player1 ? m.player1_games : m.player2_games
    const p2Games = m.player1_name === player1 ? m.player2_games : m.player1_games
    const p1Sets = m.player1_name === player1 ? m.player1_sets : m.player2_sets
    const p2Sets = m.player1_name === player1 ? m.player2_sets : m.player1_sets
    return Math.abs(p1Sets - p2Sets) === 1 && Math.abs(p1Games - p2Games) <= 2
  }).length

  // Calculate best/worst opponents
  const opponentStats = {}
  matches.forEach(m => {
    const opponent = m.player1_name === player1 ? m.player2_name : m.player1_name
    if (!opponentStats[opponent]) opponentStats[opponent] = { wins: 0, losses: 0 }
    if (m.winner_name?.trim() === player1?.trim()) opponentStats[opponent].wins++
    else opponentStats[opponent].losses++
  })

  let bestOpponent = null   // Carrasco: player1 wins the most against
  let worstOpponent = null  // Frequês: player1 loses the most to
  let maxWins = 0
  let maxLosses = 0

  Object.entries(opponentStats).forEach(([opponent, record]) => {
    if (record.wins > maxWins) {
      maxWins = record.wins
      bestOpponent = { name: opponent, wins: record.wins, losses: record.losses }
    }
    if (record.losses > maxLosses) {
      maxLosses = record.losses
      worstOpponent = { name: opponent, wins: record.wins, losses: record.losses }
    }
  })

  return {
    maxWinStreak,
    maxLossStreak,
    currentStreak,
    currentStreakType,
    avgGamesPerSet,
    tiebreaks,
    bestOpponent,
    worstOpponent
  }
}
