import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as relayHealth from '@/lib/relayHealth';
import NostrProvider from './NostrProvider';

const mocks = vi.hoisted(() => {
  const resetQueries = vi.fn();
  const relayInstances = new Map<string, { close: ReturnType<typeof vi.fn> }>();
  // Messages the mocked NRelay1.req generator yields, in order.
  const reqScript: unknown[][] = [['EOSE']];
  const appContext = {
    config: {
      theme: 'system',
      relayUrl: 'wss://relay.divine.video',
      relayUrls: ['wss://relay.divine.video', 'wss://relay.damus.io'],
      customRelayUrls: ['wss://custom.example'],
      disabledPresetUrls: [] as string[],
    },
    presetRelays: [
      { name: 'DVines', url: 'wss://relay.divine.video' },
      { name: 'Damus', url: 'wss://relay.damus.io' },
    ],
  };

  return { appContext, relayInstances, resetQueries, reqScript };
});

vi.mock('@nostrify/nostrify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nostrify/nostrify')>();

  class NRelay1 {
    close = vi.fn();
    socket = { readyState: 0, addEventListener: vi.fn() };

    constructor(public url: string) {
      mocks.relayInstances.set(url, this);
    }

    async *req() {
      for (const msg of mocks.reqScript) {
        yield msg;
      }
    }

    async event() {
      return undefined;
    }
  }

  class NPool {
    relays = new Map<string, NRelay1>();

    constructor(private opts: { open: (url: string) => NRelay1 }) {}

    relay(url: string) {
      let relay = this.relays.get(url);
      if (!relay) {
        relay = this.opts.open(url);
        this.relays.set(url, relay);
      }
      return relay;
    }
  }

  return { ...actual, NPool, NRelay1 };
});

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => mocks.appContext,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ resetQueries: mocks.resetQueries }),
}));

describe('NostrProvider', () => {
  beforeEach(() => {
    mocks.relayInstances.clear();
    mocks.resetQueries.mockClear();
    mocks.reqScript.length = 0;
    mocks.reqScript.push(['EOSE']);
    relayHealth.reset();
    mocks.appContext.config = {
      theme: 'system',
      relayUrl: 'wss://relay.divine.video',
      relayUrls: ['wss://relay.divine.video', 'wss://relay.damus.io'],
      customRelayUrls: ['wss://custom.example'],
      disabledPresetUrls: [],
    };
  });

  it('renders without error when relayHealth is wired up', () => {
    const { getByTestId } = render(
      <NostrProvider>
        <div data-testid="child" />
      </NostrProvider>,
    );
    expect(getByTestId('child')).toBeInTheDocument();
  });

  it('closes newly disabled preset relay sockets and resets cached queries', () => {
    const { rerender } = render(
      <NostrProvider>
        <div />
      </NostrProvider>,
    );
    const damusRelay = mocks.relayInstances.get('wss://relay.damus.io');
    expect(damusRelay).toBeDefined();

    mocks.appContext.config = {
      ...mocks.appContext.config,
      disabledPresetUrls: ['wss://relay.damus.io'],
    };
    rerender(
      <NostrProvider>
        <div />
      </NostrProvider>,
    );

    expect(damusRelay?.close).toHaveBeenCalledTimes(1);
    expect(mocks.resetQueries).toHaveBeenCalledTimes(1);
  });

  it('exposes pickTopN with the expected arity for the integration', () => {
    // The router passes (urls, n, kind?) to pickTopN. Verify the export
    // accepts this signature by calling it directly.
    const result = relayHealth.pickTopN(
      ['wss://relay.divine.video', 'wss://relay.damus.io'],
      2,
      34236,
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it('scores a first-message EOSE as a healthy empty result, not an error', async () => {
    render(
      <NostrProvider>
        <div />
      </NostrProvider>,
    );
    const relay = mocks.relayInstances.get('wss://relay.divine.video');
    expect(relay).toBeDefined();

    // The provider wraps relay.req with health instrumentation at open()
    // time. The mock yields a first-message EOSE: "I have no matching
    // events" — a healthy response. Empty result ≠ failure, so this must
    // bump successCount, never errorCount.
    const instrumented = relay as unknown as {
      req: (filters: unknown[]) => AsyncGenerator<unknown[]>;
    };
    for await (const _msg of instrumented.req([{ kinds: [0] }])) {
      // drain the generator
    }

    const snap = relayHealth.snapshot().find((s) => s.url === 'wss://relay.divine.video');
    expect(snap?.successCount).toBe(1);
    expect(snap?.errorCount ?? 0).toBe(0);
  });

  it('scores a first-message CLOSED as an error', async () => {
    mocks.reqScript.length = 0;
    mocks.reqScript.push(['CLOSED', 'sub-id', 'error: rejected']);
    render(
      <NostrProvider>
        <div />
      </NostrProvider>,
    );
    const relay = mocks.relayInstances.get('wss://relay.divine.video');
    const instrumented = relay as unknown as {
      req: (filters: unknown[]) => AsyncGenerator<unknown[]>;
    };
    for await (const _msg of instrumented.req([{ kinds: [0] }])) {
      // drain the generator
    }

    const snap = relayHealth.snapshot().find((s) => s.url === 'wss://relay.divine.video');
    expect(snap?.errorCount).toBe(1);
    expect(snap?.successCount ?? 0).toBe(0);
  });
});
