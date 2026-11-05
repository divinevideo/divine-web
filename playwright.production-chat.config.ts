import { defineConfig, devices } from '@playwright/test';

const outDir = process.env.PLAYWRIGHT_CHAT_OUT_DIR;
if (!outDir) throw new Error('Run npm run test:production:chat to build an isolated synthetic artifact first');
const quotedOutDir = "'" + outDir.replace(/'/g, "'\"'\"'") + "'";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 8099);
export default defineConfig({
  testDir: './tests/production',
  outputDir: 'test-results/production-chat-run',
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, serviceWorkers: 'block', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  projects: [
    { name: 'configured', testMatch: 'configured-chat.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'capability', testMatch: 'capability-chat.spec.ts', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npx vite preview --outDir ${quotedOutDir} --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
