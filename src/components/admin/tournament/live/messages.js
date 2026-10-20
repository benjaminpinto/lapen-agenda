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

const winnerName = (match) => match.sides.find((side) => side.registration_id === match.winner_registration_id)?.name

const resultLine = (match) => {
  const [first, second] = match.sides.map((side) => (side.name === winnerName(match) ? `*${side.name}*` : side.name))
  return `• ${first} × ${second}: ${resultLabel(match)}`
}

/** The day wrapped up: results by category (winner in bold), then the games of the next day that has any. */
export function summaryText({ tournamentName, day, matches, courts }) {
  const byTime = (a, b) => `${a.window.time} ${a.window.court_id}`.localeCompare(`${b.window.time} ${b.window.court_id}`)
  const results = matches.filter((m) => m.window?.date === day && m.status === 'completed' && m.outcome !== 'bye').sort(byTime)
  const nextDay = [...new Set(matches.filter((m) => m.status === 'pending' && m.window && m.window.date > day).map((m) => m.window.date))].sort()[0]
  const next = matches.filter((m) => m.status === 'pending' && m.window?.date === nextDay).sort(byTime)

  const lines = [`🎾 *${tournamentName}* — resumo de ${dayTitle(day)}`, '', '🏆 *Resultados do dia*']
  if (results.length === 0) lines.push('Nenhum resultado lançado neste dia.')
  for (const category of [...new Set(results.map((m) => m.category_name))]) {
    lines.push(`_${category}_`, ...results.filter((m) => m.category_name === category).map(resultLine))
  }
  if (next.length > 0) {
    lines.push('', `🗓️ *Jogos de ${dayTitle(nextDay)}*`)
    lines.push(...next.map((m) => `• ${m.window.time} · ${courtName(courts, m.window.court_id)} · ${m.category_name} · ${gameTitle(m)}`))
  }
  return lines.join('\n')
}
