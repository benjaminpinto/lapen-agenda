import {describe, expect, it} from 'vitest'
import {layoutSummary, MIN_HEIGHT} from '../../src/components/admin/tournament/live/summaryImage'

const game = (id) => ({ id, first: 'Ana', second: 'Bia', winner: 1, score: '6-0, 6-0' })
const data = (games, next = [], overrides = {}) => ({
  day: '2026-10-17', total: games.reduce((n, c) => n + c.length, 0), nextDay: next.length ? '2026-10-20' : null, next,
  pending: [], pendingTitle: 'Jogos de hoje',
  categories: games.map((list, index) => ({ name: `Categoria ${index}`, games: list })), ...overrides,
})
const upcoming = (id) => ({ id, time: '16:00', court: 'Quadra 1', category: 'Elite', first: 'Ana', second: 'Bia' })

describe('layoutSummary', () => {
  it('keeps the 4:5 poster for a day with few games', () => {
    const { height, blocks } = layoutSummary(data([[game(1)]]))
    expect(height).toBe(MIN_HEIGHT)
    expect(blocks.map((b) => b.type)).toEqual(['header', 'category'])
  })

  it('shows the empty state when nothing was played', () => {
    const { blocks } = layoutSummary(data([], [upcoming(1)]))
    expect(blocks.map((b) => b.type)).toEqual(['header', 'empty', 'games'])
  })

  it('grows with a full day and stacks the blocks without overlapping', () => {
    const full = data([Array.from({ length: 10 }, (_, i) => game(i)), [game(11), game(12)], [game(13)]], [upcoming(1), upcoming(2)])
    const { height, blocks } = layoutSummary(full)
    expect(height).toBeGreaterThan(MIN_HEIGHT)
    blocks.slice(1).forEach((block, i) => expect(block.y).toBeGreaterThan(blocks[i].y + blocks[i].height))
    const last = blocks[blocks.length - 1]
    expect(height).toBeGreaterThan(last.y + last.height)
  })

  it('lists at most six of the next games and counts the rest', () => {
    const { blocks } = layoutSummary(data([[game(1)]], Array.from({ length: 9 }, (_, i) => upcoming(i))))
    const next = blocks.find((b) => b.type === 'games')
    expect(next.shown).toHaveLength(6)
    expect(next.hidden).toBe(3)
    expect(next.title).toBe('PRÓXIMOS JOGOS · TER 20/10')
  })

  it('adds the games of the day still to play before the next day, with room for a long list', () => {
    const { blocks } = layoutSummary(data([[game(1)]], [upcoming(9)], { pending: Array.from({ length: 12 }, (_, i) => upcoming(i)) }))
    expect(blocks.map((b) => b.type)).toEqual(['header', 'category', 'games', 'games'])
    const [today, next] = blocks.filter((b) => b.type === 'games')
    expect(today.title).toBe('JOGOS DE HOJE')
    expect(today.shown).toHaveLength(10)
    expect(today.hidden).toBe(2)
    expect(next.y).toBeGreaterThan(today.y + today.height)
  })
})
