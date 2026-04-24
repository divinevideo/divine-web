// ABOUTME: Tests for the device-scoped ephemeral Nostr signer used for anonymous NIP-98 auth
// ABOUTME: Covers generation, persistence, expiry, and signEvent output shape.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearAnonymousSigner,
  getOrCreateAnonymousSigner,
  ANONYMOUS_SIGNER_SK_KEY,
  ANONYMOUS_SIGNER_EXPIRY_KEY,
  ANONYMOUS_SIGNER_TTL_MS,
} from './ephemeralSigner';

describe('ephemeralSigner', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, String(value)),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
        get length() { return storage.size; },
        key: (i: number) => Array.from(storage.keys())[i] ?? null,
      } satisfies Storage,
    });
  });

  it('generates a new secret key and persists it on first call', async () => {
    expect(localStorage.getItem(ANONYMOUS_SIGNER_SK_KEY)).toBeNull();

    const signer = getOrCreateAnonymousSigner();
    const pubkey = await signer.getPublicKey();

    expect(pubkey).toMatch(/^[0-9a-f]{64}$/);
    expect(localStorage.getItem(ANONYMOUS_SIGNER_SK_KEY)).toMatch(/^[0-9a-f]{64}$/);
    expect(localStorage.getItem(ANONYMOUS_SIGNER_EXPIRY_KEY)).not.toBeNull();
  });

  it('returns the same pubkey on subsequent calls (persistence across instances)', async () => {
    const first = getOrCreateAnonymousSigner();
    const firstPubkey = await first.getPublicKey();

    const second = getOrCreateAnonymousSigner();
    const secondPubkey = await second.getPublicKey();

    expect(secondPubkey).toBe(firstPubkey);
  });

  it('does NOT refresh expiry on subsequent calls — TTL is anchored at the first call', async () => {
    getOrCreateAnonymousSigner();
    const firstExpiry = Number(localStorage.getItem(ANONYMOUS_SIGNER_EXPIRY_KEY));

    // Force a later timestamp
    await new Promise((r) => setTimeout(r, 5));
    getOrCreateAnonymousSigner();
    const secondExpiry = Number(localStorage.getItem(ANONYMOUS_SIGNER_EXPIRY_KEY));

    // Matches the UI promise "Your choice will be remembered for 30 days" — from
    // confirm-time, not from last-view. Otherwise the key would never expire.
    expect(secondExpiry).toBe(firstExpiry);
  });

  it('generates a new key if the stored key is expired', async () => {
    const first = getOrCreateAnonymousSigner();
    const firstPubkey = await first.getPublicKey();

    // Force expiry
    localStorage.setItem(ANONYMOUS_SIGNER_EXPIRY_KEY, String(Date.now() - 1000));

    const second = getOrCreateAnonymousSigner();
    const secondPubkey = await second.getPublicKey();

    expect(secondPubkey).not.toBe(firstPubkey);
  });

  it('produces a NostrSigner with getPublicKey and signEvent', async () => {
    const signer = getOrCreateAnonymousSigner();
    expect(typeof signer.getPublicKey).toBe('function');
    expect(typeof signer.signEvent).toBe('function');
    const pubkey = await signer.getPublicKey();
    expect(pubkey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('clearAnonymousSigner removes the persisted key and expiry', async () => {
    getOrCreateAnonymousSigner();
    expect(localStorage.getItem(ANONYMOUS_SIGNER_SK_KEY)).not.toBeNull();

    clearAnonymousSigner();

    expect(localStorage.getItem(ANONYMOUS_SIGNER_SK_KEY)).toBeNull();
    expect(localStorage.getItem(ANONYMOUS_SIGNER_EXPIRY_KEY)).toBeNull();
  });

  it('TTL constant matches the 30-day age-verification window', () => {
    expect(ANONYMOUS_SIGNER_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
