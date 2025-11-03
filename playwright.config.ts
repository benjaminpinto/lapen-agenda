import { defineConfig, devices } from '@playwright/test';
import * as os from 'node:os';
import * as dotenv from 'dotenv';

if (!process.env.CI || process.env.CI === 'false') {
  dotenv.config();
}

console.log('CI:', process.env.CI, 'Workers:', process.env.CI && process.env.CI !== 'false' ? 6 : undefined);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI && process.env.CI !== 'false' ? 6 : undefined,
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['allure-playwright', {
      resultsDir: 'allure-results',
      detail: true,
      suiteTitle: true,
      environmentInfo: {
        os_platform: os.platform(),
        os_release: os.release(),
        os_version: os.version(),
        node_version: process.version,
      },
    }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 10000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      fullyParallel: true,
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      fullyParallel: true,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      fullyParallel: true,
    },
  ],
  webServer: process.env.CI && process.env.CI !== 'false' ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
