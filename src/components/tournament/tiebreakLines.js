const pct = (value) => `${(value * 100).toFixed(1).replace('.', ',')}%`

const joinNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : names[0])

/** What each measure-based criterion shows for a player. */
const MEASURES = {
  played_on_court: {title: 'Mais jogos disputados em quadra (W.O. não conta)', value: (row) => String(row.played_on_court)},
  sets_pct: {title: 'Percentual de sets ganhos', value: (row) => pct(row.sets_pct)},
  games_pct: {title: 'Percentual de games ganhos', value: (row) => pct(row.games_pct)},
}

/**
 * Plain-language account of how a finished group broke its ties on wins, one entry per set of players level on wins:
 * {wins, intro, steps: [{criterion, title, text}]}. Empty while the group is still being played, since a tie then is not final.
 */
export function tiebreakLines(group) {
  if (!group.complete) return []
  const rows = new Map(group.rows.map((row) => [row.entry.id, row]))
  const name = (id) => rows.get(id).entry.display_name
  return (group.tiebreaks ?? []).map((tiebreak) => {
    const names = group.rows.filter((row) => tiebreak.entries.includes(row.entry.id)).map((row) => row.entry.display_name)
    const record = tiebreak.wins === 0 ? 'sem vitórias' : `com ${tiebreak.wins} ${tiebreak.wins === 1 ? 'vitória' : 'vitórias'}`
    const steps = tiebreak.steps.map((step) => {
      const ids = step.order.flat()
      if (step.criterion === 'head_to_head') {
        return {criterion: step.criterion, title: 'Confronto direto', text: `${name(ids[0])} venceu ${name(ids[1])}${step.walkover ? ' por W.O.' : '.'}`}
      }
      if (step.criterion === 'manual') {
        return {criterion: step.criterion, title: 'Decisão do organizador', text: `${ids.map(name).join(', ')}, nesta ordem.`}
      }
      const {title, value} = MEASURES[step.criterion]
      return {criterion: step.criterion, title, text: `${ids.map((id) => `${name(id)} ${value(rows.get(id))}`).join(' · ')}.`}
    })
    return {wins: tiebreak.wins, intro: `${joinNames(names)} terminaram ${record}.`, steps}
  })
}
