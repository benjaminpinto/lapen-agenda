import { test, expect, devices } from '@playwright/test';
import { testUsers } from '../fixtures/test-data';
import { loginUser, registerUser } from '../helpers/auth-helpers';

test.use({ ...devices['iPhone 12'] });

test.describe('Mobile Responsiveness', () => {
  test('should display mobile-friendly navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });

  test('should handle mobile form inputs', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toHaveValue('test@example.com');
  });

  test('should support mobile viewport (320px minimum)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });

  test('should display betting page on mobile', async ({ page }) => {
    await page.goto('/betting');
    await expect(page.locator('h1:has-text("Tigrinho LAPEN")').first()).toBeVisible();
  });
});
