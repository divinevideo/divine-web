// ABOUTME: Tests for NIP-39 verification localStorage cache
// ABOUTME: Tests TTL behavior for verified (24hr) and failed (15min) results

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCachedVerification,
  setCachedVerification,
  clearVerificationCache,
} from './verificationCache';

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
    expect(getCachedVerification('github', 'alice', 'abc123')).toBeNull();
  });

  it('returns cached verified result within 24hr TTL', () => {
    setCachedVerification('github', 'alice', 'abc123', { verified: true });
    const result = getCachedVerification('github', 'alice', 'abc123');
    expect(result).toEqual({ verified: true });
  });

  it('returns cached failed result within 15min TTL', () => {
    setCachedVerification('github', 'bob', 'def456', { verified: false, error: 'HTTP 404' });
    const result = getCachedVerification('github', 'bob', 'def456');
    expect(result).toEqual({ verified: false, error: 'HTTP 404' });
  });

  it('expires verified results after 24 hours', () => {
    setCachedVerification('github', 'alice', 'abc123', { verified: true });

    // Advance time past 24 hours
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 24 * 60 * 60 * 1000 + 1);

    expect(getCachedVerification('github', 'alice', 'abc123')).toBeNull();
  });

  it('expires failed results after 15 minutes', () => {
    setCachedVerification('github', 'bob', 'def456', { verified: false, error: 'HTTP 404' });

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 15 * 60 * 1000 + 1);

    expect(getCachedVerification('github', 'bob', 'def456')).toBeNull();
  });

  it('uses first 8 chars of proof as cache key suffix', () => {
    setCachedVerification('github', 'alice', 'abcdefghij', { verified: true });
    // Same first 8 chars should hit cache
    expect(getCachedVerification('github', 'alice', 'abcdefghij')).toEqual({ verified: true });
    expect(getCachedVerification('github', 'alice', 'abcdefghXX')).toEqual({ verified: true });
    // Different first 8 chars should miss
    expect(getCachedVerification('github', 'alice', 'XXXXXXXX')).toBeNull();
  });

  it('returns null on corrupted JSON', () => {
    localStorageMock.setItem('divine_verify_github:alice:abc12345', 'not-json');
    expect(getCachedVerification('github', 'alice', 'abc12345xx')).toBeNull();
  });
});

describe('clearVerificationCache', () => {
  it('removes only verification keys', () => {
    setCachedVerification('github', 'alice', 'abc123', { verified: true });
    setCachedVerification('twitter', 'bob', 'def456', { verified: false, error: 'manual' });
    localStorageMock.setItem('other_key', 'should-stay');

    clearVerificationCache();

    expect(getCachedVerification('github', 'alice', 'abc123')).toBeNull();
    expect(getCachedVerification('twitter', 'bob', 'def456')).toBeNull();
    expect(localStorageMock.getItem('other_key')).toBe('should-stay');
  });

  it('handles empty localStorage', () => {
    expect(() => clearVerificationCache()).not.toThrow();
  });
});
