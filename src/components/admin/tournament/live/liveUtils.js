const toMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** The day to open on: today if it has a session, else the latest session day before today, else the first one ahead. */
export function defaultDay(dates, today) {
  const sorted = [...dates].sort()
  if (sorted.length === 0) return null
  if (sorted.includes(today)) return today
  const before = sorted.filter((date) => date < today)
  return before.length > 0 ? before[before.length - 1] : sorted[0]
}

const bothDefined = (match) => match.sides.every((side) => side.defined)

/** A match that can get a result: both players known and nothing recorded yet. */
export const isReady = (match) => match.status === 'pending' && bothDefined(match)

/** Where the match stands against the clock: 'now' while its slot is on, 'late' once the slot is over and nothing was recorded. */
export function clockState(match, today, nowMinutes, slotMinutes) {
  if (!isReady(match) || !match.window) return null
  const { date, time } = match.window
  if (date < today) return 'late'
  if (date > today) return null
  const start = toMinutes(time)
  if (nowMinutes >= start + slotMinutes) return 'late'
  return nowMinutes >= start ? 'now' : null
}

/** What to show for a finished match: the score, or how it ended when there is none. */
export function resultLabel(match) {
  if (match.outcome === 'bye') return 'BYE'
  if (match.outcome === 'double_wo') return 'Duplo W.O.'
  if (match.outcome === 'wo') return 'W.O.'
  return match.score
}

/** True for the row (start time) whose slot is running right now. */
export const isCurrentRow = (date, time, today, nowMinutes, slotMinutes) => {
  if (date !== today) return false
  const start = toMinutes(time)
  return nowMinutes >= start && nowMinutes < start + slotMinutes
}

/** Counts for a list of matches. Byes are not games to be played. */
export function tally(matches, today, nowMinutes, slotMinutes) {
  const games = matches.filter((match) => match.outcome !== 'bye')
  return {
    total: games.length,
    done: games.filter((match) => match.status === 'completed').length,
    late: games.filter((match) => clockState(match, today, nowMinutes, slotMinutes) === 'late').length,
  }
}

/** Progress of each category from the schedule's matches: games done, total and whether a knockout phase exists yet. */
export function categoryProgress(matches) {
  const byCategory = new Map()
  for (const match of matches) {
    if (match.outcome === 'bye') continue
    const entry = byCategory.get(match.category_id) ?? { total: 0, done: 0, hasKnockout: false }
    entry.total += 1
    if (match.status === 'completed') entry.done += 1
    if (match.stage === 'knockout') entry.hasKnockout = true
    byCategory.set(match.category_id, entry)
  }
  return byCategory
}

/**
 * The games that need the organizer's eye: late ones, the ones that should be on court now and the ones that start
 * within the next slot. Sorted by date, time and court. [{ match, state: 'late' | 'now' | 'next' }]
 */
export function focusMatches(matches, today, nowMinutes, slotMinutes) {
  const found = []
  for (const match of matches) {
    if (!isReady(match) || !match.window) continue
    const state = clockState(match, today, nowMinutes, slotMinutes)
    if (state) {
      found.push({ match, state })
    } else if (match.window.date === today) {
      const start = toMinutes(match.window.time)
      if (start > nowMinutes && start < nowMinutes + slotMinutes) found.push({ match, state: 'next' })
    }
  }
  const key = ({ match }) => `${match.window.date} ${match.window.time} ${String(match.window.court_id).padStart(6, '0')}`
  return found.sort((a, b) => key(a).localeCompare(key(b)))
}

const byTime = (a, b) => `${a.window.date} ${a.window.time}`.localeCompare(`${b.window.date} ${b.window.time}`)

/**
 * What the board shows for one court of one day: the game that should be on court (today: the latest ready game
 * whose start has passed and has no result) and the next pending games.
 */
export function courtBoard(matches, isToday, nowMinutes, nextLimit = 2) {
  const pending = matches.filter((match) => match.status === 'pending' && match.window).sort(byTime)
  const started = isToday ? pending.filter((match) => isReady(match) && toMinutes(match.window.time) <= nowMinutes) : []
  const onCourt = started.length > 0 ? started[started.length - 1] : null
  const upcoming = pending.filter((match) => !isToday || toMinutes(match.window.time) > nowMinutes)
  return { onCourt, next: upcoming.slice(0, nextLimit) }
}

/** The latest finished games (byes do not count), most recent first. */
export const recentResults = (matches, limit) => matches
  .filter((match) => match.status === 'completed' && match.outcome !== 'bye' && match.window)
  .sort((a, b) => byTime(b, a))
  .slice(0, limit)
