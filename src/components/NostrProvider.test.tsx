import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as relayHealth from '@/lib/relayHealth';
import NostrProvider from './NostrProvider';

const mocks = vi.hoisted(() => {
  const resetQueries = vi.fn();
  const relayInstances = new Map<string, { close: ReturnType<typeof vi.fn> }>();
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

  return { appContext, relayInstances, resetQueries };
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
      yield ['EOSE'];
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
});
