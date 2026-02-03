// ABOUTME: Persistent cache for user follow lists (Kind 3) with localStorage + IndexedDB
// ABOUTME: Enables instant load of cached follow list while background refresh happens

import { debugLog, debugWarn } from './debug';

interface CachedFollowList {
  pubkey: string;
  follows: string[];
  timestamp: number;
  eventId: string; // To detect if we have the latest version
  createdAt: number; // Original event created_at timestamp
}

const DB_NAME = 'follow_list_cache';
const DB_VERSION = 1;
const STORE_NAME = 'follow_lists';

class FollowListCache {
  private readonly CACHE_KEY_PREFIX = 'follow_list_';
  private readonly MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initIndexedDB();
  }

  private async initIndexedDB(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      debugWarn('[FollowListCache] IndexedDB not available, using localStorage only');
      return;
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        debugWarn('[FollowListCache] IndexedDB initialization failed:', request.error);
        resolve(); // Don't reject, fall back to localStorage only
      };

      request.onsuccess = () => {
        this.db = request.result;
        debugLog('[FollowListCache] IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'pubkey' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          debugLog('[FollowListCache] Created IndexedDB object store');
        }
      };
    });
  }

  /**
   * Get cached follow list synchronously from localStorage
   * This is the fast path for immediate UI rendering
   */
  getCached(pubkey: string): CachedFollowList | null {
    try {
      const key = this.CACHE_KEY_PREFIX + pubkey;
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const data: CachedFollowList = JSON.parse(cached);

      // Validate structure
      if (!data.pubkey || !Array.isArray(data.follows) || !data.timestamp) {
        debugWarn('[FollowListCache] Invalid cached data structure, clearing');
        this.invalidate(pubkey);
        return null;
      }

      return data;
    } catch (error) {
      debugWarn('[FollowListCache] Failed to read from localStorage:', error);
      return null;
    }
  }

  /**
   * Set cached follow list in localStorage (synchronous)
   * Also persists to IndexedDB asynchronously
   */
  setCached(data: CachedFollowList): void {
    try {
      const key = this.CACHE_KEY_PREFIX + data.pubkey;
      localStorage.setItem(key, JSON.stringify(data));
      debugLog(`[FollowListCache] Cached follow list for ${data.pubkey}: ${data.follows.length} follows`);

      // Also persist to IndexedDB in background
      this.persistToIndexedDB(data).catch(err => {
        debugWarn('[FollowListCache] Failed to persist to IndexedDB:', err);
      });
    } catch (error) {
      debugWarn('[FollowListCache] Failed to write to localStorage:', error);
    }
  }

  /**
   * Check if cached data is still fresh
   */
  isFresh(pubkey: string): boolean {
    const cached = this.getCached(pubkey);
    if (!cached) return false;

    const age = Date.now() - cached.timestamp;
    const isFresh = age < this.MAX_AGE_MS;

    if (!isFresh) {
      debugLog(`[FollowListCache] Cache is stale (${Math.round(age / 1000)}s old)`);
    }

    return isFresh;
  }

  /**
   * Check if cached data is newer than a given event
   */
  isNewerThan(pubkey: string, eventCreatedAt: number): boolean {
    const cached = this.getCached(pubkey);
    if (!cached) return false;

    return cached.createdAt >= eventCreatedAt;
  }

  /**
   * Invalidate cache for a specific pubkey
   */
  invalidate(pubkey: string): void {
    try {
      const key = this.CACHE_KEY_PREFIX + pubkey;
      localStorage.removeItem(key);
      debugLog(`[FollowListCache] Invalidated cache for ${pubkey}`);

      // Also remove from IndexedDB
      this.removeFromIndexedDB(pubkey).catch(err => {
        debugWarn('[FollowListCache] Failed to remove from IndexedDB:', err);
      });
    } catch (error) {
      debugWarn('[FollowListCache] Failed to invalidate cache:', error);
    }
  }

  /**
   * Persist to IndexedDB for long-term storage
   */
  async persistToIndexedDB(data: CachedFollowList): Promise<void> {
    await this.initPromise;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load from IndexedDB (async fallback if localStorage is cleared)
   */
  async loadFromIndexedDB(pubkey: string): Promise<CachedFollowList | null> {
    await this.initPromise;
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(pubkey);

      request.onsuccess = () => {
        const data = request.result as CachedFollowList | undefined;
        if (data) {
          debugLog(`[FollowListCache] Loaded from IndexedDB: ${data.follows.length} follows`);
          // Restore to localStorage for fast access
          this.setCached(data);
        }
        resolve(data || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove from IndexedDB
   */
  private async removeFromIndexedDB(pubkey: string): Promise<void> {
    await this.initPromise;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(pubkey);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all cached follow lists
   */
  async clearAll(): Promise<void> {
    // Clear localStorage
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(this.CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }

    // Clear IndexedDB
    await this.initPromise;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        debugLog('[FollowListCache] Cleared all caches');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const followListCache = new FollowListCache();
