// ABOUTME: JWT-based Nostr signer that signs events via Keycast REST RPC API
// ABOUTME: Implements NostrSigner interface using the /api/nostr unified endpoint

import type { NostrEvent, NostrSigner } from '@nostrify/nostrify';
import { KEYCAST_API_URL } from './keycast';

export interface KeycastJWTSignerOptions {
  /** JWT token for authentication */
  token: string;
  /** Optional custom API URL (defaults to KEYCAST_API_URL) */
  apiUrl?: string;
  /** Optional timeout for requests in milliseconds (default: 10000) */
  timeout?: number;
}

interface RpcResponse {
  result?: unknown;
  error?: string;
}

/**
 * Nostr signer that uses JWT authentication to sign events via Keycast REST RPC API
 *
 * Uses the unified /api/nostr endpoint which mirrors NIP-46 methods over HTTP.
 *
 * @example
 * ```typescript
 * const signer = new KeycastJWTSigner({ token: 'your-jwt-token' });
 * const pubkey = await signer.getPublicKey();
 * const signed = await signer.signEvent({ kind: 1, content: 'Hello!', tags: [], created_at: 0 });
 * ```
 */
export class KeycastJWTSigner implements NostrSigner {
  private token: string;
  private apiUrl: string;
  private timeout: number;
  private cachedPubkey: string | null = null;

  constructor(options: KeycastJWTSignerOptions) {
    this.token = options.token;
    this.apiUrl = options.apiUrl || KEYCAST_API_URL;
    this.timeout = options.timeout || 10000;
  }

  /**
   * Make an RPC call to the Keycast /api/nostr endpoint
   */
  private async rpc(method: string, params: unknown[] = []): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.apiUrl}/api/nostr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ method, params }),
        signal: controller.signal,
      });

      const data: RpcResponse = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || `RPC ${method} failed: ${response.status}`);
      }

      return data.result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout: ${method} failed`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get the public key for the authenticated user
   * Caches the result after first call
   */
  async getPublicKey(): Promise<string> {
    if (this.cachedPubkey) {
      return this.cachedPubkey;
    }

    const pubkey = await this.rpc('get_public_key') as string;

    if (!pubkey || typeof pubkey !== 'string') {
      throw new Error('Invalid response: missing pubkey');
    }

    this.cachedPubkey = pubkey;
    return pubkey;
  }

  /**
   * Sign an event via Keycast RPC API
   */
  async signEvent(
    event: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>
  ): Promise<NostrEvent> {
    const result = await this.rpc('sign_event', [event]) as NostrEvent;

    if (!result || !result.id || !result.sig) {
      throw new Error('Invalid response: missing signed event');
    }

    return result;
  }

  /**
   * Get relay configuration (optional method)
   * Returns empty object as relays are not managed by JWT signer
   */
  async getRelays(): Promise<Record<string, { read: boolean; write: boolean }>> {
    return {};
  }

  /**
   * NIP-04 encryption/decryption
   */
  readonly nip04 = {
    encrypt: async (pubkey: string, plaintext: string): Promise<string> => {
      const result = await this.rpc('nip04_encrypt', [pubkey, plaintext]);
      if (typeof result !== 'string') {
        throw new Error('Invalid response: expected ciphertext string');
      }
      return result;
    },

    decrypt: async (pubkey: string, ciphertext: string): Promise<string> => {
      const result = await this.rpc('nip04_decrypt', [pubkey, ciphertext]);
      if (typeof result !== 'string') {
        throw new Error('Invalid response: expected plaintext string');
      }
      return result;
    },
  };

  /**
   * NIP-44 encryption/decryption
   */
  readonly nip44 = {
    encrypt: async (pubkey: string, plaintext: string): Promise<string> => {
      const result = await this.rpc('nip44_encrypt', [pubkey, plaintext]);
      if (typeof result !== 'string') {
        throw new Error('Invalid response: expected ciphertext string');
      }
      return result;
    },

    decrypt: async (pubkey: string, ciphertext: string): Promise<string> => {
      const result = await this.rpc('nip44_decrypt', [pubkey, ciphertext]);
      if (typeof result !== 'string') {
        throw new Error('Invalid response: expected plaintext string');
      }
      return result;
    },
  };

  /**
   * Update the JWT token (useful when token is refreshed)
   */
  updateToken(newToken: string): void {
    this.token = newToken;
    this.cachedPubkey = null;
  }
}
