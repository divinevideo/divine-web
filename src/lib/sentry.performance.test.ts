import { afterAll, expect, it, vi } from 'vitest';

import { initializeSentry, Sentry } from './sentry';

const privateHost = 'synthetic-person.example.test';
const privatePath = 'synthetic-private-id';
const privateQuery = 'synthetic-search-value';
const privateFragment = 'synthetic-fragment';
const privateUser = 'synthetic-user';
const pagePath = `/profile/${privatePath}?q=${privateQuery}#${privateFragment}`;
const resourceUrl = `https://${privateHost}${pagePath}`;

afterAll(async () => {
  await Sentry.close(1_000);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

it('keeps only route templates and measurement data in outgoing Sentry performance envelopes', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  vi.stubEnv('VITE_SENTRY_DEV_ENABLED', 'true');
  vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.invalid/1');
  vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'production');
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  window.history.replaceState(null, '', pagePath);
  initializeSentry();

  Sentry.withScope(scope => {
    scope.setUser({ id: privateUser });
    scope.addBreadcrumb({ category: 'fetch', message: resourceUrl });
    scope.addAttachment({ filename: privatePath, data: privateHost });
    Sentry.captureEvent({
      type: 'transaction',
      transaction: pagePath,
      transaction_info: { source: 'url' },
      request: { url: resourceUrl, headers: { Referer: resourceUrl } },
      measurements: { lcp: { value: 321, unit: 'millisecond' } },
      sdkProcessingMetadata: {
        dynamicSamplingContext: { transaction: pagePath },
      },
      contexts: {
        trace: {
          op: 'pageload', trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16),
          data: { 'url.full': resourceUrl },
        },
      },
      spans: [{
        op: 'http.client', description: `GET ${resourceUrl}`,
        span_id: 'c'.repeat(16), trace_id: 'a'.repeat(32),
        parent_span_id: 'b'.repeat(16), start_timestamp: 1, timestamp: 2,
        data: { 'url.full': resourceUrl, 'http.response.status_code': 200 },
      }],
    });
  });

  Sentry.startInactiveSpan({
    name: pagePath, op: 'ui.content_ready', forceTransaction: true,
    attributes: { 'route.name': pagePath, 'content.outcome': 'ready', 'navigation.type': 'pageload' },
  }).end();

  const inp = Sentry.startInactiveSpan({
    name: `button#${privatePath}`,
    attributes: {
      'sentry.op': 'ui.interaction.click', 'sentry.origin': 'auto.http.browser.inp',
      transaction: pagePath, user: privateUser, 'url.full': resourceUrl,
    },
    experimental: { standalone: true },
  });
  inp.addEvent('inp', { 'sentry.measurement_unit': 'millisecond', 'sentry.measurement_value': 45 });
  inp.end();

  expect(await Sentry.flush(1_000)).toBe(true);
  const sent = fetch.mock.calls.map(([, options]) => {
    const body = options?.body;
    return {
      body: body instanceof Uint8Array ? new TextDecoder().decode(body) : String(body),
      referrerPolicy: options?.referrerPolicy,
    };
  }).filter(request => /"type":"(?:transaction|span)"/.test(request.body));
  expect(sent).toHaveLength(3);
  expect(sent.map(request => request.referrerPolicy)).toEqual(Array(3).fill('no-referrer'));
  const performance = sent.map(request => request.body).join('\n');
  for (const value of [privateHost, privatePath, privateQuery, privateFragment, privateUser]) {
    expect(performance).not.toContain(value);
  }
  expect(performance).toContain('"transaction":"/profile/:npub"');
  expect(performance).toContain('"lcp":{"value":321,"unit":"millisecond"}');
  expect(performance).toContain('"inp":{"value":45,"unit":"millisecond"}');
  expect(performance).toContain('"http.response.status_code":200');
  expect(performance).toContain('"content.outcome":"ready"');
});
