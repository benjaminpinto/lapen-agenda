import { test, expect } from '@playwright/test';
import { testUsers } from '../fixtures/test-data';
import { createUserViaAPI } from '../helpers/api-helpers';

test.describe('Betting System', () => {
  test('should display betting page', async ({ page }) => {
    await page.goto('/betting');
    await expect(page.locator('h1:has-text("Tigrinho LAPEN 🐯")')).toBeVisible();
  });

  test('should show login prompt for unauthenticated users', async ({ page }) => {
    await page.goto('/betting');
    await expect(page.locator('text=Você precisa estar logado')).toBeVisible();
    await expect(page.getByTestId('login-link')).toBeVisible();
  });

  test('should display betting form when authenticated', async ({ page, request }) => {
    const uniqueEmail = `bet.${Date.now()}@example.com`;
    const userData = { ...testUsers.regular, email: uniqueEmail };
    const { token } = await createUserViaAPI(request, userData);
    
    await page.goto('/betting');
    await page.evaluate((token) => localStorage.setItem('auth_token', token), token);
    
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/matches')),
      page.reload()
    ]);
    
    await expect(page.getByTestId('betting-form')).toBeVisible();
  });

  test('should navigate to my bets page', async ({ page, request }) => {
    const uniqueEmail = `bet.${Date.now()}@example.com`;
    const userData = { ...testUsers.regular, email: uniqueEmail };
    const { token } = await createUserViaAPI(request, userData);
    
    await page.goto('/betting');
    await page.evaluate((token) => localStorage.setItem('auth_token', token), token);
    
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/matches')),
      page.reload()
    ]);
    
    await Promise.all([
      page.waitForURL('/my-bets'),
      page.getByTestId('my-bets-button').click()
    ]);
  });

  test('should display sections', async ({ page }) => {
    await page.goto('/betting');
    await expect(page.locator('h1:has-text("Tigrinho LAPEN")').first()).toBeVisible();
  });
});
