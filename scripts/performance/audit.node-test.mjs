import assert from 'node:assert/strict';
import { test } from 'node:test';
import { percentile, summarize, normalizeRoute, redactRequest, outcomeFailure, parseOptions, isExpectedRoute } from './report.mjs';

test('p75 uses nearest rank on measured samples only', () => {
  assert.equal(percentile([1000, 4000, 2000, 3000], 0.75), 3000);
  assert.equal(percentile([null, undefined, 0, 20], 0.75), 20);
  assert.equal(percentile([null], 0.75), null);
});

test('summary preserves missing metrics instead of reporting zero or full coverage', () => {
  const summary = summarize([
    { route: '/', device: 'mobile', lcpMs: null, cls: 0, failures: ['content-timeout'] },
    { route: '/', device: 'mobile', lcpMs: 3000, cls: 0, failures: [] },
  ]);
  assert.equal(summary[0].metrics.lcpMs.p75, 3000);
  assert.equal(summary[0].metrics.lcpMs.measured, 1);
  assert.equal(summary[0].metrics.lcpMs.missing, 1);
  assert.equal(summary[0].metrics.cls.p75, 0);
  assert.equal(summary[0].failedSamples, 1);
  assert.ok(summary[0].warnings.includes('lcp-target-exceeded'));
  assert.ok(summary[0].warnings.includes('small-sample-count'));
});

test('artifacts reduce route identifiers and search values to templates', () => {
  assert.equal(normalizeRoute('/video/synthetic-identifier?q=private#secret'), '/video/:id');
  assert.equal(normalizeRoute('/u/synthetic-creator'), '/u/:name');
  assert.equal(normalizeRoute('/profile/synthetic-identifier'), '/profile/:id');
  assert.equal(normalizeRoute('/search?q=private'), '/search?q=:query');
  assert.equal(normalizeRoute('/unexpected/synthetic-identifier'), '/:path');
  assert.deepEqual(redactRequest('https://media.example.test/accounts/private/video.mp4?token=secret', 403), {
    origin: 'external-origin', path: '/:path', status: 403,
  });
  assert.deepEqual(redactRequest('https://api.example.test/api/users/private/videos?token=secret', 500), {
    origin: 'external-origin', path: '/api/users/:id/videos', status: 500,
  });
});

test('timeout and empty outcomes cannot pass primary content readiness', () => {
  assert.equal(outcomeFailure('timeout'), 'content-timeout');
  assert.equal(outcomeFailure('empty'), 'content-empty');
  assert.equal(outcomeFailure('error'), 'content-error');
  assert.equal(outcomeFailure('ready'), null);
});

test('options bound sampling and reject origin paths and credentials', () => {
  assert.equal(parseOptions([], {}).samples, 3);
  assert.equal(parseOptions(['--samples', '1', '--strict'], {}).strict, true);
  assert.throws(() => parseOptions(['--samples', '100'], {}));
  assert.throws(() => parseOptions(['--origin', 'https://user:secret@example.test'], {}));
  assert.throws(() => parseOptions(['--origin', 'https://example.test/private'], {}));
});

test('mobile throttling is explicit and soft navigation does not invent native navigation metrics', () => {
  assert.equal(parseOptions(['--throttle'], {}).throttle, true);
  assert.equal(parseOptions([], {}).throttle, false);
  const [row] = summarize([{ route: '/video/:id', device: 'mobile', mode: 'soft-navigation', failures: [], contentReadyMs: 100 }]);
  assert.equal(row.metrics.lcpMs.applicable, false);
  assert.equal(row.metrics.lcpMs.missing, 0);
  assert.ok(!row.warnings.includes('missing-lcp'));
});


test('canonical discovery redirects are accepted but unrelated routes fail', () => {
  assert.equal(normalizeRoute('/discovery/classics'), '/discovery/:tab');
  assert.equal(isExpectedRoute('/', '/discovery/classics'), true);
  assert.equal(isExpectedRoute('/discovery', '/discovery/classics'), true);
  assert.equal(isExpectedRoute('/popular', '/discovery/classics'), false);
  assert.equal(isExpectedRoute('/', '/login'), false);
});

test('network origin redaction excludes personal subdomains and identity domains', () => {
  const personal = redactRequest('https://synthetic-creator.divine.video/.well-known/nostr.json?name=private', 404);
  const identity = redactRequest('https://synthetic-identity.example/.well-known/nostr.json?name=private', 'network-error');
  assert.equal(personal.origin, 'external-origin');
  assert.equal(identity.origin, 'external-origin');
  assert.ok(!JSON.stringify([personal, identity]).includes('synthetic-'));
  assert.equal(redactRequest('https://api.divine.video/api/videos', 500).origin, 'https://api.divine.video');
});

test('human report includes bounded background request failures without failing healthy content', async () => {
  const { renderMarkdown } = await import('./report.mjs');
  const samples = [{ route: '/', mode: 'cold', device: 'desktop', sample: 1, failures: [],
    networkFailures: [{ origin: 'https://media.divine.video', path: '/:path', status: 502 }] }];
  const markdown = renderMarkdown({ samples, summary: summarize(samples), configuration: {}, origin: 'https://divine.video', browserVersion: 'synthetic', generatedAt: 'synthetic' });
  assert.ok(markdown.includes('| https://media.divine.video | /:path | 502 | 1 |'));
  assert.ok(markdown.includes('Background request failures'));
});
