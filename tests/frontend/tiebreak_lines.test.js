import {describe, expect, it} from 'vitest'
import {tiebreakLines} from '../../src/components/tournament/tiebreakLines'

const row = (id, name, extra = {}) => ({entry: {id, display_name: name}, played_on_court: 1, sets_pct: 0.5, games_pct: 0.5, ...extra})

// Group C of Next Gen: a 1-1 cycle where Isaacson's W.O. leaves him and Dimas level on matches played
const groupC = (overrides = {}) => ({
  name: 'C',
  complete: true,
  rows: [
    row(5, 'Benjamin Pinto', {played_on_court: 2}),
    row(14, 'Dimas José', {sets_pct: 1 / 3, games_pct: 7 / 15}),
    row(28, 'Isaacson', {sets_pct: 2 / 3, games_pct: 12 / 23}),
  ],
  tiebreaks: [{
    wins: 1,
    entries: [5, 14, 28],
    steps: [
      {criterion: 'played_on_court', order: [[5], [14, 28]]},
      {criterion: 'head_to_head', order: [[14], [28]], walkover: true},
    ],
  }],
  ...overrides,
})

describe('tiebreakLines', () => {
  it('explains a tie on wins criterion by criterion, in the order the players ended up', () => {
    expect(tiebreakLines(groupC())).toEqual([{
      wins: 1,
      intro: 'Benjamin Pinto, Dimas José e Isaacson terminaram com 1 vitória.',
      steps: [
        {criterion: 'played_on_court', title: 'Mais jogos disputados em quadra (W.O. não conta)', text: 'Benjamin Pinto 2 · Dimas José 1 · Isaacson 1.'},
        {criterion: 'head_to_head', title: 'Confronto direto', text: 'Dimas José venceu Isaacson por W.O.'},
      ],
    }])
  })

  it('says nothing while the group is still being played', () => {
    expect(tiebreakLines(groupC({complete: false}))).toEqual([])
  })

  it('says nothing when no one finished level on wins', () => {
    expect(tiebreakLines(groupC({tiebreaks: []}))).toEqual([])
  })

  it('shows percentages with a decimal comma and plain head-to-head without a W.O.', () => {
    const group = groupC({tiebreaks: [{
      wins: 2,
      entries: [14, 28],
      steps: [
        {criterion: 'sets_pct', order: [[28], [14]]},
        {criterion: 'games_pct', order: [[28], [14]]},
        {criterion: 'head_to_head', order: [[28], [14]], walkover: false},
      ],
    }]})
    const [line] = tiebreakLines(group)
    expect(line.intro).toBe('Dimas José e Isaacson terminaram com 2 vitórias.')
    expect(line.steps.map((step) => step.text)).toEqual([
      'Isaacson 66,7% · Dimas José 33,3%.',
      'Isaacson 52,2% · Dimas José 46,7%.',
      'Isaacson venceu Dimas José.',
    ])
  })

  it('reports the organizer decision and a tie the criteria could not split', () => {
    const decided = groupC({tiebreaks: [{wins: 1, entries: [5, 14, 28], steps: [{criterion: 'manual', order: [[28], [5], [14]]}]}]})
    expect(tiebreakLines(decided)[0].steps).toEqual([
      {criterion: 'manual', title: 'Decisão do organizador', text: 'Isaacson, Benjamin Pinto, Dimas José, nesta ordem.'},
    ])
    const open = groupC({tiebreaks: [{wins: 0, entries: [14, 28], steps: []}]})
    expect(tiebreakLines(open)).toEqual([{wins: 0, intro: 'Dimas José e Isaacson terminaram sem vitórias.', steps: []}])
  })
})
