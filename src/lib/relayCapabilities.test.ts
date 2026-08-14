import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCapabilitiesCache,
  detectRelayCapabilities,
  getOptimisticRelayCapabilities,
} from './relayCapabilities';
import * as relayHealth from './relayHealth';

describe('getOptimisticRelayCapabilities (after #415 ditto.pub removal)', () => {
  it('returns the default (unrecognized-host) shape for relay.ditto.pub', () => {
    const caps = getOptimisticRelayCapabilities('wss://relay.ditto.pub');
    expect(caps.url).toBe('wss://relay.ditto.pub');
    expect(caps.supportsNIP50).toBe(false);
    expect(caps.supportsVideoSorts).toBe(false);
    expect(caps.supportsSearch).toBe(false);
    expect(caps.supportsCategoryFeed).toBe(false);
    expect(caps.supportedSortModes).toEqual([]);
    expect(caps.source).toBe('optimistic');
  });
});

describe('NIP-11 metadata URL', () => {
  beforeEach(() => {
    clearCapabilitiesCache();
    relayHealth.reset();
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor() {
          throw new Error('probe not under test');
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The websocket->http mapping is a scheme concern, not an admission concern.
  // Gating it on the relay admission policy left `ws://` on a public host
  // unmapped, so `fetch` rejected the URL and NIP-11 silently never resolved.
  it.each([
    ['wss://relay.nostr.wine', 'https://relay.nostr.wine/'],
    ['ws://localhost:7777', 'http://localhost:7777/'],
    ['ws://relay.example', 'http://relay.example/'],
  ])('fetches %s metadata over http(s)', async (relayUrl, expectedUrl) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ supported_nips: [50] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await detectRelayCapabilities(relayUrl);

    expect(fetchMock).toHaveBeenCalledWith(expectedUrl, expect.anything());
  });
});

describe('detectRelayCapabilities failure path', () => {
  // Optimistic caps: NIP-50 yes, video sorts no — so a live probe is attempted.
  const URL = 'wss://relay.nostr.wine';

  beforeEach(() => {
    clearCapabilitiesCache();
    relayHealth.reset();
    // NIP-11 fetch fails and the WebSocket probe throws, forcing the catch path.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor() {
          throw new Error('probe failed');
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not record probe results or grant the funnelcake bonus on failure', async () => {
    const caps = await detectRelayCapabilities(URL);
    expect(caps.source).toBe('fallback');
    expect(caps.error).toBeDefined();

    // A failed probe is not live evidence: it must not create relay-health
    // state, mislabel the source as 'live', or grant capability bonuses.
    expect(relayHealth.snapshot().find((s) => s.url === URL)).toBeUndefined();
    expect(relayHealth.score(URL, 34236)).toBe(relayHealth.score(URL));
  });
});
