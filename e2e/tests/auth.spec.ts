import { test, expect } from '@playwright/test';
import { testUsers } from '../fixtures/test-data';
import { loginUser, registerUser, logout } from '../helpers/auth-helpers';

test.describe('Authentication', () => {
  test('should register new user successfully', async ({ page }) => {
    const uniqueEmail = `test.${Date.now()}@example.com`;
    const userData = { ...testUsers.regular, email: uniqueEmail };
    
    await registerUser(page, userData);
    await expect(page).toHaveURL('/signup-success');
    await expect(page.locator('text=Conta Criada!')).toBeVisible();
  });

  test('should show error for duplicate email', async ({ page }) => {
    const userData = testUsers.regular;
    
    await registerUser(page, userData);
    await page.goto('/signup');
    await registerUser(page, userData);
    
    await expect(page.locator('text=Email já cadastrado')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    const uniqueEmail = `login.${Date.now()}@example.com`;
    const userData = { ...testUsers.regular, email: uniqueEmail };
    
    await registerUser(page, userData);
    
    await page.goto('/login');
    await page.fill('input[name="email"]', userData.email);
    await page.fill('input[name="password"]', userData.password);
    
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/auth/login')),
      page.click('button[type="submit"]')
    ]);
    
    await page.waitForURL('/');
    
    // Open mobile menu to see user greeting
    const menuButton = page.locator('button:has(svg.lucide-menu)');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300);
    }
    
    await expect(page.locator('text=Olá').last()).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/auth/login')),
      page.click('button[type="submit"]')
    ]);
    
    await expect(page.locator('text=Email ou senha inválidos')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    const uniqueEmail = `logout.${Date.now()}@example.com`;
    const userData = { ...testUsers.regular, email: uniqueEmail };
    
    await registerUser(page, userData);
    await loginUser(page, userData.email, userData.password);
    await logout(page);
    
    await expect(page).toHaveURL('/');
  });

  test('should request password reset', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.fill('input[name="email"]', testUsers.regular.email);
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Email enviado').first()).toBeVisible();
  });

  test('should register LAPEN member with approval pending', async ({ page }) => {
    const uniqueEmail = `lapen.${Date.now()}@example.com`;
    const userData = { ...testUsers.lapenMember, email: uniqueEmail };
    
    await registerUser(page, userData);
    await expect(page).toHaveURL('/signup-success');
    await expect(page.locator('text=Conta Criada!')).toBeVisible();
  });
});
