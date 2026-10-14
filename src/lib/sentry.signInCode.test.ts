// ABOUTME: Pins that Sentry's hooks remove a one-time sign-in code from
// ABOUTME: errors, transactions, breadcrumbs and Replay's performance entries.

import { afterEach, describe, expect, it, vi } from 'vitest';

const sentryMock = vi.hoisted(() => ({
  init: vi.fn(),
  replayOptions: undefined as undefined | { beforeAddRecordingEvent: (event: unknown) => unknown },
}));

vi.mock('@sentry/react', () => ({
  init: sentryMock.init,
  browserTracingIntegration: () => ({}),
  replayIntegration: (options: typeof sentryMock.replayOptions) => {
    sentryMock.replayOptions = options;
    return {};
  },
  httpClientIntegration: () => ({}),
  captureConsoleIntegration: () => ({}),
}));

import { initializeSentry, scrubSignInCode } from './sentry';

const CODE = 'C'.repeat(43);
const ORIGIN = 'https://divine.video';
// The browser keeps the address the page was opened with in its navigation
// timing entry, and Sentry names spans and replay entries from it.
const OPENED_WITH_QUERY = `${ORIGIN}/app/callback?signin=abc&oauth_confirm=${CODE}`;
const OPENED_WITH_FRAGMENT = `${ORIGIN}/app/callback?signin=abc#oauth_confirm=${CODE}`;
const OPENED_WITH_BOTH = `${ORIGIN}/app/callback?signin=abc&oauth_confirm=${CODE}#oauth_confirm=${CODE}&_=_`;

type Hooks = {
  beforeSend: (event: unknown, hint: unknown) => unknown;
  beforeSendTransaction: (event: unknown, hint: unknown) => unknown;
  beforeBreadcrumb: (breadcrumb: unknown, hint?: unknown) => unknown;
};

function startSentry(): Hooks {
  sentryMock.init.mockClear();
  vi.stubEnv('VITE_SENTRY_DEV_ENABLED', 'true');
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  initializeSentry();
  return sentryMock.init.mock.calls[0][0] as Hooks;
}

function navigationSpan(op: string, description: string) {
  return {
    op,
    description,
    span_id: 'a'.repeat(16),
    trace_id: 'b'.repeat(32),
    start_timestamp: 1,
    timestamp: 2,
    origin: 'auto.ui.browser.metrics',
    data: { 'sentry.op': op, 'sentry.origin': 'auto.ui.browser.metrics' },
  };
}

describe('scrubSignInCode', () => {
  it.each(['oauth%5Fconfirm', 'oauth%5fconfirm'])('scrubs encoded parameter name %s', (name) => {
    expect(scrubSignInCode(`${ORIGIN}/app/callback?${name}=${CODE}`)).not.toContain(CODE);
  });

  it('can be passed directly to Array.map', () => {
    const events = [{ url: OPENED_WITH_QUERY }, { url: OPENED_WITH_FRAGMENT }];
    expect(() => events.map(scrubSignInCode)).not.toThrow();
    expect(JSON.stringify(events)).not.toContain(CODE);
  });

  it('replaces the code in the query, in the fragment, and in both at once', () => {
    expect(scrubSignInCode(OPENED_WITH_QUERY)).toBe(`${ORIGIN}/app/callback?signin=abc&oauth_confirm=[Filtered]`);
    expect(scrubSignInCode(OPENED_WITH_FRAGMENT)).toBe(`${ORIGIN}/app/callback?signin=abc#oauth_confirm=[Filtered]`);
    expect(scrubSignInCode(OPENED_WITH_BOTH)).toBe(
      `${ORIGIN}/app/callback?signin=abc&oauth_confirm=[Filtered]#oauth_confirm=[Filtered]&_=_`,
    );
  });

  it('leaves text without a code untouched', () => {
    const event = { request: { url: `${ORIGIN}/app/callback?code=keycast-code&state=s` } };
    expect(scrubSignInCode(event)).toEqual({ request: { url: `${ORIGIN}/app/callback?code=keycast-code&state=s` } });
  });

  it('reaches nested objects and arrays, and copes with a loop', () => {
    const looped: Record<string, unknown> = { list: [{ deep: [OPENED_WITH_BOTH] }] };
    looped.self = looped;
    scrubSignInCode(looped);
    expect(JSON.stringify((looped.list as unknown[])[0])).not.toContain(CODE);
  });

  it('skips getter-only properties instead of throwing', () => {
    // Sentry's promise buffer has a getter-only `$` that returns a new array on each read.
    const buffer = { get $() { return [OPENED_WITH_QUERY]; }, note: OPENED_WITH_QUERY };
    expect(() => scrubSignInCode(buffer)).not.toThrow();
    expect(buffer.note).not.toContain(CODE);
  });

  it('does not walk into class instances such as the scopes Sentry attaches to events', () => {
    class Scope { constructor(public label: string) {} }
    const scope = new Scope(OPENED_WITH_QUERY);
    scrubSignInCode({ sdkProcessingMetadata: { capturedSpanScope: scope } });
    expect(scope.label).toBe(OPENED_WITH_QUERY);
  });
});

