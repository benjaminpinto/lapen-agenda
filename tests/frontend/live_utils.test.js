import {describe, expect, it} from 'vitest'
import {
  categoryProgress,
  clockState,
  courtBoard,
  defaultDay,
  focusMatches,
  isCurrentRow,
  recentResults,
  tally
} from '../../src/components/admin/tournament/live/liveUtils'

const SLOT = 90
const at = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const match = (overrides = {}) => ({
  id: 1, category_id: 1, stage: 'group', status: 'pending', outcome: null,
  window: { court_id: 1, date: '2026-10-20', time: '16:00' },
  sides: [{ defined: true }, { defined: true }],
  ...overrides,
})

describe('defaultDay', () => {
  const days = ['2026-10-15', '2026-10-17', '2026-10-20', '2026-10-23']

  it('opens on today when it has a session', () => {
    expect(defaultDay(days, '2026-10-20')).toBe('2026-10-20')
  })

  it('falls back to the latest session before today', () => {
    expect(defaultDay(days, '2026-10-21')).toBe('2026-10-20')
    expect(defaultDay(days, '2026-10-30')).toBe('2026-10-23')
    expect(defaultDay(days, '2026-10-18')).toBe('2026-10-17')
  })

  it('uses the first session when every one is still ahead', () => {
    expect(defaultDay(days, '2026-10-01')).toBe('2026-10-15')
  })

  it('does not depend on the order of the dates, and is null without sessions', () => {
    expect(defaultDay([...days].reverse(), '2026-10-21')).toBe('2026-10-20')
    expect(defaultDay([], '2026-10-20')).toBeNull()
  })
})

describe('clockState', () => {
  const today = '2026-10-20'

  it('is "now" while the slot is running and "late" once it is over', () => {
    expect(clockState(match(), today, at('15:59'), SLOT)).toBeNull()
    expect(clockState(match(), today, at('16:00'), SLOT)).toBe('now')
    expect(clockState(match(), today, at('17:29'), SLOT)).toBe('now')
    expect(clockState(match(), today, at('17:30'), SLOT)).toBe('late')
  })

  it('treats a pending match of a past day as late and of a future day as nothing', () => {
    expect(clockState(match({ window: { date: '2026-10-19', time: '20:00' } }), today, at('08:00'), SLOT)).toBe('late')
    expect(clockState(match({ window: { date: '2026-10-21', time: '09:00' } }), today, at('23:00'), SLOT)).toBeNull()
  })

  it('ignores matches that cannot be played or are already done', () => {
    expect(clockState(match({ status: 'completed', outcome: 'normal' }), today, at('20:00'), SLOT)).toBeNull()
    expect(clockState(match({ sides: [{ defined: true }, { defined: false }] }), today, at('20:00'), SLOT)).toBeNull()
    expect(clockState(match({ window: null }), today, at('20:00'), SLOT)).toBeNull()
  })
})

describe('isCurrentRow', () => {
  it('marks only the running slot of today', () => {
    expect(isCurrentRow('2026-10-20', '16:00', '2026-10-20', at('17:00'), SLOT)).toBe(true)
    expect(isCurrentRow('2026-10-20', '17:30', '2026-10-20', at('17:00'), SLOT)).toBe(false)
    expect(isCurrentRow('2026-10-19', '16:00', '2026-10-20', at('17:00'), SLOT)).toBe(false)
  })
})

describe('tally and categoryProgress', () => {
  const matches = [
    match({ id: 1, status: 'completed', outcome: 'normal' }),
    match({ id: 2, window: { date: '2026-10-20', time: '16:00' } }),
    match({ id: 3, window: { date: '2026-10-20', time: '19:00' } }),
    match({ id: 4, status: 'completed', outcome: 'bye', stage: 'knockout', category_id: 2 }),
    match({ id: 5, stage: 'knockout', category_id: 2, window: null }),
  ]

  it('counts done and late games and leaves byes out', () => {
    expect(tally(matches, '2026-10-20', at('18:00'), SLOT)).toEqual({ total: 4, done: 1, late: 1 })
  })

  it('sums each category and tells whether it already has a knockout phase', () => {
    const progress = categoryProgress(matches)
    expect(progress.get(1)).toEqual({ total: 3, done: 1, hasKnockout: false })
    expect(progress.get(2)).toEqual({ total: 1, done: 0, hasKnockout: true })
  })
})

describe('focusMatches', () => {
  const today = '2026-10-20'
  const at1 = (id, time, court, extra = {}) => match({ id, window: { court_id: court, date: today, time }, ...extra })
  const list = [
    at1(1, '19:00', 2),
    at1(2, '16:00', 1),
    at1(3, '17:30', 1),
    at1(4, '17:30', 2, { status: 'completed', outcome: 'normal' }),
    at1(5, '17:00', 3, { sides: [{ defined: true }, { defined: false }] }),
    match({ id: 6, window: { court_id: 1, date: '2026-10-19', time: '20:00' } }),
    match({ id: 7, window: null }),
  ]

  const states = (nowTime) => focusMatches(list, today, at(nowTime), SLOT).map(({ match: m, state }) => [m.id, state])

  it('keeps late, running and next-slot games, sorted by date, time and court', () => {
    expect(states('17:35')).toEqual([[6, 'late'], [2, 'late'], [3, 'now'], [1, 'next']])
  })

  it('only looks one slot ahead and skips done games, games without both players and games without a window', () => {
    expect(states('15:00')).toEqual([[6, 'late'], [2, 'next']])
    expect(states('18:00')).toEqual([[6, 'late'], [2, 'late'], [3, 'now'], [1, 'next']])
    expect(states('20:00')).toEqual([[6, 'late'], [2, 'late'], [3, 'late'], [1, 'now']])
  })
})

describe('courtBoard and recentResults', () => {
  const day = '2026-10-20'
  const at2 = (id, time, extra = {}) => match({ id, window: { court_id: 1, date: day, time }, ...extra })
  const court = [at2(1, '16:00'), at2(2, '17:30'), at2(3, '19:00'), at2(4, '20:30'), at2(5, '14:30', { status: 'completed', outcome: 'normal' })]
  const ids = (list) => list.map((m) => m.id)

  it('puts the latest started game on court and lists the next pending ones', () => {
    const board = courtBoard(court, true, at('17:40'))
    expect(board.onCourt.id).toBe(2)
    expect(ids(board.next)).toEqual([3, 4])
  })

  it('has nobody on court before the first game and when the started game has undefined players', () => {
    expect(courtBoard(court, true, at('15:00')).onCourt).toBeNull()
    expect(ids(courtBoard(court, true, at('15:00')).next)).toEqual([1, 2])
    const waiting = [at2(1, '16:00', { sides: [{ defined: true }, { defined: false }] })]
    expect(courtBoard(waiting, true, at('16:30')).onCourt).toBeNull()
  })

  it('does not guess who is on court for a day that is not today', () => {
    const board = courtBoard(court, false, at('17:40'), 3)
    expect(board.onCourt).toBeNull()
    expect(ids(board.next)).toEqual([1, 2, 3])
  })

  it('lists the latest results first and skips byes', () => {
    const done = [at2(1, '16:00', { status: 'completed', outcome: 'normal' }), at2(2, '17:30', { status: 'completed', outcome: 'normal' }),
      at2(3, '19:00', { status: 'completed', outcome: 'bye' }), at2(4, '20:30')]
    expect(ids(recentResults(done, 5))).toEqual([2, 1])
    expect(ids(recentResults(done, 1))).toEqual([2])
  })
})
