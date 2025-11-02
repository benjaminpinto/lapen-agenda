import { Page } from '@playwright/test';

export async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

export async function registerUser(page: Page, userData: {
  email: string;
  password: string;
  name: string;
  phone: string;
  pix_key?: string;
  is_lapen_member?: boolean;
}) {
  await page.goto('/signup');
  await page.fill('input[name="name"]', userData.name);
  await page.fill('input[name="email"]', userData.email);
  await page.fill('input[name="phone"]', userData.phone);
  await page.fill('input[name="pix_key"]', userData.pix_key || userData.email);
  await page.fill('input[name="password"]', userData.password);
  await page.fill('input[name="confirmPassword"]', userData.password);
  
  if (userData.is_lapen_member) {
    await page.click('button:has-text("SIM")');
  }
  
  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/auth/register')),
    page.click('button[type="submit"]')
  ]);
}

export async function loginAdmin(page: Page, password: string) {
  await page.goto('/admin');
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/admin/dashboard');
}

export async function logout(page: Page) {
  // Open mobile menu if visible
  const menuButton = page.locator('button:has(svg.lucide-menu)');
  if (await menuButton.isVisible()) {
    await menuButton.click();
    await page.waitForTimeout(300);
  }
  
  await page.locator('button:has-text("Sair")').last().click();
  await page.waitForURL('/');
}
