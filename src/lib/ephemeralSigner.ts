// ABOUTME: Device-scoped ephemeral Nostr signer used for anonymous NIP-98 media auth
// ABOUTME: Generates a secp256k1 keypair on first use, persists it in localStorage for 30 days.

import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { NSecSigner } from '@nostrify/nostrify';
import type { NostrSigner } from '@nostrify/nostrify';

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export const ANONYMOUS_SIGNER_SK_KEY = 'divine-anon-signer-sk';
export const ANONYMOUS_SIGNER_EXPIRY_KEY = 'divine-anon-signer-expiry';
export const ANONYMOUS_SIGNER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function readPersistedSecretKey(): Uint8Array | null {
  if (typeof window === 'undefined') return null;

  const hex = localStorage.getItem(ANONYMOUS_SIGNER_SK_KEY);
  const expiryRaw = localStorage.getItem(ANONYMOUS_SIGNER_EXPIRY_KEY);
  if (!hex || !expiryRaw) return null;

  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry) || Date.now() >= expiry) return null;

  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;

  try {
    return hexToBytes(hex);
  } catch {
    return null;
  }
}

function persistSecretKey(sk: Uint8Array): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ANONYMOUS_SIGNER_SK_KEY, bytesToHex(sk));
  localStorage.setItem(
    ANONYMOUS_SIGNER_EXPIRY_KEY,
    String(Date.now() + ANONYMOUS_SIGNER_TTL_MS),
  );
  // Validate that the key yields a pubkey — dead-check against weird storage corruption
  getPublicKey(sk);
}

/**
 * Return a signer backed by a persistent per-device anonymous key.
 *
 * Creates and persists a new key on the first call (anchoring the 30-day expiry
 * at "the moment the viewer confirmed adult"). Subsequent calls reuse the
 * existing key *without* resetting the expiry — matching the UI copy
 * "Your choice will be remembered for 30 days" so the key lifetime is tied to
 * the confirm moment, not to "30 days from the last view".
 */
export function getOrCreateAnonymousSigner(): NostrSigner {
  const existing = readPersistedSecretKey();
  if (existing) {
    return new NSecSigner(existing);
  }
  const sk = generateSecretKey();
  persistSecretKey(sk);
  return new NSecSigner(sk);
}

/** Clear the persisted anonymous key (e.g. when the user revokes age verification). */
export function clearAnonymousSigner(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ANONYMOUS_SIGNER_SK_KEY);
  localStorage.removeItem(ANONYMOUS_SIGNER_EXPIRY_KEY);
}
