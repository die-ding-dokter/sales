import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 30000, fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', trace: 'retain-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI }
});
