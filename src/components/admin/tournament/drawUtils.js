/** "Ana Souza (CC1)", the origin of an open slot ("1º Grupo A"), or BYE. */
export const entryLabel = (entry) => (entry ? `${entry.display_name}${entry.seed ? ` (CC${entry.seed})` : ''}` : null)

export const sideLabel = (match, slot) => {
  const entry = match[`entry${slot}`]
  if (entry) return entryLabel(entry)
  const source = match[`entry${slot}_source`]
  if (source) return source
  return match.outcome === 'bye' ? 'BYE' : 'A definir'
}

export const allMatches = (draw) => [
  ...draw.groups.flatMap((group) => group.matches.map((match) => ({ ...match, group_name: group.name }))),
  ...(draw.knockout ? draw.knockout.rounds.flatMap((round) => round.matches) : []),
]

/** Every player in the draw, for the swap selects. */
export const drawEntries = (draw) => {
  const seen = new Map()
  for (const group of draw.groups) for (const entry of group.entries) seen.set(entry.registration_id, entry)
  if (draw.knockout) {
    for (const match of draw.knockout.rounds[0].matches) {
      for (const slot of [1, 2]) {
        const entry = match[`entry${slot}`]
        if (entry) seen.set(entry.registration_id, entry)
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.display_name.localeCompare(b.display_name))
}

export const SCORE_HINT = 'Placar do ponto de vista do primeiro jogador. Ex.: 6-4, 3-6, 10-8'
