// ABOUTME: localStorage cache for NIP-39 identity verification results
// ABOUTME: Verified results cached 24hr, failed results cached 15min

const VERIFIED_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FAILED_TTL_MS = 15 * 60 * 1000; // 15 minutes
const KEY_PREFIX = 'divine_verify_';

interface VerificationCacheEntry {
  verified: boolean;
  error?: string;
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
): { verified: boolean; error?: string } | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = cacheKey(platform, identity, proof);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as VerificationCacheEntry;
    const ttl = entry.verified ? VERIFIED_TTL_MS : FAILED_TTL_MS;
    const age = Date.now() - entry.timestamp;

    if (age > ttl) {
      localStorage.removeItem(key);
      return null;
    }

    return { verified: entry.verified, error: entry.error };
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
  result: { verified: boolean; error?: string },
): void {
  if (typeof window === 'undefined') return;

  try {
    const key = cacheKey(platform, identity, proof);
    const entry: VerificationCacheEntry = {
      verified: result.verified,
      error: result.error,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage might be full, ignore
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

function cacheKey(platform: string, identity: string, proof: string): string {
  return `${KEY_PREFIX}${platform}:${identity}:${proof.slice(0, 8)}`;
}
