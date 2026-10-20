import {courtName, dayTitle} from '../schedule/scheduleUtils'
import {resultLabel} from './liveUtils'

// WhatsApp messages for the group, in the style of the agenda message (emoji + *bold* headings).

const gameTitle = (match) => `${match.sides[0].name} × ${match.sides[1].name}`

/** "Chamada de jogos": the games to call to the court, grouped by court. Games of another day carry their day. */
export function callMessage({ tournamentName, matches, courts, today }) {
  const lines = [`🎾 *${tournamentName}* — chamada de jogos`]
  const position = (id) => courts.findIndex((court) => court.id === id)
  const courtIds = [...new Set(matches.map((m) => m.window.court_id))].sort((a, b) => position(a) - position(b))
  for (const courtId of courtIds) {
    lines.push('', `📍 *${courtName(courts, courtId)}*`)
    for (const match of matches.filter((m) => m.window.court_id === courtId)) {
      const day = match.window.date === today ? '' : `${dayTitle(match.window.date)} `
      lines.push(`• ${day}${match.window.time} · ${match.category_name} · ${match.round_name}`, `  ${gameTitle(match)}`)
    }
  }
  lines.push('', 'Jogadores, favor se dirigirem à quadra indicada.')
  return lines.join('\n')
}

/** "Alteração de horário" for one match, after it was moved. */
export function changeMessage({ tournamentName, match, courts }) {
  const when = match.window ? `🗓️ ${dayTitle(match.window.date)} às ${match.window.time}\n📍 ${courtName(courts, match.window.court_id)}` : '🗓️ Horário a definir'
  return [`⚠️ *${tournamentName}* — alteração de horário`, '', `*${match.category_name}* · ${match.round_name}`, gameTitle(match), when].join('\n')
}

const side = (match, slot) => match.sides[slot - 1].name
const winnerSide = (match) => match.sides.findIndex((s) => match.winner_registration_id && s.registration_id === match.winner_registration_id) + 1 || null

/**
 * What the day's summary says, shared by the message and the image: the results of `day` by category, the games of `day`
 * still without a result ("Jogos de hoje" when `day` is `today`) and the games of the next day that has any. A result has the players in match order, the side that won (1, 2 or null) and the score.
 */
export function summaryData({ day, matches, courts, today }) {
  const byTime = (a, b) => `${a.window.time} ${a.window.court_id}`.localeCompare(`${b.window.time} ${b.window.court_id}`)
  const results = matches.filter((m) => m.window?.date === day && m.status === 'completed' && m.outcome !== 'bye').sort(byTime)
  const nextDay = [...new Set(matches.filter((m) => m.status === 'pending' && m.window && m.window.date > day).map((m) => m.window.date))].sort()[0] ?? null
  const next = matches.filter((m) => m.status === 'pending' && m.window?.date === nextDay).sort(byTime)
  const pending = matches.filter((m) => m.status === 'pending' && m.window?.date === day).sort(byTime)
  const game = (m) => ({ id: m.id, time: m.window.time, court: courtName(courts, m.window.court_id), category: m.category_name, first: side(m, 1), second: side(m, 2) })
  return {
    day,
    categories: [...new Set(results.map((m) => m.category_name))].map((name) => ({
      name,
      games: results.filter((m) => m.category_name === name).map((m) => ({ id: m.id, first: side(m, 1), second: side(m, 2), winner: winnerSide(m), score: resultLabel(m) })),
    })),
    total: results.length,
    pending: pending.map(game),
    pendingTitle: day === today ? 'Jogos de hoje' : `Pendentes de ${dayTitle(day)}`,
    nextDay,
    next: next.map(game),
  }
}

/** The day wrapped up as a message: results by category (winner in bold), the games still to play that day, then the next day's. */
export function summaryText({ tournamentName, day, matches, courts, today }) {
  const data = summaryData({ day, matches, courts, today })
  const lines = [`🎾 *${tournamentName}* — resumo de ${dayTitle(day)}`, '', '🏆 *Resultados do dia*']
  if (data.total === 0) lines.push('Nenhum resultado lançado neste dia.')
  for (const category of data.categories) {
    lines.push(`_${category.name}_`)
    for (const game of category.games) {
      const [first, second] = [game.first, game.second].map((name, index) => (game.winner === index + 1 ? `*${name}*` : name))
      lines.push(`• ${first} × ${second}: ${game.score}`)
    }
  }
  if (data.pending.length > 0) {
    lines.push('', `🕒 *${data.pendingTitle}*`)
    lines.push(...data.pending.map((m) => `• ${m.time} · ${m.court} · ${m.category} · ${m.first} × ${m.second}`))
  }
  if (data.next.length > 0) {
    lines.push('', `🗓️ *Jogos de ${dayTitle(data.nextDay)}*`)
    lines.push(...data.next.map((m) => `• ${m.time} · ${m.court} · ${m.category} · ${m.first} × ${m.second}`))
  }
  return lines.join('\n')
}
