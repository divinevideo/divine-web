// ABOUTME: JWT-based Nostr signer backed by the hosted Divine login RPC API
// ABOUTME: Implements the NostrSigner interface on top of the Divine login RPC API

import { DivineRpc } from '@divinevideo/login';
import type { NostrEvent, NostrSigner } from '@nostrify/nostrify';

import { DIVINE_LOGIN_ORIGIN } from './divineLoginOrigin';

type DivineRpcUnsignedEvent = Parameters<DivineRpc['signEvent']>[0];

export interface DivineJWTSignerOptions {
  /** JWT token for authentication */
  token: string;
  /** Optional custom login server URL */
  serverUrl?: string;
  /** Optional timeout for requests in milliseconds (default: 10000) */
  timeout?: number;
}

export class DivineJWTSigner implements NostrSigner {
  private static readonly sharedPubkeys = new Map<string, string>();
  private static readonly inflightPubkeys = new Map<string, Promise<string>>();
  private token: string;
  private readonly serverUrl: string;
  private readonly timeout: number;
  private cachedPubkey: string | null = null;

  constructor(options: DivineJWTSignerOptions) {
    this.token = options.token;
    this.serverUrl = options.serverUrl || DIVINE_LOGIN_ORIGIN;
    this.timeout = options.timeout || 10000;
  }

  private get rpc(): DivineRpc {
    return new DivineRpc({
      nostrApi: `${this.serverUrl}/api/nostr`,
      accessToken: this.token,
      fetch: this.fetchWithTimeout,
    });
  }

  private readonly fetchWithTimeout: typeof fetch = async (input, init) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  private async run<T>(operation: (rpc: DivineRpc) => Promise<T>, timeoutMessage: string): Promise<T> {
    try {
      return await operation(this.rpc);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(timeoutMessage);
      }

      throw error;
    }
  }

  private get pubkeyCacheKey(): string {
    return `${this.serverUrl}::${this.token}`;
  }

  async getPublicKey(): Promise<string> {
    if (this.cachedPubkey) {
      return this.cachedPubkey;
    }

    const sharedPubkey = DivineJWTSigner.sharedPubkeys.get(this.pubkeyCacheKey);
    if (sharedPubkey) {
      this.cachedPubkey = sharedPubkey;
      return sharedPubkey;
    }

    const inflightPubkey = DivineJWTSigner.inflightPubkeys.get(this.pubkeyCacheKey);
    if (inflightPubkey) {
      const pubkey = await inflightPubkey;
      this.cachedPubkey = pubkey;
      return pubkey;
    }

    console.log('[DivineJWTSigner] Fetching public key...');

    const pubkeyPromise = this.run<string>(
      (rpc) => rpc.getPublicKey(),
      'Request timeout: Failed to get public key',
    );
    DivineJWTSigner.inflightPubkeys.set(this.pubkeyCacheKey, pubkeyPromise);

    const pubkey = await pubkeyPromise.finally(() => {
      DivineJWTSigner.inflightPubkeys.delete(this.pubkeyCacheKey);
    });

    if (!pubkey || typeof pubkey !== 'string') {
      throw new Error('Invalid response: missing pubkey');
    }

    this.cachedPubkey = pubkey;
    DivineJWTSigner.sharedPubkeys.set(this.pubkeyCacheKey, pubkey);
    console.log('[DivineJWTSigner] ✅ Got public key:', pubkey);
    return pubkey;
  }

  async signEvent(
    event: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>
  ): Promise<NostrEvent> {
    console.log('[DivineJWTSigner] Signing event kind', event.kind, '...');

    const pubkey = await this.getPublicKey();
    const unsignedEvent = {
      ...event,
      pubkey,
    } as DivineRpcUnsignedEvent;

    const signedEvent = await this.run<NostrEvent>(
      (rpc) => rpc.signEvent(unsignedEvent),
      'Request timeout: Failed to sign event',
    );

    if (!signedEvent?.id || !signedEvent.sig) {
      throw new Error('Invalid response: missing signed event');
    }

    console.log('[DivineJWTSigner] ✅ Event signed:', signedEvent.id);
    return signedEvent;
  }

  async getRelays(): Promise<Record<string, { read: boolean; write: boolean }>> {
    console.log('[DivineJWTSigner] getRelays() called, returning empty object');
    return {};
  }

  readonly nip04 = {
    encrypt: async (pubkey: string, plaintext: string): Promise<string> => {
      console.log('[DivineJWTSigner] nip04.encrypt() called...');

      return this.run<string>(
        (rpc) => rpc.nip04Encrypt(pubkey, plaintext),
        'Request timeout: NIP-04 encryption failed',
      );
    },

    decrypt: async (pubkey: string, ciphertext: string): Promise<string> => {
      console.log('[DivineJWTSigner] nip04.decrypt() called...');

      return this.run<string>(
        (rpc) => rpc.nip04Decrypt(pubkey, ciphertext),
        'Request timeout: NIP-04 decryption failed',
      );
    },
  };

  readonly nip44 = {
    encrypt: async (pubkey: string, plaintext: string): Promise<string> => {
      console.log('[DivineJWTSigner] nip44.encrypt() called...');

      return this.run<string>(
        (rpc) => rpc.nip44Encrypt(pubkey, plaintext),
        'Request timeout: NIP-44 encryption failed',
      );
    },

    decrypt: async (pubkey: string, ciphertext: string): Promise<string> => {
      console.log('[DivineJWTSigner] nip44.decrypt() called...');

      return this.run<string>(
        (rpc) => rpc.nip44Decrypt(pubkey, ciphertext),
        'Request timeout: NIP-44 decryption failed',
      );
    },
  };

  updateToken(newToken: string): void {
    this.token = newToken;
    this.cachedPubkey = null;
    console.log('[DivineJWTSigner] Token updated');
  }
}
