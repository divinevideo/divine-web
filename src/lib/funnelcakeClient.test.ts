// ABOUTME: Tests for Funnelcake REST API client functions
// ABOUTME: Tests HTTP communication layer in isolation from hooks and transforms

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock the health module before importing the client
vi.mock('./funnelcakeHealth', () => ({
  recordFunnelcakeSuccess: vi.fn(),
  recordFunnelcakeFailure: vi.fn(),
  isFunnelcakeAvailable: vi.fn().mockReturnValue(true),
}));

vi.mock('./debug', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

const API_URL = 'https://relay.divine.video';
const TEST_PUBKEY = 'a'.repeat(64);

describe('funnelcakeClient', () => {
  let fetchUserProfile: typeof import('./funnelcakeClient').fetchUserProfile;
  let fetchBulkUsers: typeof import('./funnelcakeClient').fetchBulkUsers;
  let fetchBulkVideoStats: typeof import('./funnelcakeClient').fetchBulkVideoStats;

  beforeEach(async () => {
    vi.resetModules();
    // Mock fetch globally
    global.fetch = vi.fn();

    // Import after mocking
    const client = await import('./funnelcakeClient');
    fetchUserProfile = client.fetchUserProfile;
    fetchBulkUsers = client.fetchBulkUsers;
    fetchBulkVideoStats = client.fetchBulkVideoStats;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchUserProfile', () => {
    it('fetches user from REST API and flattens response', async () => {
      const mockResponse = {
        pubkey: TEST_PUBKEY,
        profile: {
          name: 'testuser',
          display_name: 'Test User',
          picture: 'https://example.com/pic.jpg',
          about: 'Test bio',
          nip05: 'test@example.com',
        },
        social: {
          follower_count: 100,
          following_count: 50,
        },
        stats: {
          video_count: 10,
        },
        engagement: {
          total_reactions: 500,
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchUserProfile(API_URL, TEST_PUBKEY);

      expect(result).not.toBeNull();
      expect(result?.pubkey).toBe(TEST_PUBKEY);
      expect(result?.name).toBe('testuser');
      expect(result?.follower_count).toBe(100);
      expect(result?.following_count).toBe(50);
      expect(result?.video_count).toBe(10);
      expect(result?.total_reactions).toBe(500);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/users/${TEST_PUBKEY}`),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('returns null on network error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await fetchUserProfile(API_URL, TEST_PUBKEY);

      expect(result).toBeNull();
    });

    it('returns null on 404', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('User not found'),
      });

      const result = await fetchUserProfile(API_URL, TEST_PUBKEY);

      expect(result).toBeNull();
    });

    it('handles null profile gracefully', async () => {
      const mockResponse = {
        pubkey: TEST_PUBKEY,
        profile: null, // Some users have no profile metadata
        social: {
          follower_count: 0,
          following_count: 0,
        },
        stats: {
          video_count: 0,
        },
        engagement: {
          total_reactions: 0,
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchUserProfile(API_URL, TEST_PUBKEY);

      expect(result).not.toBeNull();
      expect(result?.pubkey).toBe(TEST_PUBKEY);
      expect(result?.name).toBeUndefined();
      expect(result?.follower_count).toBe(0);
    });

    it('supports AbortSignal cancellation', async () => {
      const controller = new AbortController();
      controller.abort();

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new DOMException('Aborted', 'AbortError')
      );

      const result = await fetchUserProfile(API_URL, TEST_PUBKEY, controller.signal);

      expect(result).toBeNull();
    });
  });

  describe('fetchBulkUsers', () => {
    it('POSTs to /api/users/bulk with pubkeys array', async () => {
      const pubkeys = ['a'.repeat(64), 'b'.repeat(64)];
      const mockResponse = {
        users: [
          { pubkey: pubkeys[0], profile: { name: 'user1' }, social: { follower_count: 10 } },
          { pubkey: pubkeys[1], profile: { name: 'user2' }, social: { follower_count: 20 } },
        ],
        missing: [],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchBulkUsers(API_URL, pubkeys);

      expect(result.users).toHaveLength(2);
      expect(result.missing).toHaveLength(0);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/bulk'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pubkeys }),
        })
      );
    });

    it('handles partial results (some users not found)', async () => {
      const pubkeys = ['a'.repeat(64), 'b'.repeat(64)];
      const mockResponse = {
        users: [
          { pubkey: pubkeys[0], profile: { name: 'user1' } },
        ],
        missing: [pubkeys[1]],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchBulkUsers(API_URL, pubkeys);

      expect(result.users).toHaveLength(1);
      expect(result.missing).toContain(pubkeys[1]);
    });

    it('throws FunnelcakeApiError on HTTP error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      });

      await expect(fetchBulkUsers(API_URL, ['a'.repeat(64)]))
        .rejects.toThrow();
    });

    it('returns empty users array for empty input', async () => {
      const result = await fetchBulkUsers(API_URL, []);

      expect(result.users).toEqual([]);
      expect(result.missing).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('fetchBulkVideoStats', () => {
    it('POSTs to /api/videos/stats/bulk with event_ids', async () => {
      const eventIds = ['vid1'.padEnd(64, '0'), 'vid2'.padEnd(64, '0')];
      const mockResponse = {
        stats: [
          { id: eventIds[0], reactions: 10, comments: 5, reposts: 2 },
          { id: eventIds[1], reactions: 20, comments: 10, reposts: 4 },
        ],
        missing: [],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchBulkVideoStats(API_URL, eventIds);

      expect(result.stats).toHaveLength(2);
      expect(result.stats[0].reactions).toBe(10);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/videos/stats/bulk'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_ids: eventIds }),
        })
      );
    });

    it('handles missing videos in response', async () => {
      const eventIds = ['vid1'.padEnd(64, '0'), 'vid2'.padEnd(64, '0')];
      const mockResponse = {
        stats: [
          { id: eventIds[0], reactions: 10, comments: 5, reposts: 2 },
        ],
        missing: [eventIds[1]],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchBulkVideoStats(API_URL, eventIds);

      expect(result.stats).toHaveLength(1);
      expect(result.missing).toContain(eventIds[1]);
    });

    it('returns empty stats array for empty input', async () => {
      const result = await fetchBulkVideoStats(API_URL, []);

      expect(result.stats).toEqual([]);
      expect(result.missing).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('normalizes object-keyed stats from Funnelcake into array format', async () => {
      const eventIds = ['vid1'.padEnd(64, '0'), 'vid2'.padEnd(64, '0')];
      // Funnelcake actually returns stats as an object keyed by event ID
      const mockResponse = {
        stats: {
          [eventIds[0]]: { views: 3, reactions: 1, comments: 0, reposts: 0 },
          [eventIds[1]]: { views: 5, reactions: 0, comments: 0, reposts: 0 },
        },
        missing: [],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchBulkVideoStats(API_URL, eventIds);

      expect(result.stats).toHaveLength(2);
      expect(result.stats[0].id).toBe(eventIds[0]);
      expect(result.stats[0].reactions).toBe(1);
      expect(result.stats[1].id).toBe(eventIds[1]);
      expect(result.stats[1].views).toBe(5);
    });

    it('normalizes empty object stats to empty array', async () => {
      const eventIds = ['vid1'.padEnd(64, '0')];
      const mockResponse = { stats: {}, missing: [eventIds[0]] };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchBulkVideoStats(API_URL, eventIds);

      expect(result.stats).toEqual([]);
      expect(result.missing).toContain(eventIds[0]);
    });
  });
});
