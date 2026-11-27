import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: false,
    timeout: 60000,
    cwd: '.',
  },
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
});
