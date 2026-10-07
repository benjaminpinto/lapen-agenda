export { formatDate } from '@/components/admin/tournament/labels'

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const two = (n) => String(n).padStart(2, '0')

const parseDay = (value) => {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  return { year, month, day, weekday: new Date(year, month - 1, day).getDay() }
}

/** "Quarta, 07/10" for grouping games by day. */
export const dayHeading = (value) => {
  const { month, day, weekday } = parseDay(value)
  return `${WEEKDAYS_LONG[weekday]}, ${two(day)}/${two(month)}`
}

/** "qua 07/10 · 08:00 · Quadra 2": when and where a game is planned (null while nothing is). */
export const plannedText = (match) => {
  if (!match.planned_date) return null
  const { month, day, weekday } = parseDay(match.planned_date)
  const date = `${WEEKDAYS[weekday]} ${two(day)}/${two(month)}`
  return [match.planned_time ? `${date} · ${match.planned_time}` : date, match.court].filter(Boolean).join(' · ')
}

/** "06/10 18:08" from the local timestamp the API sends. */
export const playedText = (match) => {
  if (!match.played_at) return null
  const [date, time] = String(match.played_at).split('T')
  const { month, day } = parseDay(date)
  return `${two(day)}/${two(month)} ${time.slice(0, 5)}`
}

export const updatedText = (date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const SET = /^(\d+)-(\d+)(?:\((\d+)\))?$/

/**
 * A result for display, from the first player's side.
 * sets: [{ games: [a, b], tiebreak: 5 | null, superTiebreak: boolean }]; note: what is not a set score
 * ("W.O.", "Duplo W.O.", "Desistência", "Bye").
 */
export const scoreParts = (match) => {
  if (match.outcome === 'bye') return { sets: [], note: 'Bye' }
  if (match.outcome === 'double_wo') return { sets: [], note: 'Duplo W.O.' }
  if (match.outcome === 'wo' || !match.score) return { sets: [], note: match.outcome === 'wo' ? 'W.O.' : null }
  const retired = match.outcome === 'retired'
  const text = retired ? match.score.replace(/\s*ret\.?$/i, '') : match.score
  const sets = text.split(',').map((part, index) => {
    const found = SET.exec(part.trim())
    if (!found) return null
    const games = [Number(found[1]), Number(found[2])]
    return { games, tiebreak: found[3] ? Number(found[3]) : null, superTiebreak: index === 2 && Math.max(...games) >= 10 }
  }).filter(Boolean)
  return { sets, note: retired ? 'Desistência' : null }
}
