// ABOUTME: localStorage cache for social data (followers/following)
// ABOUTME: Provides read/write with 5-minute TTL expiration

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Get cached followers list for a pubkey
 * Returns null if cache miss or expired
 */
export function getCachedFollowers(pubkey: string): string[] | null {
  return getCacheEntry<string[]>(`followers:${pubkey}`);
}

/**
 * Set cached followers list for a pubkey
 */
export function setCachedFollowers(pubkey: string, pubkeys: string[]): void {
  setCacheEntry(`followers:${pubkey}`, pubkeys);
}

/**
 * Get cached following list for a pubkey
 * Returns null if cache miss or expired
 */
export function getCachedFollowing(pubkey: string): string[] | null {
  return getCacheEntry<string[]>(`following:${pubkey}`);
}

/**
 * Set cached following list for a pubkey
 */
export function setCachedFollowing(pubkey: string, pubkeys: string[]): void {
  setCacheEntry(`following:${pubkey}`, pubkeys);
}

/**
 * Clear all social cache entries
 */
export function clearSocialCache(): void {
  if (typeof window === 'undefined') return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('followers:') || key.startsWith('following:'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

// Internal helpers
function getCacheEntry<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    const age = Date.now() - entry.timestamp;

    if (age > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

function setCacheEntry<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;

  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage might be full, ignore
  }
}
