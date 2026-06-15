import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { getEventLookupRelayUrls } from '@/config/relays';
import { fetchAddressableEvent, fetchEventById } from './eventLookup';

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'e'.repeat(64),
    pubkey: 'f'.repeat(64),
    created_at: 1_700_000_000,
    kind: 1,
    tags: [],
    content: '',
    sig: '0'.repeat(128),
    ...overrides,
  };
}

describe('eventLookup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns the funnelcake api result before querying relays', async () => {
    const event = makeEvent();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => event,
    }));

    const nostr = {
      query: vi.fn(),
    };

    const result = await fetchEventById(nostr, event.id, AbortSignal.timeout(1000));

    expect(result).toEqual(event);
    expect(nostr.query).not.toHaveBeenCalled();
  });

  it('falls back to configured and popular relays when the api misses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const event = makeEvent({ id: 'a'.repeat(64) });
    const nostr = {
      query: vi.fn().mockResolvedValue([event]),
    };
    const signal = AbortSignal.timeout(1000);
    const relayHints = ['wss://hint.example'];
    const relayUrls = ['wss://custom.example'];

    const result = await fetchEventById(nostr, event.id, signal, {
      relayHints,
      relayUrls,
    });

    expect(nostr.query).toHaveBeenCalledWith(
      [{ ids: [event.id], limit: 1 }],
      {
        signal,
        relays: getEventLookupRelayUrls({
          configuredRelayUrls: relayUrls,
          relayHints,
        }),
      },
    );
    expect(result).toEqual(event);
  });

  it('queries addressable events across the same relay set and returns the newest match', async () => {
    const older = makeEvent({
      id: '1'.repeat(64),
      kind: 30001,
      created_at: 1_700_000_000,
    });
    const newer = makeEvent({
      id: '2'.repeat(64),
      kind: 30001,
      created_at: 1_700_000_100,
    });
    const nostr = {
      query: vi.fn().mockResolvedValue([older, newer]),
    };
    const signal = AbortSignal.timeout(1000);

    const result = await fetchAddressableEvent(nostr, {
      kind: 30001,
      pubkey: 'b'.repeat(64),
      identifier: 'reading-list',
    }, signal, {
      relayUrls: ['wss://relay.divine.video'],
    });

    expect(nostr.query).toHaveBeenCalledWith(
      [{
        kinds: [30001],
        authors: ['b'.repeat(64)],
        '#d': ['reading-list'],
        limit: 5,
      }],
      {
        signal,
        relays: getEventLookupRelayUrls({
          configuredRelayUrls: ['wss://relay.divine.video'],
        }),
      },
    );
    expect(result).toEqual(newer);
  });
});
