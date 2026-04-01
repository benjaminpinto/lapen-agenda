import { describe, expect, it } from 'vitest'
import { calculateAdditionalStats } from '../../src/utils/statisticsUtils'

// Helper to build a minimal match object
const match = (id, date, p1, p2, winner) => ({
  id,
  match_date: date,
  player1_name: p1,
  player2_name: p2,
  winner_name: winner,
  player1_sets: 2, player2_sets: 1,
  player1_games: 12, player2_games: 9,
  match_type: 'Amistoso',
  score: '6-3, 4-6, 6-4',
})

const baseStats = (matches) => ({
  matches,
  sets_won: 2,
  sets_lost: 1,
  games_won: 12,
  games_lost: 9,
})

describe('calculateAdditionalStats', () => {
  it('returns null when there are no matches', () => {
    expect(calculateAdditionalStats(null, 'P1')).toBeNull()
    expect(calculateAdditionalStats({ matches: [] }, 'P1')).toBeNull()
  })

  // ── winner_name matching ──────────────────────────────────────────────────

  describe('win/loss identification via winner_name', () => {
    it('counts a match as a win when winner_name equals player1 short_name', () => {
      const matches = [match(1, '2026-01-01', 'P1', 'P2', 'P1')]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.currentStreakType).toBe('win')
      expect(result.currentStreak).toBe(1)
    })

    it('counts a match as a loss when winner_name is the opponent', () => {
      const matches = [match(1, '2026-01-01', 'P1', 'P2', 'P2')]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.currentStreakType).toBe('loss')
    })

    it('works when player1 is player2_name in the match (guest slot)', () => {
      const matches = [match(1, '2026-01-01', 'Opp', 'P1', 'P1')]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.currentStreakType).toBe('win')
    })

    it('trims whitespace when comparing winner_name to player1', () => {
      const m = { ...match(1, '2026-01-01', 'P1', 'P2', 'P1'), winner_name: ' P1 ' }
      const result = calculateAdditionalStats(baseStats([m]), ' P1 ')
      expect(result.currentStreakType).toBe('win')
    })
  })

  // ── Carrasco (bestOpponent) ───────────────────────────────────────────────

  describe('bestOpponent (Carrasco) — opponent player1 beats the most', () => {
    it('identifies the opponent with the most losses to player1', () => {
      const matches = [
        match(1, '2026-01-01', 'P1', 'Rômulo', 'P1'),
        match(2, '2026-01-02', 'P1', 'Rômulo', 'P1'),
        match(3, '2026-01-03', 'P1', 'Breno', 'P1'),
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.bestOpponent.name).toBe('Rômulo')
      expect(result.bestOpponent.wins).toBe(2)
    })

    it('is null when player1 never wins', () => {
      const matches = [
        match(1, '2026-01-01', 'P1', 'Rômulo', 'Rômulo'),
        match(2, '2026-01-02', 'P1', 'Breno', 'Breno'),
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.bestOpponent).toBeNull()
    })
  })

  // ── Frequês (worstOpponent) ───────────────────────────────────────────────

  describe('worstOpponent (Frequês) — opponent player1 loses to the most', () => {
    it('identifies the opponent who beats player1 the most', () => {
      const matches = [
        match(1, '2026-01-01', 'P1', 'Rômulo', 'Rômulo'),
        match(2, '2026-01-02', 'P1', 'Rômulo', 'Rômulo'),
        match(3, '2026-01-03', 'P1', 'Breno', 'Breno'),
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.worstOpponent.name).toBe('Rômulo')
      expect(result.worstOpponent.losses).toBe(2)
    })

    it('is null when player1 never loses', () => {
      const matches = [
        match(1, '2026-01-01', 'P1', 'Rômulo', 'P1'),
        match(2, '2026-01-02', 'P1', 'Breno', 'P1'),
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.worstOpponent).toBeNull()
    })

    it('bestOpponent and worstOpponent can be different players', () => {
      const matches = [
        match(1, '2026-01-01', 'P1', 'Breno', 'P1'),   // P1 beats Breno
        match(2, '2026-01-02', 'P1', 'Breno', 'P1'),   // P1 beats Breno again
        match(3, '2026-01-03', 'P1', 'Rômulo', 'Rômulo'), // Rômulo beats P1
        match(4, '2026-01-04', 'P1', 'Rômulo', 'Rômulo'), // Rômulo beats P1 again
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.bestOpponent.name).toBe('Breno')
      expect(result.worstOpponent.name).toBe('Rômulo')
    })
  })

  // ── Max streak ────────────────────────────────────────────────────────────

  describe('maxWinStreak and maxLossStreak', () => {
    it('computes a simple win streak', () => {
      const matches = [
        match(1, '2026-01-01', 'P1', 'Opp', 'P1'),
        match(2, '2026-01-02', 'P1', 'Opp', 'P1'),
        match(3, '2026-01-03', 'P1', 'Opp', 'P1'),
        match(4, '2026-01-04', 'P1', 'Opp', 'Opp'),
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.maxWinStreak).toBe(3)
    })

    it('computes a simple loss streak', () => {
      const matches = [
        match(1, '2026-01-01', 'P1', 'Opp', 'Opp'),
        match(2, '2026-01-02', 'P1', 'Opp', 'Opp'),
        match(3, '2026-01-03', 'P1', 'Opp', 'P1'),
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.maxLossStreak).toBe(2)
    })

    it('finds the longest streak among multiple streaks', () => {
      const matches = [
        match(1, '2026-01-01', 'P1', 'Opp', 'P1'),
        match(2, '2026-01-02', 'P1', 'Opp', 'P1'),
        match(3, '2026-01-03', 'P1', 'Opp', 'Opp'), // break
        match(4, '2026-01-04', 'P1', 'Opp', 'P1'),
        match(5, '2026-01-05', 'P1', 'Opp', 'P1'),
        match(6, '2026-01-06', 'P1', 'Opp', 'P1'),
        match(7, '2026-01-07', 'P1', 'Opp', 'Opp'), // break
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.maxWinStreak).toBe(3)
    })

    it('counts a streak that ends at the last match', () => {
      const matches = [
        match(1, '2026-01-01', 'P1', 'Opp', 'Opp'),
        match(2, '2026-01-02', 'P1', 'Opp', 'P1'),
        match(3, '2026-01-03', 'P1', 'Opp', 'P1'),
        match(4, '2026-01-04', 'P1', 'Opp', 'P1'),
        match(5, '2026-01-05', 'P1', 'Opp', 'P1'),
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.maxWinStreak).toBe(4)
    })
  })

  // ── Same-date tie-breaking ────────────────────────────────────────────────

  describe('same-date tie-breaking by id DESC', () => {
    it('treats the match with the LOWER id as more recent when dates are equal', () => {
      // id=10 (loss) is "most recent" for same date → current streak = 1 loss
      const matches = [
        match(10, '2026-03-24', 'P1', 'Bruno', 'Bruno'), // loss — lower id = most recent
        match(20, '2026-03-24', 'P1', 'Neto', 'P1'),    // win  — higher id = earlier
        match(5,  '2026-03-10', 'P1', 'Opp', 'P1'),
        match(6,  '2026-03-12', 'P1', 'Opp', 'P1'),
        match(7,  '2026-03-12', 'P1', 'Opp', 'P1'),
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      // Chronological (ASC, id DESC for same date): id=7,6,5 then id=20(win) then id=10(loss)
      // → Win streak: 3 (Mar 10-12) + 1 (Mar 24 Neto) = 4 before the loss
      expect(result.maxWinStreak).toBe(4)
    })

    it('current streak reflects the most recent match (lower id for same date)', () => {
      const matches = [
        match(10, '2026-03-24', 'P1', 'Bruno', 'Bruno'), // lower id = most recent → loss
        match(20, '2026-03-24', 'P1', 'Neto', 'P1'),
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.currentStreakType).toBe('loss')
      expect(result.currentStreak).toBe(1)
    })

    it('reproduces the Benjamin Pinto 4-win streak scenario', () => {
      // Matches from 2026-03 as stored in the DB
      const matches = [
        match(131, '2026-03-10', 'Breno',    'P1',      'P1'),
        match(134, '2026-03-12', 'P1',       'Paulo',   'P1'),
        match(135, '2026-03-12', 'P1',       'Janie',   'P1'),
        match(147, '2026-03-24', 'P1',       'Bruno',   'Bruno'), // lower id = more recent
        match(149, '2026-03-24', 'Neto',     'P1',      'P1'),    // higher id = earlier
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.maxWinStreak).toBe(4)
      expect(result.currentStreakType).toBe('loss')
    })
  })

  // ── Current streak ────────────────────────────────────────────────────────

  describe('currentStreak', () => {
    it('counts ongoing win streak from the most recent matches', () => {
      const matches = [
        match(1, '2026-01-01', 'P1', 'Opp', 'Opp'),
        match(2, '2026-01-02', 'P1', 'Opp', 'P1'),
        match(3, '2026-01-03', 'P1', 'Opp', 'P1'),
        match(4, '2026-01-04', 'P1', 'Opp', 'P1'),
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.currentStreakType).toBe('win')
      expect(result.currentStreak).toBe(3)
    })

    it('counts ongoing loss streak from the most recent matches', () => {
      const matches = [
        match(1, '2026-01-01', 'P1', 'Opp', 'P1'),
        match(2, '2026-01-02', 'P1', 'Opp', 'Opp'),
        match(3, '2026-01-03', 'P1', 'Opp', 'Opp'),
      ]
      const result = calculateAdditionalStats(baseStats(matches), 'P1')
      expect(result.currentStreakType).toBe('loss')
      expect(result.currentStreak).toBe(2)
    })
  })
})
