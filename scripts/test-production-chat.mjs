import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = JSON.parse(readFileSync(new URL('../test-fixtures/concord/community-interop.json', import.meta.url), 'utf8'));
const outDir = mkdtempSync(join(tmpdir(), 'divine-production-chat-'));
try {
  for (const project of ['configured', 'capability']) {
    const env = { ...process.env, PLAYWRIGHT_CHAT_OUT_DIR: outDir, VITE_CONCORD_INVITE_URL: project === 'configured' ? fixture.inviteUrl : '', VITE_CHAT_POC_ENABLED: 'false', VITE_PRODUCT_ANALYTICS_ENABLED: 'false' };
    for (const args of [['vite', 'build', '--outDir', outDir, '--emptyOutDir'], ['playwright', 'test', '--config', 'playwright.production-chat.config.ts', '--project', project]]) {
      const result = spawnSync('npx', args, { cwd: root, env, stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`Production chat ${project} verification failed (exit ${result.status ?? 1})`);
    }
  }
} finally { rmSync(outDir, { recursive: true, force: true }); }
