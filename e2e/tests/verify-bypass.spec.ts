import { test, expect } from '@playwright/test';

test('verify deployment protection bypass', async ({ page }) => {
  console.log('Testing URL:', process.env.BASE_URL);
  console.log('Has bypass secret:', !!process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
  
  await page.goto('/');
  
  // If protection is active and bypass fails, we'd see a password prompt
  await expect(page).not.toHaveTitle(/password/i);
  await expect(page).not.toHaveURL(/password/i);
  
  console.log('Page loaded successfully - bypass working!');
});
