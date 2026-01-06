// ABOUTME: Tests for JWT-based Keycast signer
// ABOUTME: Verifies HTTP RPC signing, encryption, and error handling via /api/nostr endpoint

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeycastJWTSigner } from './KeycastJWTSigner';
import { KEYCAST_API_URL } from './keycast';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('KeycastJWTSigner', () => {
  const mockToken = 'mock-jwt-token';
  const mockPubkey = 'a'.repeat(64); // 64-char hex pubkey
  const mockApiUrl = 'https://test.example.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create signer with token', () => {
      const signer = new KeycastJWTSigner({ token: mockToken });
      expect(signer).toBeDefined();
    });

    it('should use custom API URL if provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: mockPubkey }),
      });

      const signer = new KeycastJWTSigner({
        token: mockToken,
        apiUrl: mockApiUrl,
      });

      await signer.getPublicKey();

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/nostr`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ method: 'get_public_key', params: [] }),
        })
      );
    });

    it('should use custom timeout if provided', () => {
      const signer = new KeycastJWTSigner({
        token: mockToken,
        timeout: 5000,
      });
      expect(signer).toBeDefined();
    });
  });

  describe('getPublicKey', () => {
    it('should fetch and return public key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: mockPubkey }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });
      const pubkey = await signer.getPublicKey();

      expect(pubkey).toBe(mockPubkey);
      expect(mockFetch).toHaveBeenCalledWith(
        `${KEYCAST_API_URL}/api/nostr`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ method: 'get_public_key', params: [] }),
        })
      );
    });

    it('should cache public key after first call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: mockPubkey }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });

      // First call
      const pubkey1 = await signer.getPublicKey();
      expect(pubkey1).toBe(mockPubkey);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const pubkey2 = await signer.getPublicKey();
      expect(pubkey2).toBe(mockPubkey);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should throw error on 401 Unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid token' }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });

      await expect(signer.getPublicKey()).rejects.toThrow('Invalid token');
    });

    it('should throw error on RPC error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'User not found' }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });

      await expect(signer.getPublicKey()).rejects.toThrow('User not found');
    });

    it('should throw error on missing pubkey in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: null }), // No pubkey
      });

      const signer = new KeycastJWTSigner({ token: mockToken });

      await expect(signer.getPublicKey()).rejects.toThrow(
        'Invalid response: missing pubkey'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const signer = new KeycastJWTSigner({ token: mockToken });

      await expect(signer.getPublicKey()).rejects.toThrow('Network error');
    });
  });

  describe('signEvent', () => {
    const mockEvent = {
      kind: 1,
      content: 'Hello World',
      tags: [],
      created_at: 1234567890,
    };

    const mockSignedEvent = {
      ...mockEvent,
      id: 'event-id-123',
      pubkey: mockPubkey,
      sig: 'signature-123',
    };

    it('should sign event successfully', async () => {
      // First call: getPublicKey
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: mockPubkey }),
      });
      // Second call: sign_event
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: mockSignedEvent }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });
      const signed = await signer.signEvent(mockEvent);

      expect(signed).toEqual(mockSignedEvent);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        `${KEYCAST_API_URL}/api/nostr`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ method: 'sign_event', params: [{ ...mockEvent, pubkey: mockPubkey }] }),
        })
      );
    });

    it('should throw error on 401 Unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid token' }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });

      await expect(signer.signEvent(mockEvent)).rejects.toThrow('Invalid token');
    });

    it('should throw error on missing signed event in response', async () => {
      // First call: getPublicKey succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: mockPubkey }),
      });
      // Second call: sign_event returns invalid response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: {} }), // No id/sig fields
      });

      const signer = new KeycastJWTSigner({ token: mockToken });

      await expect(signer.signEvent(mockEvent)).rejects.toThrow(
        'Invalid response: missing signed event'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const signer = new KeycastJWTSigner({ token: mockToken });

      await expect(signer.signEvent(mockEvent)).rejects.toThrow('Network error');
    });
  });

  describe('getRelays', () => {
    it('should return empty object', async () => {
      const signer = new KeycastJWTSigner({ token: mockToken });
      const relays = await signer.getRelays();

      expect(relays).toEqual({});
    });
  });

  describe('nip04 encryption', () => {
    const targetPubkey = 'b'.repeat(64);
    const plaintext = 'secret message';
    const ciphertext = 'encrypted-message';

    it('should encrypt with NIP-04', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: ciphertext }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });
      const result = await signer.nip04.encrypt(targetPubkey, plaintext);

      expect(result).toBe(ciphertext);
      expect(mockFetch).toHaveBeenCalledWith(
        `${KEYCAST_API_URL}/api/nostr`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ method: 'nip04_encrypt', params: [targetPubkey, plaintext] }),
        })
      );
    });

    it('should decrypt with NIP-04', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: plaintext }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });
      const result = await signer.nip04.decrypt(targetPubkey, ciphertext);

      expect(result).toBe(plaintext);
      expect(mockFetch).toHaveBeenCalledWith(
        `${KEYCAST_API_URL}/api/nostr`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ method: 'nip04_decrypt', params: [targetPubkey, ciphertext] }),
        })
      );
    });

    it('should handle encryption errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Encryption failed' }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });

      await expect(signer.nip04.encrypt(targetPubkey, plaintext)).rejects.toThrow(
        'Encryption failed'
      );
    });

    it('should handle decryption errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Decryption failed' }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });

      await expect(signer.nip04.decrypt(targetPubkey, ciphertext)).rejects.toThrow(
        'Decryption failed'
      );
    });
  });

  describe('nip44 encryption', () => {
    const targetPubkey = 'b'.repeat(64);
    const plaintext = 'secret message';
    const ciphertext = 'encrypted-message';

    it('should encrypt with NIP-44', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: ciphertext }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });
      const result = await signer.nip44.encrypt(targetPubkey, plaintext);

      expect(result).toBe(ciphertext);
      expect(mockFetch).toHaveBeenCalledWith(
        `${KEYCAST_API_URL}/api/nostr`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ method: 'nip44_encrypt', params: [targetPubkey, plaintext] }),
        })
      );
    });

    it('should decrypt with NIP-44', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: plaintext }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });
      const result = await signer.nip44.decrypt(targetPubkey, ciphertext);

      expect(result).toBe(plaintext);
      expect(mockFetch).toHaveBeenCalledWith(
        `${KEYCAST_API_URL}/api/nostr`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ method: 'nip44_decrypt', params: [targetPubkey, ciphertext] }),
        })
      );
    });

    it('should handle encryption errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Encryption failed' }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });

      await expect(signer.nip44.encrypt(targetPubkey, plaintext)).rejects.toThrow(
        'Encryption failed'
      );
    });

    it('should handle decryption errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Decryption failed' }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });

      await expect(signer.nip44.decrypt(targetPubkey, ciphertext)).rejects.toThrow(
        'Decryption failed'
      );
    });
  });

  describe('updateToken', () => {
    it('should update token and clear cached pubkey', async () => {
      // First call with original token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: mockPubkey }),
      });

      const signer = new KeycastJWTSigner({ token: mockToken });
      await signer.getPublicKey();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Update token
      const newToken = 'new-jwt-token';
      signer.updateToken(newToken);

      // Next call should fetch again with new token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: mockPubkey }),
      });

      await signer.getPublicKey();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        `${KEYCAST_API_URL}/api/nostr`,
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${newToken}`,
          },
        })
      );
    });
  });
});
