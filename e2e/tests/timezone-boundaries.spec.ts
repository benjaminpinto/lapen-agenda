import {expect, test} from '@playwright/test'

test.describe('Schedule Form - Timezone Boundary Cases', () => {
  test.beforeEach(async ({ page }) => {
    // Set timezone to UTC-3 (Brazil)
    await page.addInitScript(() => {
      // Mock timezone offset to UTC-3
      const originalDate = Date
      global.Date = class extends originalDate {
        constructor(...args) {
          if (args.length === 0) {
            super()
            // Simulate UTC-3 timezone
            this.getTimezoneOffset = () => 180 // 180 minutes = UTC-3
          } else {
            super(...args)
          }
        }
        
        static now() {
          return originalDate.now()
        }
      }
    })
  })

  test('should allow scheduling for today at 10 PM local time (bug scenario)', async ({ page }) => {
    // Set system time to February 16, 2026 at 10 PM UTC-3
    await page.clock.setFixedTime(new Date('2026-02-16T22:00:00-03:00'))
    
    await page.goto('/schedule')
    
    // Select match type first
    await page.getByText('Amistoso').click()
    
    // Check that date input allows selecting today's date
    const dateInput = page.locator('input[type="date"]')
    
    // The min attribute should be today's date in local timezone
    const minDate = await dateInput.getAttribute('min')
    expect(minDate).toBe('2026-02-16')
    
    // Should be able to select today's date
    await dateInput.fill('2026-02-16')
    
    // Verify the date was accepted (no validation error)
    const dateValue = await dateInput.inputValue()
    expect(dateValue).toBe('2026-02-16')
    
    // Should not show any error about selecting tomorrow
    await expect(page.getByText('Selecione a data 02/17')).not.toBeVisible()
  })

  test('should handle timezone boundary at exactly midnight', async ({ page }) => {
    // Set to exactly midnight UTC-3
    await page.clock.setFixedTime(new Date('2026-02-17T00:00:00-03:00'))
    
    await page.goto('/schedule')
    await page.getByText('Amistoso').click()
    
    const dateInput = page.locator('input[type="date"]')
    const minDate = await dateInput.getAttribute('min')
    
    // Should be the new day now
    expect(minDate).toBe('2026-02-17')
    
    // Previous day should not be selectable
    await dateInput.fill('2026-02-16')
    
    // Browser should prevent selecting past date
    const dateValue = await dateInput.inputValue()
    expect(dateValue).not.toBe('2026-02-16')
  })

  test('should handle late night scheduling (11:59 PM)', async ({ page }) => {
    // Set to 11:59 PM UTC-3 (still same day locally)
    await page.clock.setFixedTime(new Date('2026-02-16T23:59:59-03:00'))
    
    await page.goto('/schedule')
    await page.getByText('Amistoso').click()
    
    const dateInput = page.locator('input[type="date"]')
    const minDate = await dateInput.getAttribute('min')
    
    // Should still be today
    expect(minDate).toBe('2026-02-16')
    
    // Should allow selecting today
    await dateInput.fill('2026-02-16')
    const dateValue = await dateInput.inputValue()
    expect(dateValue).toBe('2026-02-16')
  })

  test('should prevent selecting actual past dates', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-02-16T22:00:00-03:00'))
    
    await page.goto('/schedule')
    await page.getByText('Amistoso').click()
    
    const dateInput = page.locator('input[type="date"]')
    
    // Try to select yesterday
    await dateInput.fill('2026-02-15')
    
    // Browser should prevent this or show validation error
    const dateValue = await dateInput.inputValue()
    expect(dateValue).not.toBe('2026-02-15')
  })

  test('should work correctly during different hours of the day', async ({ page }) => {
    const testCases = [
      { time: '2026-02-16T09:00:00-03:00', expectedMin: '2026-02-16' }, // 9 AM
      { time: '2026-02-16T15:00:00-03:00', expectedMin: '2026-02-16' }, // 3 PM (desired schedule time)
      { time: '2026-02-16T21:00:00-03:00', expectedMin: '2026-02-16' }, // 9 PM
      { time: '2026-02-16T22:00:00-03:00', expectedMin: '2026-02-16' }, // 10 PM (bug time)
      { time: '2026-02-16T23:30:00-03:00', expectedMin: '2026-02-16' }  // 11:30 PM
    ]

    for (const { time, expectedMin } of testCases) {
      await page.clock.setFixedTime(new Date(time))
      await page.goto('/schedule')
      await page.getByText('Amistoso').click()
      
      const dateInput = page.locator('input[type="date"]')
      const minDate = await dateInput.getAttribute('min')
      
      expect(minDate).toBe(expectedMin)
      
      // Should be able to select today's date
      await dateInput.fill(expectedMin)
      const dateValue = await dateInput.inputValue()
      expect(dateValue).toBe(expectedMin)
    }
  })

  test('should handle month and year boundaries', async ({ page }) => {
    // Test end of month
    await page.clock.setFixedTime(new Date('2026-02-28T22:00:00-03:00'))
    await page.goto('/schedule')
    await page.getByText('Amistoso').click()
    
    let dateInput = page.locator('input[type="date"]')
    let minDate = await dateInput.getAttribute('min')
    expect(minDate).toBe('2026-02-28')
    
    // Test end of year
    await page.clock.setFixedTime(new Date('2026-12-31T22:00:00-03:00'))
    await page.reload()
    await page.getByText('Amistoso').click()
    
    dateInput = page.locator('input[type="date"]')
    minDate = await dateInput.getAttribute('min')
    expect(minDate).toBe('2026-12-31')
  })

  test('should maintain consistent behavior across page reloads', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-02-16T22:00:00-03:00'))
    
    // First load
    await page.goto('/schedule')
    await page.getByText('Amistoso').click()
    
    let dateInput = page.locator('input[type="date"]')
    let minDate1 = await dateInput.getAttribute('min')
    
    // Reload page
    await page.reload()
    await page.getByText('Amistoso').click()
    
    dateInput = page.locator('input[type="date"]')
    let minDate2 = await dateInput.getAttribute('min')
    
    // Should be consistent
    expect(minDate1).toBe(minDate2)
    expect(minDate1).toBe('2026-02-16')
  })
})