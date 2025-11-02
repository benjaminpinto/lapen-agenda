import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });

  test('should navigate to betting page', async ({ page }) => {
    await page.goto('/');
    
    const menuButton = page.locator('button:has(svg.lucide-menu)');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300);
      await page.locator('nav a[href="/betting"]').last().click();
    } else {
      await page.click('a:has-text("Apostas")');
    }
    
    await page.waitForURL('/betting');
  });

  test('should navigate to schedule view', async ({ page }) => {
    await page.goto('/');
    
    const menuButton = page.locator('button:has(svg.lucide-menu)');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300);
      await page.locator('nav a[href="/view"]').last().click();
    } else {
      await page.click('a:has-text("Ver Agenda")');
    }
    
    await page.waitForURL('/view');
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    
    const menuButton = page.locator('button:has(svg.lucide-menu)');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300);
      await page.locator('nav a[href="/login"]').last().click();
    } else {
      await page.click('a:has-text("Entrar")');
    }
    
    await page.waitForURL('/login');
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/');
    
    const menuButton = page.locator('button:has(svg.lucide-menu)');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300);
      await page.locator('nav a[href="/signup"]').last().click();
    } else {
      await page.click('a:has-text("Criar Conta")');
    }
    
    await page.waitForURL('/signup');
  });

  test('should display header on all pages', async ({ page }) => {
    const pages = ['/', '/betting', '/view', '/login', '/signup'];
    
    for (const url of pages) {
      await page.goto(url);
      await expect(page.locator('header')).toBeVisible();
    }
  });

  test('should handle 404 navigation', async ({ page }) => {
    await page.goto('/non-existent-page');
    await expect(page).toHaveURL('/non-existent-page');
  });

  test('should navigate back from login to home', async ({ page }) => {
    await page.goto('/');
    await page.goto('/login');
    await page.goBack();
    await expect(page).toHaveURL('/');
  });
});
