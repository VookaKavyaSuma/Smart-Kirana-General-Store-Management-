import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15 * 1000,
    navigationTimeout: 20 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm --prefix backend run dev',
      url: 'http://localhost:5000/api/health',
      reuseExistingServer: true,
      timeout: 30 * 1000,
    },
    {
      command: 'npm --prefix frontend run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30 * 1000,
    },
  ],
});
