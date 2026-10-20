import {describe, expect, it} from 'vitest'
import {callMessage, changeMessage, summaryText} from '../../src/components/admin/tournament/live/messages'

const courts = [{ id: 1, name: 'Quadra 1', type: 'Saibro' }, { id: 2, name: 'Quadra 2', type: 'Rápida' }]
const side = (id, name) => ({ registration_id: id, name, defined: true })
const game = (id, extra = {}) => ({
  id, category_id: 1, category_name: 'Challenger', round_name: 'Grupo A · Rodada 2', stage: 'group', status: 'pending', outcome: null, score: null,
  winner_registration_id: null, sides: [side(1, 'Ana'), side(2, 'Bia')], window: { court_id: 1, date: '2026-10-20', time: '16:00' }, ...extra,
})

describe('callMessage', () => {
  it('groups the games by court and closes by asking the players to go there', () => {
    const text = callMessage({
      tournamentName: 'Copa', courts, today: '2026-10-20',
      matches: [
        game(1),
        game(2, { category_name: 'Elite', round_name: 'Semifinal 1', sides: [side(3, 'Caio'), side(4, 'Davi')], window: { court_id: 2, date: '2026-10-20', time: '16:00' } }),
        game(3, { sides: [side(5, 'Edu'), side(6, 'Fábio')], window: { court_id: 1, date: '2026-10-20', time: '17:30' } }),
      ],
    })
    expect(text).toBe([
      '🎾 *Copa* — chamada de jogos',
      '', '📍 *Quadra 1 (Saibro)*', '• 16:00 · Challenger · Grupo A · Rodada 2', '  Ana × Bia', '• 17:30 · Challenger · Grupo A · Rodada 2', '  Edu × Fábio',
      '', '📍 *Quadra 2 (Rápida)*', '• 16:00 · Elite · Semifinal 1', '  Caio × Davi',
      '', 'Jogadores, favor se dirigirem à quadra indicada.',
    ].join('\n'))
  })

  it('lists the courts in the order they are registered, whatever the time of the games', () => {
    const text = callMessage({
      tournamentName: 'Copa', courts, today: '2026-10-20',
      matches: [game(1, { window: { court_id: 2, date: '2026-10-20', time: '16:00' } }), game(2, { window: { court_id: 1, date: '2026-10-20', time: '19:00' } })],
    })
    expect(text.indexOf('Quadra 1')).toBeLessThan(text.indexOf('Quadra 2'))
  })

  it('names the day of a game that is not today', () => {
    const text = callMessage({ tournamentName: 'Copa', courts, today: '2026-10-20', matches: [game(1, { window: { court_id: 1, date: '2026-10-19', time: '20:00' } })] })
    expect(text).toContain('• Seg 19/10 20:00 · Challenger')
  })
})

describe('changeMessage', () => {
  it('gives the new day, time and court', () => {
    expect(changeMessage({ tournamentName: 'Copa', courts, match: game(1) })).toBe([
      '⚠️ *Copa* — alteração de horário', '', '*Challenger* · Grupo A · Rodada 2', 'Ana × Bia', '🗓️ Ter 20/10 às 16:00', '📍 Quadra 1 (Saibro)',
    ].join('\n'))
  })

  it('says the time is open when the game has no window', () => {
    expect(changeMessage({ tournamentName: 'Copa', courts, match: game(1, { window: null }) })).toContain('🗓️ Horário a definir')
  })
})

describe('summaryText', () => {
  const done = (id, extra) => game(id, { status: 'completed', outcome: 'normal', score: '6-0, 6-0', winner_registration_id: 1, ...extra })

  it('lists the results of the day by category with the winner in bold, then the next day', () => {
    const text = summaryText({
      tournamentName: 'Copa', day: '2026-10-20', courts,
      matches: [
        done(1),
        done(2, { category_name: 'Elite', winner_registration_id: 4, sides: [side(3, 'Caio'), side(4, 'Davi')], score: '4-6, 2-6', window: { court_id: 2, date: '2026-10-20', time: '19:00' } }),
        game(3, { window: { court_id: 2, date: '2026-10-21', time: '16:00' } }),
        game(4, { window: { court_id: 1, date: '2026-10-23', time: '16:00' } }),
      ],
    })
    expect(text).toBe([
      '🎾 *Copa* — resumo de Ter 20/10', '', '🏆 *Resultados do dia*',
      '_Challenger_', '• *Ana* × Bia: 6-0, 6-0',
      '_Elite_', '• Caio × *Davi*: 4-6, 2-6',
      '', '🗓️ *Jogos de Qua 21/10*', '• 16:00 · Quadra 2 (Rápida) · Challenger · Ana × Bia',
    ].join('\n'))
  })

  it('says so when nothing was played and leaves out the next day when there is none', () => {
    const text = summaryText({ tournamentName: 'Copa', day: '2026-10-20', courts, matches: [done(1, { window: { court_id: 1, date: '2026-10-19', time: '16:00' } })] })
    expect(text).toBe('🎾 *Copa* — resumo de Ter 20/10\n\n🏆 *Resultados do dia*\nNenhum resultado lançado neste dia.')
  })

  it('shows how a W.O. ended instead of a score, and leaves byes out', () => {
    const text = summaryText({ tournamentName: 'Copa', day: '2026-10-20', courts, matches: [done(1, { outcome: 'wo', score: 'W.O.' }), done(2, { outcome: 'bye' })] })
    expect(text).toContain('• *Ana* × Bia: W.O.')
    expect(text.match(/•/g)).toHaveLength(1)
  })
})
