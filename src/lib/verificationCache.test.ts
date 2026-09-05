// ABOUTME: Tests for NIP-39 verification localStorage cache
// ABOUTME: Tests TTL behavior for verified (24hr) and failed (15min) results

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCachedVerification,
  setCachedVerification,
  clearVerificationCache,
} from './verificationCache';

const PUBKEY = 'a'.repeat(64);

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

beforeEach(() => {
  localStorageMock.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorageMock.clear();
});

describe('getCachedVerification', () => {
  it('returns null on cache miss', () => {
    expect(getCachedVerification('github', 'alice', 'abc123', PUBKEY)).toBeNull();
  });

  it('returns cached verified result within 24hr TTL', () => {
    setCachedVerification('github', 'alice', 'abc123', PUBKEY, { verified: true });
    const result = getCachedVerification('github', 'alice', 'abc123', PUBKEY);
    expect(result).toEqual({ verified: true });
  });

  it('returns cached failed result within 15min TTL', () => {
    setCachedVerification('github', 'bob', 'def456', PUBKEY, { verified: false, error: 'HTTP 404' });
    const result = getCachedVerification('github', 'bob', 'def456', PUBKEY);
    expect(result).toEqual({ verified: false, error: 'HTTP 404' });
  });

  it('expires verified results after 24 hours', () => {
    setCachedVerification('github', 'alice', 'abc123', PUBKEY, { verified: true });

    // Advance time past 24 hours
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 24 * 60 * 60 * 1000 + 1);

    expect(getCachedVerification('github', 'alice', 'abc123', PUBKEY)).toBeNull();
  });

  it('expires failed results after 15 minutes', () => {
    setCachedVerification('github', 'bob', 'def456', PUBKEY, { verified: false, error: 'HTTP 404' });

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 15 * 60 * 1000 + 1);

    expect(getCachedVerification('github', 'bob', 'def456', PUBKEY)).toBeNull();
  });

  it('uses the full proof in the cache key', () => {
    setCachedVerification('github', 'alice', 'abcdefghij', PUBKEY, { verified: true });
    expect(getCachedVerification('github', 'alice', 'abcdefghij', PUBKEY)).toEqual({ verified: true });
    expect(getCachedVerification('github', 'alice', 'abcdefghXX', PUBKEY)).toBeNull();
    expect(getCachedVerification('github', 'alice', 'XXXXXXXX', PUBKEY)).toBeNull();
  });

  it('scopes cached results to the Nostr pubkey', () => {
    setCachedVerification('discord', 'alice', 'https://discord.com/channels/1/2/3', PUBKEY, {
      verified: true,
    });

    expect(
      getCachedVerification('discord', 'alice', 'https://discord.com/channels/1/2/3', 'b'.repeat(64)),
    ).toBeNull();
  });

  it('returns null on corrupted JSON', () => {
    setCachedVerification('github', 'alice', 'abc12345xx', PUBKEY, { verified: true });
    localStorageMock.setItem(localStorageMock.key(0)!, 'not-json');
    expect(getCachedVerification('github', 'alice', 'abc12345xx', PUBKEY)).toBeNull();
  });
});

describe('clearVerificationCache', () => {
  it('removes only verification keys', () => {
    setCachedVerification('github', 'alice', 'abc123', PUBKEY, { verified: true });
    setCachedVerification('twitter', 'bob', 'def456', PUBKEY, { verified: false, error: 'manual' });
    localStorageMock.setItem('other_key', 'should-stay');

    clearVerificationCache();

    expect(getCachedVerification('github', 'alice', 'abc123', PUBKEY)).toBeNull();
    expect(getCachedVerification('twitter', 'bob', 'def456', PUBKEY)).toBeNull();
    expect(localStorageMock.getItem('other_key')).toBe('should-stay');
  });

  it('handles empty localStorage', () => {
    expect(() => clearVerificationCache()).not.toThrow();
  });
});