describe('Sentry setup keeps the sign-in code out of what it sends', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('scrubs the browser.* spans of a page-load transaction', () => {
    const { beforeSendTransaction } = startSentry();
    class Client { _promiseBuffer = { get $() { return []; } }; }
    const transaction = {
      type: 'transaction',
      sdkProcessingMetadata: { capturedSpanScope: { _client: new Client() } },
      transaction: '/app/callback',
      request: { url: `${ORIGIN}/app/callback?signin=abc` },
      contexts: { trace: { op: 'pageload', data: { 'sentry.op': 'pageload' } } },
      spans: [
        navigationSpan('browser.request', OPENED_WITH_QUERY),
        navigationSpan('browser.response', OPENED_WITH_FRAGMENT),
        navigationSpan('browser.domContentLoadedEvent', OPENED_WITH_BOTH),
      ],
    };

    const sent = beforeSendTransaction(transaction, {});

    expect(JSON.stringify(sent)).not.toContain(CODE);
    expect((sent as typeof transaction).spans[0].description).toBe(
      `${ORIGIN}/app/callback?signin=abc&oauth_confirm=[Filtered]`,
    );
  });

  it('scrubs error events, including their address and breadcrumbs', () => {
    const { beforeSend } = startSentry();
    const error = {
      exception: { values: [{ type: 'Error', value: 'boom' }] },
      request: { url: OPENED_WITH_BOTH, headers: { Referer: OPENED_WITH_QUERY } },
      breadcrumbs: [{ category: 'navigation', data: { from: OPENED_WITH_FRAGMENT, to: '/app/callback?signin=abc' } }],
    };

    expect(JSON.stringify(beforeSend(error, {}))).not.toContain(CODE);
  });

  it('does not mutate the objects supplied as console arguments', () => {
    const { beforeBreadcrumb } = startSentry();
    const liveState = { url: OPENED_WITH_QUERY };
    const breadcrumb = { category: 'console', data: { arguments: [liveState] } };
    beforeBreadcrumb(breadcrumb);
    expect(liveState.url).toBe(OPENED_WITH_QUERY);
  });

  it('scrubs navigation breadcrumbs as they are recorded', () => {
    const { beforeBreadcrumb } = startSentry();
    const breadcrumb = { category: 'navigation', data: { from: '/app/callback?signin=abc', to: OPENED_WITH_BOTH } };

    expect(JSON.stringify(beforeBreadcrumb(breadcrumb))).not.toContain(CODE);
  });

  it('scrubs the navigation entry Replay records', () => {
    startSentry();
    const recordingEvent = {
      type: 5,
      timestamp: 1,
      data: {
        tag: 'performanceSpan',
        payload: {
          op: 'navigation.navigate',
          description: OPENED_WITH_BOTH,
          startTimestamp: 1,
          endTimestamp: 2,
          data: { size: 1, duration: 1 },
        },
      },
    };

    const kept = sentryMock.replayOptions?.beforeAddRecordingEvent(recordingEvent);

    expect(kept).not.toBeNull();
    expect(JSON.stringify(kept)).not.toContain(CODE);
  });
});
