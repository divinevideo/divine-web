import { describe, it, expect, vi, afterEach } from 'vitest';

describe('FollowListCache', () => {
  const originalIndexedDB = globalThis.indexedDB;

  afterEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: originalIndexedDB,
    });
  });

  it('does not throw when indexedDB is unavailable', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: undefined,
    });

    const { followListCache } = await import('./followListCache');

    // Constructor should not throw
    expect(followListCache).toBeDefined();

    // getCached should return null gracefully (may also lack localStorage in test)
    const result = followListCache.getCached('test-pubkey');
    expect(result).toBeNull();
  });

  it('does not throw when setting cache without indexedDB', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: undefined,
    });

    const { followListCache } = await import('./followListCache');

    // setCached should not throw even without IndexedDB
    expect(() => {
      followListCache.setCached({
        pubkey: 'abc123',
        follows: ['def456'],
        timestamp: Date.now(),
        eventId: 'event-1',
        createdAt: Math.floor(Date.now() / 1000),
      });
    }).not.toThrow();
  });
});
