import {beforeEach, describe, expect, it, vi} from 'vitest'
import {
  formatDateForDisplay,
  getLocalDateString,
  getTomorrowDateString,
  isPastDate,
  isToday
} from '../../src/utils/dateUtils'

describe('Date Utils - Timezone Boundary Cases', () => {
  beforeEach(() => {
    // Reset any date mocks
    vi.useRealTimers()
  })

  describe('getLocalDateString', () => {
    it('should return correct date at midnight', () => {
      const midnight = new Date('2026-02-16T00:00:00-03:00') // UTC-3 timezone
      const result = getLocalDateString(midnight)
      expect(result).toBe('2026-02-16')
    })

    it('should return correct date at 11:59 PM', () => {
      const lateNight = new Date('2026-02-16T23:59:59-03:00') // UTC-3 timezone
      const result = getLocalDateString(lateNight)
      expect(result).toBe('2026-02-16')
    })

    it('should handle timezone boundary at 10 PM (UTC-3)', () => {
      // 10 PM UTC-3 = 1 AM UTC next day
      const tenPM = new Date('2026-02-16T22:00:00-03:00')
      const result = getLocalDateString(tenPM)
      expect(result).toBe('2026-02-16') // Should still be 16th in local time
    })

    it('should handle daylight saving time transition', () => {
      // Test around DST transition (example date)
      const dstDate = new Date('2026-10-18T22:00:00-03:00')
      const result = getLocalDateString(dstDate)
      expect(result).toBe('2026-10-18')
    })
  })

  describe('Timezone Boundary Scenarios', () => {
    it('should handle UTC-3 timezone at various hours', () => {
      const testCases = [
        { time: '00:00:00', expected: '2026-02-16' },
        { time: '12:00:00', expected: '2026-02-16' },
        { time: '21:00:00', expected: '2026-02-16' }, // 9 PM
        { time: '22:00:00', expected: '2026-02-16' }, // 10 PM (your reported issue time)
        { time: '23:59:59', expected: '2026-02-16' }
      ]

      testCases.forEach(({ time, expected }) => {
        const testDate = new Date(`2026-02-16T${time}-03:00`)
        const result = getLocalDateString(testDate)
        expect(result).toBe(expected)
      })
    })

    it('should handle cross-timezone date comparison', () => {
      // Same moment in time, different timezone representations
      const utcDate = new Date('2026-02-17T01:00:00Z') // 1 AM UTC
      const localDate = new Date('2026-02-16T22:00:00-03:00') // 10 PM UTC-3 (same moment)
      
      // Both represent the same moment — getLocalDateString uses local (UTC-3) timezone,
      // so both return the local date for that instant
      expect(getLocalDateString(utcDate)).toBe('2026-02-16') // Local date in UTC-3
      expect(getLocalDateString(localDate)).toBe('2026-02-16') // Local date in UTC-3
      expect(utcDate.getTime()).toBe(localDate.getTime()) // Same moment
    })
  })

  describe('isToday function', () => {
    it('should correctly identify today regardless of time', () => {
      const mockDate = new Date('2026-02-16T22:00:00-03:00')
      vi.setSystemTime(mockDate)

      expect(isToday('2026-02-16')).toBe(true)
      expect(isToday('2026-02-15')).toBe(false)
      expect(isToday('2026-02-17')).toBe(false)
    })

    it('should work correctly at timezone boundaries', () => {
      // Test at 10 PM UTC-3 (1 AM UTC next day)
      const mockDate = new Date('2026-02-16T22:00:00-03:00')
      vi.setSystemTime(mockDate)

      expect(isToday('2026-02-16')).toBe(true) // Should be true in local time
      expect(isToday('2026-02-17')).toBe(false) // Should be false even though it's 17th in UTC
    })
  })

  describe('isPastDate function', () => {
    it('should correctly identify past dates at timezone boundaries', () => {
      const mockDate = new Date('2026-02-16T22:00:00-03:00')
      vi.setSystemTime(mockDate)

      expect(isPastDate('2026-02-15')).toBe(true)
      expect(isPastDate('2026-02-16')).toBe(false) // Today should not be past
      expect(isPastDate('2026-02-17')).toBe(false)
    })
  })

  describe('Real-world scheduling scenarios', () => {
    it('should allow scheduling for today at 10 PM local time', () => {
      // Simulate the exact scenario from the bug report
      const mockDate = new Date('2026-02-16T22:00:00-03:00') // 10 PM UTC-3
      vi.setSystemTime(mockDate)

      const todayString = getLocalDateString()
      expect(todayString).toBe('2026-02-16')
      expect(isToday('2026-02-16')).toBe(true)
      expect(isPastDate('2026-02-16')).toBe(false)
    })

    it('should handle scheduling for past time slots on same day', () => {
      // At 10 PM, trying to schedule for 3 PM same day
      const mockDate = new Date('2026-02-16T22:00:00-03:00')
      vi.setSystemTime(mockDate)

      const todayString = getLocalDateString()
      expect(todayString).toBe('2026-02-16')
      
      // The date should be valid (not past date)
      // Time validation should be handled separately by backend
      expect(isPastDate('2026-02-16')).toBe(false)
    })

    it('should handle edge case at exactly midnight', () => {
      const mockDate = new Date('2026-02-17T00:00:00-03:00')
      vi.setSystemTime(mockDate)

      const todayString = getLocalDateString()
      expect(todayString).toBe('2026-02-17')
      expect(isPastDate('2026-02-16')).toBe(true)
      expect(isToday('2026-02-17')).toBe(true)
    })
  })

  describe('getTomorrowDateString', () => {
    it('should return correct tomorrow date at timezone boundaries', () => {
      const mockDate = new Date('2026-02-16T22:00:00-03:00')
      vi.setSystemTime(mockDate)

      const tomorrow = getTomorrowDateString()
      expect(tomorrow).toBe('2026-02-17')
    })

    it('should handle month boundary', () => {
      const mockDate = new Date('2026-02-28T22:00:00-03:00') // Last day of February
      vi.setSystemTime(mockDate)

      const tomorrow = getTomorrowDateString()
      expect(tomorrow).toBe('2026-03-01')
    })

    it('should handle year boundary', () => {
      const mockDate = new Date('2026-12-31T22:00:00-03:00')
      vi.setSystemTime(mockDate)

      const tomorrow = getTomorrowDateString()
      expect(tomorrow).toBe('2027-01-01')
    })
  })

  describe('formatDateForDisplay', () => {
    it('should format dates correctly for Brazilian format', () => {
      expect(formatDateForDisplay('2026-02-16')).toBe('16/02/2026')
      expect(formatDateForDisplay('2026-12-31')).toBe('31/12/2026')
      expect(formatDateForDisplay('2026-01-01')).toBe('01/01/2026')
    })
  })

  describe('Integration scenarios', () => {
    it('should simulate the exact bug scenario', () => {
      // February 16, 2026 at 10 PM UTC-3
      const bugScenarioTime = new Date('2026-02-16T22:00:00-03:00')
      vi.setSystemTime(bugScenarioTime)

      // User wants to schedule for 3 PM same day
      const desiredDate = '2026-02-16'
      
      // These should all work correctly now
      expect(getLocalDateString()).toBe('2026-02-16') // Today in local time
      expect(isToday(desiredDate)).toBe(true) // Should recognize as today
      expect(isPastDate(desiredDate)).toBe(false) // Should not be past date
      
      // The min date for input should be today
      const minDate = getLocalDateString()
      expect(minDate).toBe('2026-02-16')
      expect(desiredDate >= minDate).toBe(true) // Should allow selection
    })

    it('should prevent actual past dates', () => {
      const mockDate = new Date('2026-02-16T22:00:00-03:00')
      vi.setSystemTime(mockDate)

      expect(isPastDate('2026-02-15')).toBe(true) // Yesterday should be past
      expect(isPastDate('2026-02-14')).toBe(true) // Day before should be past
    })
  })
})