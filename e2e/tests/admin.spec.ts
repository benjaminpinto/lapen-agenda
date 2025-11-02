import { test, expect } from '@playwright/test';
import { testAdmin } from '../fixtures/test-data';
import { loginAdmin } from '../helpers/auth-helpers';

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page, testAdmin.password);
  });

  test('should login to admin panel', async ({ page }) => {
    await expect(page).toHaveURL('/admin/dashboard');
    await expect(page.locator('text=Painel Administrativo')).toBeVisible();
  });

  test('should navigate to courts management', async ({ page }) => {
    await page.click('a:has-text("Quadras")');
    await expect(page).toHaveURL('/admin/courts');
    await expect(page.locator('text=Gerenciar Quadras')).toBeVisible();
  });

  test('should navigate to matches management', async ({ page }) => {
    await page.locator('a[href="/admin/matches"]').click();
    await expect(page).toHaveURL('/admin/matches');
    await expect(page.locator('text=Gerenciar Partidas')).toBeVisible();
  });

  test('should navigate to LAPEN approvals', async ({ page }) => {
    await page.locator('a[href="/admin/lapen-approvals"]').click();
    await expect(page).toHaveURL('/admin/lapen-approvals');
    await expect(page.locator('text=Aprovações de Membros LAPEN')).toBeVisible();
  });

  test('should navigate to reports', async ({ page }) => {
    await page.locator('a[href="/admin/matches"]').click();
    await page.waitForURL('/admin/matches');
    await page.locator('button:has-text("Ver Relatórios")').click();
    await expect(page).toHaveURL('/admin/reports');
  });

  test('should display dashboard statistics', async ({ page }) => {
    await expect(page.locator('text=Quadra Mais Agendada')).toBeVisible();
    await expect(page.locator('text=Top Jogadores')).toBeVisible();
  });

  test('should prevent access without authentication', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/admin/courts');
    
    await expect(page).toHaveURL('/admin');
  });
});
