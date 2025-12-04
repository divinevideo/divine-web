// ABOUTME: Tests for Rewind REST Gateway client
// ABOUTME: Verifies gateway detection and query encoding

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldUseGateway, encodeFilter, queryGateway } from './gatewayClient';

describe('shouldUseGateway', () => {
  it('returns true for relay.divine.video', () => {
    expect(shouldUseGateway('wss://relay.divine.video')).toBe(true);
    expect(shouldUseGateway('wss://relay.divine.video/')).toBe(true);
  });

  it('returns false for other relays', () => {
    expect(shouldUseGateway('wss://relay.damus.io')).toBe(false);
    expect(shouldUseGateway('wss://relay.nostr.band')).toBe(false);
  });
});

describe('encodeFilter', () => {
  it('encodes filter to base64url format', () => {
    const filter = { kinds: [1], limit: 10 };
    const encoded = encodeFilter(filter);

    // Should be base64url (no +, /, or = characters)
    expect(encoded).not.toMatch(/[+/=]/);

    // Should decode back to original
    const decoded = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    expect(decoded).toEqual(filter);
  });
});

describe('queryGateway', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('makes request to gateway with encoded filter', async () => {
    const mockEvents = [{ id: 'test', kind: 1, pubkey: 'abc', created_at: 123, tags: [], content: '', sig: '' }];

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: mockEvents, cached: true, cache_age_seconds: 10 })
    });

    const filter = { kinds: [1], limit: 5 };
    const result = await queryGateway(filter);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://gateway.divine.video/query?filter='),
      expect.any(Object)
    );
    expect(result).toEqual(mockEvents);
  });

  it('throws on gateway error response', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    await expect(queryGateway({ kinds: [1] })).rejects.toThrow('Gateway error: 500');
  });

  it('returns empty array when gateway returns no events', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [], cached: false })
    });

    const result = await queryGateway({ kinds: [1] });
    expect(result).toEqual([]);
  });
});
