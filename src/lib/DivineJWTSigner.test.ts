import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DivineJWTSigner } from './DivineJWTSigner';

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('DivineJWTSigner', () => {
  const mockToken = 'mock-jwt-token';
  const mockPubkey = 'a'.repeat(64);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the hosted divine signer RPC endpoint by default', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ result: mockPubkey }),
    });

    const signer = new DivineJWTSigner({ token: mockToken });
    const pubkey = await signer.getPublicKey();

    expect(pubkey).toBe(mockPubkey);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://login.divine.video/api/nostr',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
        },
        body: JSON.stringify({
          method: 'get_public_key',
          params: [],
        }),
      })
    );
  });

  it('caches the fetched public key', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ result: mockPubkey }),
    });

    const signer = new DivineJWTSigner({ token: mockToken });

    await expect(signer.getPublicKey()).resolves.toBe(mockPubkey);
    await expect(signer.getPublicKey()).resolves.toBe(mockPubkey);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('signs events via the nostr RPC contract', async () => {
    const unsignedEvent = {
      kind: 1,
      content: 'Hello World',
      tags: [],
      created_at: 1234567890,
    };
    const signedEvent = {
      ...unsignedEvent,
      id: 'event-id-123',
      pubkey: mockPubkey,
      sig: 'signature-123',
    };

    mockFetch.mockResolvedValueOnce({
      json: async () => ({ result: signedEvent }),
    });

    const signer = new DivineJWTSigner({ token: mockToken });

    await expect(signer.signEvent(unsignedEvent)).resolves.toEqual(signedEvent);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://login.divine.video/api/nostr',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
        },
        body: JSON.stringify({
          method: 'sign_event',
          params: [unsignedEvent],
        }),
      })
    );
  });

  it('routes nip04 and nip44 encryption through the same RPC endpoint', async () => {
    mockFetch
      .mockResolvedValueOnce({
        json: async () => ({ result: 'nip04-ciphertext' }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ result: 'nip44-ciphertext' }),
      });

    const signer = new DivineJWTSigner({ token: mockToken });

    await expect(signer.nip04.encrypt('b'.repeat(64), 'secret')).resolves.toBe('nip04-ciphertext');
    await expect(signer.nip44.encrypt('c'.repeat(64), 'secret')).resolves.toBe('nip44-ciphertext');

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://login.divine.video/api/nostr',
      expect.objectContaining({
        body: JSON.stringify({
          method: 'nip04_encrypt',
          params: ['b'.repeat(64), 'secret'],
        }),
      })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://login.divine.video/api/nostr',
      expect.objectContaining({
        body: JSON.stringify({
          method: 'nip44_encrypt',
          params: ['c'.repeat(64), 'secret'],
        }),
      })
    );
  });
});
