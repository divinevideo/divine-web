// ABOUTME: Pins verify-og-tags.sh to survive a transient network blip against the live edge
// ABOUTME: One dropped connection out of 64 must not fail the deploy-gating OG parity audit

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = 'scripts/verify-og-tags.sh';

// Must match the SPA shell fallback the script asserts on.
const BRAND_TITLE = 'Divine Web - Short-form Looping Videos on Nostr';

// Read from the script so the fixture cannot drift from the route table.
const SYNTHETIC_NPUB = (() => {
  const source = readFileSync(SCRIPT, 'utf8');
  const match = source.match(/^SYNTHETIC_NPUB="([^"]+)"/m);

  if (!match) {
    throw new Error(`Could not read SYNTHETIC_NPUB from ${SCRIPT}`);
  }

  return match[1];
})();

/** Body that satisfies every assertion the script makes, for every route. */
function pageFor(baseUrl: string, requestPath: string): string {
  const title = requestPath.includes(SYNTHETIC_NPUB) ? BRAND_TITLE : 'Test Route Title';

  return [
    '<!doctype html><html><head>',
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:url" content="${baseUrl}${requestPath}">`,
    '<meta property="og:video" content="https://example.test/v.mp4">',
    '<meta name="twitter:card" content="player">',
    '<meta name="twitter:player" content="https://example.test/embed">',
    '</head><body><video src="https://example.test/v.mp4"></video></body></html>',
  ].join('');
}

type Fixture = {
  baseUrl: string;
  /** Number of connections dropped so far, keyed by path. */
  drops: Map<string, number>;
  server: Server;
};

/**
 * @param dropPlan path -> how many times to drop the connection before serving normally.
 *   Use Infinity for a route that never recovers.
 */
async function startFixture(dropPlan: Record<string, number> = {}): Promise<Fixture> {
  const drops = new Map<string, number>();

  const server = createServer((request, response) => {
    const requestPath = request.url ?? '/';
    const pathOnly = requestPath.split('?')[0];
    const budget = dropPlan[pathOnly] ?? 0;
    const dropped = drops.get(pathOnly) ?? 0;

    if (dropped < budget) {
      drops.set(pathOnly, dropped + 1);
      request.socket.destroy();
      return;
    }

    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    response.writeHead(200, {
      'content-security-policy': "frame-ancestors 'self' https:",
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex',
    });
    response.end(request.method === 'HEAD' ? '' : pageFor(baseUrl, requestPath));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    drops,
    server,
  };
}

/**
 * Must stay async: the fixture server shares this process's event loop, so a
 * synchronous spawn would deadlock the audit's own requests.
 */
function runAudit(baseUrl: string): Promise<{ output: string; status: number | null }> {
  return new Promise((resolve) => {
    const child = spawn('bash', [SCRIPT], {
      env: { ...process.env, BASE_URL: baseUrl, UA_ONLY: 'slackbot' },
    });

    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (status) => resolve({ output, status }));
  });
}

describe('verify-og-tags.sh network resilience', () => {
  let fixture: Fixture | undefined;

  afterEach(async () => {
    if (fixture) {
      // curl leaves keep-alive sockets open; close() alone would wait them out.
      fixture.server.closeAllConnections();
      await new Promise<void>((resolve) => fixture!.server.close(() => resolve()));
      fixture = undefined;
    }
  });

  it('passes when every route responds', async () => {
    fixture = await startFixture();

    const { output, status } = await runAudit(fixture.baseUrl);

    expect(output).toContain('All checks passed.');
    expect(status).toBe(0);
  }, 60_000);

  it('retries a route whose connection is dropped once', async () => {
    fixture = await startFixture({ '/discovery': 1 });

    const { output, status } = await runAudit(fixture.baseUrl);

    expect(fixture.drops.get('/discovery')).toBe(1);
    expect(output).toContain('recovered after a transient network error');
    expect(output).toContain('All checks passed.');
    expect(status).toBe(0);
  }, 60_000);

  it('reports a persistent connection drop as a network error, not HTTP 000000', async () => {
    fixture = await startFixture({ '/discovery': Number.POSITIVE_INFINITY });

    const { output, status } = await runAudit(fixture.baseUrl);

    expect(output).not.toContain('000000');
    expect(output).toMatch(/network error.*curl exit \d+/);
    expect(output).toContain('FAILED: 1 of 16 checks did not pass');
    expect(status).toBe(1);
  }, 60_000);
});
