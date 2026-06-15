// ABOUTME: Tests for social cache localStorage operations
// ABOUTME: Tests TTL expiration and cache read/write

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCachedFollowers,
  setCachedFollowers,
  getCachedFollowing,
  setCachedFollowing,
  clearSocialCache,
} from './socialCache';

// Mock localStorage for Node.js environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('socialCache', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    localStorageMock.clear();
    vi.useRealTimers();
  });

  describe('getCachedFollowers/setCachedFollowers', () => {
    it('reads cached followers list', () => {
      const pubkey = 'abc123';
      const followers = ['pk1', 'pk2', 'pk3'];

      setCachedFollowers(pubkey, followers);
      expect(getCachedFollowers(pubkey)).toEqual(followers);
    });

    it('returns null when cache miss', () => {
      expect(getCachedFollowers('unknown')).toBeNull();
    });

    it('expires cache after TTL (5 minutes)', () => {
      const pubkey = 'abc123';
      const followers = ['pk1', 'pk2'];

      setCachedFollowers(pubkey, followers);
      expect(getCachedFollowers(pubkey)).toEqual(followers);

      // Advance time by 6 minutes
      vi.advanceTimersByTime(6 * 60 * 1000);

      expect(getCachedFollowers(pubkey)).toBeNull();
    });

    it('returns data within TTL', () => {
      const pubkey = 'abc123';
      const followers = ['pk1'];

      setCachedFollowers(pubkey, followers);

      // Advance time by 4 minutes (within TTL)
      vi.advanceTimersByTime(4 * 60 * 1000);

      expect(getCachedFollowers(pubkey)).toEqual(followers);
    });
  });

  describe('getCachedFollowing/setCachedFollowing', () => {
    it('reads cached following list', () => {
      const pubkey = 'abc123';
      const following = ['pk1', 'pk2'];

      setCachedFollowing(pubkey, following);
      expect(getCachedFollowing(pubkey)).toEqual(following);
    });

    it('returns null when cache miss', () => {
      expect(getCachedFollowing('unknown')).toBeNull();
    });
  });

  describe('clearSocialCache', () => {
    it('clears all followers and following entries', () => {
      setCachedFollowers('user1', ['a', 'b']);
      setCachedFollowing('user1', ['c', 'd']);
      setCachedFollowers('user2', ['e']);

      // Add a non-social item that should NOT be cleared
      localStorageMock.setItem('other-key', 'value');

      clearSocialCache();

      expect(getCachedFollowers('user1')).toBeNull();
      expect(getCachedFollowing('user1')).toBeNull();
      expect(getCachedFollowers('user2')).toBeNull();
      expect(localStorageMock.getItem('other-key')).toBe('value');
    });
  });
});
