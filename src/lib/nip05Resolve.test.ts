import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseNip05, resolveNip05ToPubkey } from './nip05Resolve';

describe('parseNip05', () => {
  it('splits name and domain', () => {
    expect(parseNip05('alice@example.com')).toEqual({ name: 'alice', domain: 'example.com' });
  });

  it('defaults empty local part to _', () => {
    expect(parseNip05('@example.com')).toEqual({ name: '_', domain: 'example.com' });
  });

  it('returns null for malformed input', () => {
    expect(parseNip05('no-at-sign')).toBeNull();
    expect(parseNip05('a@')).toBeNull();
    expect(parseNip05('a@bad domain')).toBeNull();
  });
});

describe('resolveNip05ToPubkey', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the hex pubkey from the well-known response', async () => {
    const pubkey = 'a'.repeat(64);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ names: { traveltelly: pubkey } }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await resolveNip05ToPubkey('traveltelly@primal.net');

    expect(result).toBe(pubkey);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://primal.net/.well-known/nostr.json?name=traveltelly',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('returns null when HTTP response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    expect(await resolveNip05ToPubkey('alice@example.com')).toBeNull();
  });

  it('returns null when the name is not present', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ names: { bob: 'b'.repeat(64) } }),
    }) as unknown as typeof fetch;
    expect(await resolveNip05ToPubkey('alice@example.com')).toBeNull();
  });

  it('returns null when the pubkey is not valid hex', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ names: { alice: 'not-hex' } }),
    }) as unknown as typeof fetch;
    expect(await resolveNip05ToPubkey('alice@example.com')).toBeNull();
  });
});
