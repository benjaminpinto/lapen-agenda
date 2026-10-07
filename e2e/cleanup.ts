import {request} from '@playwright/test';

async function cleanup() {
  const apiContext = await request.newContext({
    baseURL: process.env.BASE_URL || 'http://localhost:5001'
  });

  const namePatterns = ['Test User', 'LAPEN Member'];
  
  for (const name of namePatterns) {
    try {
      const response = await apiContext.delete(`/api/test/cleanup?name=${encodeURIComponent(name)}`);
      const data = await response.json();
      console.log(`✓ Cleaned up users with name "${name}":`, data);
    } catch (error) {
      console.error(`✗ Failed to cleanup "${name}":`, error);
    }
  }

  // Tournament specs need E2E_TEST_SECRET on both sides: without it they skip themselves and there is nothing to clean
  if (process.env.E2E_TEST_SECRET) {
    try {
      const response = await apiContext.delete('/api/test/tournaments/cleanup', { headers: { 'X-Test-Secret': process.env.E2E_TEST_SECRET } });
      console.log('✓ Cleaned up test tournaments:', await response.json());
    } catch (error) {
      console.error('✗ Failed to cleanup tournaments:', error);
    }
  }

  await apiContext.dispose();
}

cleanup();
