import { defineConfig, devices } from '@playwright/test';

// Use a dedicated port so parallel worktrees on 8080 don't collide.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 8088);
const BASE_URL = `http://localhost:${PORT}`;
const FULL_MODE_PORT = Number(process.env.PLAYWRIGHT_FULL_MODE_PORT ?? 8089);
const FULL_MODE_BASE_URL = `http://localhost:${FULL_MODE_PORT}`;

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'full-mode-a11y',
      testMatch: /a11y\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: FULL_MODE_BASE_URL },
    },
  ],
  webServer: [
    {
      command: `npx vite --port ${PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `VITE_WEB_MODE=full npx vite --port ${FULL_MODE_PORT} --strictPort`,
      url: FULL_MODE_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
