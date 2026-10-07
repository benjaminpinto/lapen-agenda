import { describe, expect, it } from 'vitest'
import {
  emptyGrid, gridFromScore, isFilled, needsSuperTiebreak, SCORE_COLUMNS, scoreFromGrid, setsWon, winnerSide,
} from '../../src/utils/scoreGrid'

const grid = (set1 = ['', ''], set2 = ['', ''], stb = ['', '']) => ({ set1, set2, stb })
const BEST_OF_3 = SCORE_COLUMNS.best_of_3_super_tb
const PRO_SET = SCORE_COLUMNS.pro_set_8
const SINGLE_SET = SCORE_COLUMNS.single_set_6

describe('gridFromScore / scoreFromGrid', () => {
  it('round-trips a three set score', () => {
    expect(gridFromScore('6-4, 3-6, 10-8')).toEqual(grid(['6', '4'], ['3', '6'], ['10', '8']))
    expect(scoreFromGrid(gridFromScore('6-4, 3-6, 10-8'))).toBe('6-4, 3-6, 10-8')
  })

  it('reads a two set score and leaves the super tiebreak empty', () => {
    expect(gridFromScore('6-0, 6-1')).toEqual(grid(['6', '0'], ['6', '1']))
    expect(scoreFromGrid(gridFromScore('6-0, 6-1'))).toBe('6-0, 6-1')
  })

  it('drops the retirement mark and reads an unfinished last set', () => {
    expect(gridFromScore('6-4, 2-1 ret.')).toEqual(grid(['6', '4'], ['2', '1']))
  })

  it('copes with a missing score', () => {
    expect(gridFromScore(null)).toEqual(emptyGrid())
    expect(gridFromScore('')).toEqual(emptyGrid())
  })

  it('only writes the sets that have both numbers', () => {
    expect(scoreFromGrid(grid(['6', '4'], ['3', '']))).toBe('6-4')
    expect(scoreFromGrid(emptyGrid())).toBe('')
  })

  it('writes plain numbers (no leading zeros) and keeps a 0 game', () => {
    expect(scoreFromGrid(grid(['06', '0'], ['6', '04']))).toBe('6-0, 6-4')
  })

  it('writes only the set of a one set format', () => {
    expect(scoreFromGrid(grid(['8', '6']), PRO_SET)).toBe('8-6')
    expect(scoreFromGrid(grid(['9', '8'], ['6', '4']), SINGLE_SET)).toBe('9-8')
  })
})

describe('sets and winner', () => {
  it('counts sets, with the super tiebreak as the third', () => {
    expect(setsWon(grid(['6', '4'], ['3', '6'], ['10', '8']), BEST_OF_3)).toEqual([2, 1])
    expect(setsWon(grid(['6', '4'], ['6', '3']), BEST_OF_3)).toEqual([2, 0])
  })

  it('ignores sets that are not filled or are tied', () => {
    expect(setsWon(grid(['6', '4'], ['3', '']), BEST_OF_3)).toEqual([1, 0])
    expect(setsWon(grid(['6', '6']), BEST_OF_3)).toEqual([0, 0])
  })

  it('needs a super tiebreak only when the two sets are split', () => {
    expect(needsSuperTiebreak(grid(['6', '4'], ['3', '6']))).toBe(true)
    expect(needsSuperTiebreak(grid(['6', '4'], ['6', '3']))).toBe(false)
    expect(needsSuperTiebreak(grid(['6', '4']))).toBe(false)
    expect(needsSuperTiebreak(emptyGrid())).toBe(false)
  })

  it('names the winner only when the score decides the match', () => {
    expect(winnerSide(grid(['6', '4'], ['6', '3']), BEST_OF_3)).toBe(1)
    expect(winnerSide(grid(['4', '6'], ['3', '6']), BEST_OF_3)).toBe(2)
    expect(winnerSide(grid(['6', '4'], ['3', '6'], ['8', '10']), BEST_OF_3)).toBe(2)
    expect(winnerSide(grid(['6', '4'], ['3', '6']), BEST_OF_3)).toBeNull()      // super tiebreak missing
    expect(winnerSide(grid(['6', '4']), BEST_OF_3)).toBeNull()                  // one set is not a match
    expect(winnerSide(emptyGrid(), BEST_OF_3)).toBeNull()
  })

  it('decides one set formats with their only set', () => {
    expect(winnerSide(grid(['8', '6']), PRO_SET)).toBe(1)
    expect(winnerSide(grid(['6', '7']), SINGLE_SET)).toBe(2)
    expect(winnerSide(grid(['6', '6']), SINGLE_SET)).toBeNull()
    expect(winnerSide(emptyGrid(), PRO_SET)).toBeNull()
  })

  it('knows which cells are filled', () => {
    expect(isFilled(['0', '0'])).toBe(true)
    expect(isFilled(['6', ''])).toBe(false)
  })
})

describe('score columns', () => {
  it('has one column for each one set format and three for best of 3', () => {
    expect(BEST_OF_3.map((c) => c.key)).toEqual(['set1', 'set2', 'stb'])
    expect(PRO_SET).toHaveLength(1)
    expect(SINGLE_SET).toHaveLength(1)
  })
})
