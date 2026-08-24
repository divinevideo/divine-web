// ABOUTME: Pins the OG audit's alert-on-failure path and the workflow wiring behind it
// ABOUTME: A live-edge monitor must page #divine-alerts, not paint main red (see run 32740711299)

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = 'scripts/notify-og-audit-failure.sh';
const WORKFLOW = readFileSync('.github/workflows/og-audit.yml', 'utf8');

const scratch = mkdtempSync(join(tmpdir(), 'og-audit-alert-'));

function auditLog(failureLines: string[], total = 64): string {
  const path = join(scratch, `audit-${failureLines.length}-${total}.log`);
  writeFileSync(
    path,
    [
      'Summary',
      `Total checks:  ${total}`,
      `Passed:        ${total - failureLines.length}`,
      `Failed:        ${failureLines.length}`,
      '',
      'Failures:',
      ...failureLines.map((line) => `  X ${line}`),
      '',
      `FAILED: ${failureLines.length} of ${total} checks did not pass`,
    ].join('\n'),
  );

  return path;
}

type Capture = { bodies: string[]; server: Server; url: string };

async function startWebhook(status = 200): Promise<Capture> {
  const bodies: string[] = [];

  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      bodies.push(body);
      response.writeHead(status);
      response.end('ok');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    bodies,
    server,
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`,
  };
}

function runNotifier(env: Record<string, string>): Promise<{ output: string; status: number | null }> {
  return new Promise((resolve) => {
    const child = spawn('bash', [SCRIPT], { env: { ...process.env, ...env } });

    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (status) => resolve({ output, status }));
  });
}

const RUN_URL = 'https://github.com/divinevideo/divine-web/actions/runs/32740711299';

describe('notify-og-audit-failure.sh', () => {
  let capture: Capture | undefined;

  afterEach(async () => {
    if (capture) {
      capture.server.closeAllConnections();
      await new Promise<void>((resolve) => capture!.server.close(() => resolve()));
      capture = undefined;
    }
  });

  it('posts the failing routes and a link to the run', async () => {
    capture = await startWebhook();

    const { status } = await runNotifier({
      AUDIT_LOG: auditLog(['discord /discovery: HTTP 404', 'twitter /kids (kids policy page)']),
      AUDIT_TARGET: 'production (divine.video)',
      RUN_URL,
      SLACK_WEBHOOK: capture.url,
    });

    expect(status).toBe(0);
    expect(capture.bodies).toHaveLength(1);

    const text = JSON.parse(capture.bodies[0]).text as string;
    expect(text).toContain('OG parity audit failed');
    expect(text).toContain('production (divine.video)');
    expect(text).toContain('2 of 64');
    expect(text).toContain('discord /discovery: HTTP 404');
    expect(text).toContain('twitter /kids (kids policy page)');
    expect(text).toContain(RUN_URL);
  }, 30_000);

  it('calls out an all-network-error failure as an edge blip, not an OG regression', async () => {
    capture = await startWebhook();

    await runNotifier({
      AUDIT_LOG: auditLog([
        'discord /discovery: network error (curl exit 52)',
        'twitter /discovery/classics: network error (curl exit 52)',
      ]),
      AUDIT_TARGET: 'production (divine.video)',
      RUN_URL,
      SLACK_WEBHOOK: capture.url,
    });

    const text = JSON.parse(capture.bodies[0]).text as string;
    expect(text).toContain('network-level');
    expect(text).not.toContain('🔴');
  }, 30_000);

  it('treats any content failure as a real regression even when mixed with network errors', async () => {
    capture = await startWebhook();

    await runNotifier({
      AUDIT_LOG: auditLog([
        'discord /discovery: network error (curl exit 52)',
        'twitter /kids (kids policy page)',
      ]),
      AUDIT_TARGET: 'production (divine.video)',
      RUN_URL,
      SLACK_WEBHOOK: capture.url,
    });

    const text = JSON.parse(capture.bodies[0]).text as string;
    expect(text).toContain('🔴');
    expect(text).not.toContain('network-level');
  }, 30_000);

  it('states how many failures it truncated instead of silently capping', async () => {
    capture = await startWebhook();

    const many = Array.from({ length: 13 }, (_, index) => `discord /route-${index}: HTTP 404`);
    await runNotifier({
      AUDIT_LOG: auditLog(many),
      AUDIT_TARGET: 'production (divine.video)',
      RUN_URL,
      SLACK_WEBHOOK: capture.url,
    });

    const text = JSON.parse(capture.bodies[0]).text as string;
    expect(text).toContain('discord /route-0: HTTP 404');
    expect(text).toContain('3 more');
    expect(text).not.toContain('/route-12:');
  }, 30_000);

  it('reports an unreachable target when the audit never got to run checks', async () => {
    capture = await startWebhook();

    const path = join(scratch, 'unreachable.log');
    writeFileSync(path, 'ERROR: cannot reach https://divine.video\n       curl: (35) TLS connect error\n');

    await runNotifier({
      AUDIT_LOG: path,
      AUDIT_TARGET: 'production (divine.video)',
      RUN_URL,
      SLACK_WEBHOOK: capture.url,
    });

    const text = JSON.parse(capture.bodies[0]).text as string;
    expect(text).toContain('could not be reached');
    expect(text).toContain('TLS connect error');
  }, 30_000);

  it('reports when the audit could not run at all, so a broken monitor is not silent', async () => {
    capture = await startWebhook();

    const { status } = await runNotifier({
      AUDIT_TARGET: 'Cloudflare production',
      AUDIT_UNAVAILABLE_REASON: 'Could not list Cloudflare Pages deployments.',
      RUN_URL,
      SLACK_WEBHOOK: capture.url,
    });

    expect(status).toBe(0);

    const text = JSON.parse(capture.bodies[0]).text as string;
    expect(text).toContain('could not run');
    expect(text).toContain('Could not list Cloudflare Pages deployments.');
    expect(text).toContain(RUN_URL);
  }, 30_000);

  it('no-ops when no webhook is configured', async () => {
    const { output, status } = await runNotifier({
      AUDIT_LOG: auditLog(['discord /discovery: HTTP 404']),
      AUDIT_TARGET: 'production (divine.video)',
      RUN_URL,
      SLACK_WEBHOOK: '',
    });

    expect(status).toBe(0);
    expect(output).toContain('skipping');
  }, 30_000);

  it('never fails the job when the webhook POST fails', async () => {
    const { output, status } = await runNotifier({
      AUDIT_LOG: auditLog(['discord /discovery: HTTP 404']),
      AUDIT_TARGET: 'production (divine.video)',
      RUN_URL,
      SLACK_WEBHOOK: 'http://127.0.0.1:59997/dead',
    });

    expect(status).toBe(0);
    expect(output).toContain('WARNING');
  }, 30_000);
});

describe('og-audit workflow wiring', () => {
  it('never lets an automated audit run fail the build', () => {
    // continue-on-error must be unconditional. The old `${{ github.event_name ==
    // 'schedule' }}` form left post-deploy runs hard-failing on a dropped
    // connection, which is what run 32740711299 did.
    const conditional = WORKFLOW.match(/continue-on-error:\s*\$\{\{[^\n]*event_name[^\n]*\}\}/g);
    expect(conditional).toBeNull();

    const audits = WORKFLOW.match(/verify-og-tags\.sh/g) ?? [];
    const alwaysOn = WORKFLOW.match(/continue-on-error:\s*true/g) ?? [];
    expect(audits.length).toBeGreaterThan(0);
    expect(alwaysOn.length).toBeGreaterThanOrEqual(audits.length);
  });

  it('alerts #divine-alerts for every audit it runs', () => {
    // >= because a target that could not be discovered also alerts, without
    // having an audit step of its own to pair with.
    const audits = (WORKFLOW.match(/verify-og-tags\.sh/g) ?? []).length;
    const alerts = (WORKFLOW.match(/notify-og-audit-failure\.sh/g) ?? []).length;
    expect(audits).toBeGreaterThan(0);
    expect(alerts).toBeGreaterThanOrEqual(audits);
    expect(WORKFLOW).toContain('SLACK_DIVINE_ALERTS_WEBHOOK');
  });

  it('still fails a manually dispatched audit so an on-demand check gives a verdict', () => {
    expect(WORKFLOW).toMatch(/github\.event_name == 'workflow_dispatch'[\s\S]{0,400}?exit 1/);
  });
});
