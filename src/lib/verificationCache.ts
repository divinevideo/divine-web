// ABOUTME: localStorage cache for NIP-39 identity verification results
// ABOUTME: Verified results cached 24hr, failed results cached 15min

import { canonicalPlatform } from '@/lib/identityPlatform';

const VERIFIED_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FAILED_TTL_MS = 15 * 60 * 1000; // 15 minutes
const KEY_PREFIX = 'divine_verify_';

interface VerificationCacheEntry {
  verified: boolean;
  error?: string;
  code?: string;
  timestamp: number;
}

/**
 * Get a cached verification result.
 * Returns null on cache miss or expiry.
 */
export function getCachedVerification(
  platform: string,
  identity: string,
  proof: string,
  pubkey: string,
): { verified: boolean; error?: string; code?: string } | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = cacheKey(platform, identity, proof, pubkey);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as VerificationCacheEntry;
    const ttl = entry.verified ? VERIFIED_TTL_MS : FAILED_TTL_MS;
    const age = Date.now() - entry.timestamp;

    if (age > ttl) {
      localStorage.removeItem(key);
      return null;
    }

    return {
      verified: entry.verified,
      error: entry.error,
      ...(typeof entry.code === 'string' ? { code: entry.code } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Cache a verification result.
 */
export function setCachedVerification(
  platform: string,
  identity: string,
  proof: string,
  pubkey: string,
  result: { verified: boolean; error?: string; code?: string },
): void {
  if (typeof window === 'undefined') return;

  try {
    const key = cacheKey(platform, identity, proof, pubkey);
    const entry: VerificationCacheEntry = {
      verified: result.verified,
      error: result.error,
      code: result.code,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage might be full, ignore
  }
}

/**
 * Clear cached verification entries for one account under a Nostr pubkey.
 */
export function clearAccountVerificationCache(
  platform: string,
  identity: string,
  pubkey: string,
): void {
  if (typeof window === 'undefined') return;

  const targetPlatform = canonicalPlatform(platform);
  const targetIdentity = normalizeAccountIdentity(targetPlatform, identity);

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      if (matchesAccountKey(key, targetPlatform, targetIdentity, pubkey)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage unavailable, ignore
  }
}

function normalizeAccountIdentity(platform: string, identity: string): string {
  const trimmed = identity.trim().toLowerCase();
  if (platform === 'twitter' || platform === 'tiktok' || platform === 'bluesky') {
    return trimmed.replace(/^@/, '');
  }
  if (
    platform === 'youtube'
    && !trimmed.startsWith('channel/')
    && !trimmed.startsWith('c/')
    && !trimmed.startsWith('user/')
  ) {
    return trimmed.replace(/^@/, '');
  }
  return trimmed;
}

function matchesAccountKey(
  key: string,
  targetPlatform: string,
  targetIdentity: string,
  targetPubkey: string,
): boolean {
  try {
    const parsed: unknown = JSON.parse(key.slice(KEY_PREFIX.length));
    if (!Array.isArray(parsed) || parsed.length < 4) return false;
    const [entryPlatform, entryIdentity, , entryPubkey] = parsed;
    return (
      typeof entryPlatform === 'string'
      && typeof entryIdentity === 'string'
      && entryPubkey === targetPubkey
      && canonicalPlatform(entryPlatform) === targetPlatform
      && normalizeAccountIdentity(targetPlatform, entryIdentity) === targetIdentity
    );
  } catch {
    return false;
  }
}

/**
 * Clear all verification cache entries.
 */
export function clearVerificationCache(): void {
  if (typeof window === 'undefined') return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

function cacheKey(platform: string, identity: string, proof: string, pubkey: string): string {
  return `${KEY_PREFIX}${JSON.stringify([platform, identity, proof, pubkey])}`;
}
