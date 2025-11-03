import { request } from '@playwright/test';

async function cleanup() {
  const apiContext = await request.newContext({
    baseURL: process.env.BASE_URL || 'http://localhost:5001'
  });

  const browsers = ['chromium', 'firefox', 'webkit'];
  
  for (const browser of browsers) {
    try {
      const response = await apiContext.delete(`/api/test/cleanup?email_prefix=${browser}`);
      const data = await response.json();
      console.log(`✓ Cleaned up ${browser} test data:`, data);
    } catch (error) {
      console.error(`✗ Failed to cleanup ${browser}:`, error);
    }
  }

  await apiContext.dispose();
}

cleanup();
