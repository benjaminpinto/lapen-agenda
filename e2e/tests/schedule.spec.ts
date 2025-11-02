import { test, expect } from '@playwright/test';

test.describe('Schedule Management', () => {
  test('should display schedule view', async ({ page }) => {
    await page.goto('/view');
    await expect(page.locator('header')).toBeVisible();
  });

  test('should navigate to schedule form', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('schedule-button').click();
    await expect(page).toHaveURL('/schedule');
  });

  test('should navigate to view from home', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('view-schedule-button').click();
    await expect(page).toHaveURL('/view');
  });
});
