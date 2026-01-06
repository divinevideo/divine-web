// ABOUTME: JWT-based Nostr signer that signs events via Keycast REST RPC API
// ABOUTME: Implements NostrSigner interface using the /api/nostr unified endpoint
// ABOUTME: Supports lazy token refresh - automatically refreshes expired tokens on use

import type { NostrEvent, NostrSigner } from '@nostrify/nostrify';
import { KEYCAST_API_URL, refreshAccessToken } from './keycast';
import { getJWTExpiration } from './jwtDecode';

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
// Keys for localStorage
const REFRESH_TOKEN_KEY = 'keycast_refresh_token';
const JWT_TOKEN_KEY = 'keycast_jwt_token';
const EXPIRATION_KEY = 'keycast_jwt_expiration';

// Refresh when less than 5 minutes remaining
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

export class KeycastJWTSigner implements NostrSigner {
  private token: string;
  private apiUrl: string;
  private timeout: number;
  private cachedPubkey: string | null = null;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<void> | null = null;

  constructor(options: KeycastJWTSignerOptions) {
    this.token = options.token;
    this.apiUrl = options.apiUrl || KEYCAST_API_URL;
    this.timeout = options.timeout || 10000;
  }

  /**
   * Check if the token is expired or expiring soon
   */
  private isTokenExpiredOrExpiring(): boolean {
    const expiration = getJWTExpiration(this.token);
    if (!expiration) {
      // Can't determine expiration, assume valid
      return false;
    }
    const now = Date.now();
    const timeUntilExpiry = expiration - now;
    return timeUntilExpiry < REFRESH_THRESHOLD_MS;
  }

  /**
   * Attempt to refresh the token using stored refresh token
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.isTokenExpiredOrExpiring()) {
      return;
    }

    // Avoid concurrent refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshTokenRaw = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshTokenRaw) {
      console.warn('[KeycastJWTSigner] Token expired but no refresh token available');
      return;
    }
    // Parse JSON-stringified value from useLocalStorage
    const refreshToken = JSON.parse(refreshTokenRaw) as string;

    this.isRefreshing = true;
    this.refreshPromise = this.doRefresh(refreshToken);

    try {
      await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async doRefresh(refreshToken: string): Promise<void> {
    try {
      console.log('[KeycastJWTSigner] Token expired/expiring, refreshing...');
      const result = await refreshAccessToken(refreshToken);

      // Update internal token
      this.token = result.token;
      this.cachedPubkey = null; // Clear cache in case pubkey changes

      // Update localStorage
      localStorage.setItem(JWT_TOKEN_KEY, JSON.stringify(result.token));
      const newExpiration = getJWTExpiration(result.token);
      if (newExpiration) {
        localStorage.setItem(EXPIRATION_KEY, JSON.stringify(newExpiration));
      }
      if (result.refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, JSON.stringify(result.refreshToken));
      }

      console.log('[KeycastJWTSigner] Token refreshed successfully');
    } catch (error) {
      console.error('[KeycastJWTSigner] Failed to refresh token:', error);
      // Don't throw - let the original request proceed and fail naturally
      // This allows the user to see the auth error and re-login
    }
  }

  /**
   * Make an RPC call to the Keycast /api/nostr endpoint
   */
  private async rpc(method: string, params: unknown[] = []): Promise<unknown> {
    // Lazy refresh: ensure token is valid before making request
    await this.ensureValidToken();

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
      console.log('[KeycastJWTSigner] Using cached pubkey:', this.cachedPubkey);
      return this.cachedPubkey;
    }

    console.log('[KeycastJWTSigner] Fetching pubkey from API...');
    const pubkey = await this.rpc('get_public_key') as string;

    if (!pubkey || typeof pubkey !== 'string') {
      throw new Error('Invalid response: missing pubkey');
    }

    console.log('[KeycastJWTSigner] Got pubkey from API:', pubkey);
    this.cachedPubkey = pubkey;
    return pubkey;
  }

  /**
   * Sign an event via Keycast RPC API
   */
  async signEvent(
    event: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>
  ): Promise<NostrEvent> {
    // Get pubkey first - the API requires it in the event
    const pubkey = await this.getPublicKey();

    // Create event with pubkey included
    const eventWithPubkey = {
      ...event,
      pubkey,
    };

    const result = await this.rpc('sign_event', [eventWithPubkey]) as NostrEvent;

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
