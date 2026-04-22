// ABOUTME: Tests for Funnelcake REST API client functions
// ABOUTME: Tests HTTP communication layer in isolation from hooks and transforms

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NostrSigner } from '@nostrify/nostrify';
import { createNip98AuthHeader } from './nip98Auth';

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

vi.mock('./nip98Auth', () => ({
  createNip98AuthHeader: vi.fn(),
}));

const API_URL = 'https://api.divine.video';
const TEST_PUBKEY = 'a'.repeat(64);
const TEST_SIGNER = { signEvent: vi.fn() } as unknown as NostrSigner;

describe('funnelcakeClient', () => {
  let fetchUserProfile: typeof import('./funnelcakeClient').fetchUserProfile;
  let fetchBulkUsers: typeof import('./funnelcakeClient').fetchBulkUsers;
  let fetchBulkVideoStats: typeof import('./funnelcakeClient').fetchBulkVideoStats;
  let searchProfiles: typeof import('./funnelcakeClient').searchProfiles;
  let fetchRecommendations: typeof import('./funnelcakeClient').fetchRecommendations;
  let markNotificationsRead: typeof import('./funnelcakeClient').markNotificationsRead;
  let fetchNotifications: typeof import('./funnelcakeClient').fetchNotifications;

  beforeEach(async () => {
    vi.resetModules();
    // Mock fetch globally
    global.fetch = vi.fn();
    vi.mocked(createNip98AuthHeader).mockReset().mockResolvedValue('Nostr signed-auth');

    // Import after mocking
    const client = await import('./funnelcakeClient');
    fetchUserProfile = client.fetchUserProfile;
    fetchBulkUsers = client.fetchBulkUsers;
    fetchBulkVideoStats = client.fetchBulkVideoStats;
    searchProfiles = client.searchProfiles;
    fetchRecommendations = client.fetchRecommendations;
    markNotificationsRead = client.markNotificationsRead;
    fetchNotifications = client.fetchNotifications;
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

  describe('notification auth requests', () => {
    it('signs mark-as-read requests with the exact serialized JSON body', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, marked_count: 1 }),
      });

      const result = await markNotificationsRead(
        API_URL,
        TEST_PUBKEY,
        TEST_SIGNER,
        ['event-1'],
      );

      expect(result).toEqual({ success: true, markedCount: 1 });

      const expectedBody = JSON.stringify({ notification_ids: ['event-1'] });
      expect(createNip98AuthHeader).toHaveBeenCalledWith(
        TEST_SIGNER,
        `${API_URL}/api/users/${TEST_PUBKEY}/notifications/read`,
        'POST',
        expectedBody,
      );

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/api/users/${TEST_PUBKEY}/notifications/read`,
        expect.objectContaining({
          method: 'POST',
          body: expectedBody,
          headers: expect.objectContaining({
            'Authorization': 'Nostr signed-auth',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });

  describe('fetchRecommendations', () => {
    it('sends cursor param when provided', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          videos: [{ id: 'v1', pubkey: TEST_PUBKEY, video_url: 'https://example.com/v.mp4', d_tag: 'd1', created_at: 1700000000, kind: 34236 }],
          source: 'personalized',
          has_more: true,
          next_cursor: 'cursor-page2',
          next_offset: 12,
          fallback_applied: false,
          limit: 12,
          offset: 0,
        }),
      });

      const result = await fetchRecommendations(API_URL, {
        pubkey: TEST_PUBKEY,
        limit: 12,
        cursor: 'cursor-page1',
        fallback: 'popular',
      });

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestUrl = new URL(url as string);
      expect(requestUrl.searchParams.get('cursor')).toBe('cursor-page1');
      expect(requestUrl.searchParams.has('offset')).toBe(false);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBe('cursor-page2');
    });

    it('sends offset when no cursor provided', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          videos: [],
          source: 'popular',
          has_more: false,
          next_cursor: null,
          next_offset: null,
          fallback_applied: true,
          limit: 12,
          offset: 24,
        }),
      });

      const result = await fetchRecommendations(API_URL, {
        pubkey: TEST_PUBKEY,
        limit: 12,
        offset: 24,
        fallback: 'popular',
      });

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestUrl = new URL(url as string);
      expect(requestUrl.searchParams.get('offset')).toBe('24');
      expect(requestUrl.searchParams.has('cursor')).toBe(false);
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeUndefined();
    });

    it('uses next_offset when the server paginates without next_cursor', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          videos: [
            {
              id: 'v1',
              pubkey: TEST_PUBKEY,
              video_url: 'https://example.com/v.mp4',
              d_tag: 'd1',
              created_at: 1700000000,
              kind: 34236,
            },
          ],
          source: 'popular',
          has_more: true,
          next_cursor: null,
          next_offset: 36,
          fallback_applied: true,
          limit: 12,
          offset: 24,
        }),
      });

      const result = await fetchRecommendations(API_URL, {
        pubkey: TEST_PUBKEY,
        limit: 12,
        offset: 24,
        fallback: 'popular',
      });

      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBe('36');
    });

    it('uses backend has_more instead of computing locally', async () => {
      // Backend says has_more=false even though we got limit-count videos
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          videos: Array.from({ length: 12 }, (_, i) => ({
            id: `v${i}`, pubkey: TEST_PUBKEY, video_url: 'https://example.com/v.mp4',
            d_tag: `d${i}`, created_at: 1700000000, kind: 34236,
          })),
          source: 'popular',
          has_more: false,
          next_cursor: null,
          next_offset: null,
          fallback_applied: true,
          limit: 12,
          offset: 0,
        }),
      });

      const result = await fetchRecommendations(API_URL, {
        pubkey: TEST_PUBKEY,
        limit: 12,
        fallback: 'popular',
      });

      // Even though videoCount === limit, backend says no more
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeUndefined();
    });
  });

  describe('searchProfiles', () => {
    it('passes through documented profile-search parameters', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await searchProfiles(API_URL, {
        query: 'jack',
        limit: 20,
        offset: 40,
        sortBy: 'relevance',
        hasVideos: true,
      });

      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestUrl = new URL(url as string);

      expect(requestUrl.pathname).toBe('/api/search/profiles');
      expect(requestUrl.searchParams.get('q')).toBe('jack');
      expect(requestUrl.searchParams.get('limit')).toBe('20');
      expect(requestUrl.searchParams.get('offset')).toBe('40');
      expect(requestUrl.searchParams.get('sort_by')).toBe('relevance');
      expect(requestUrl.searchParams.get('has_videos')).toBe('true');
      expect(init).toEqual(expect.objectContaining({
        signal: expect.any(AbortSignal),
      }));
    });
  });

  describe('fetchNotifications', () => {
    it('forwards notification type and unread filters to the backend', async () => {
      const signer = {
        signEvent: vi.fn().mockResolvedValue({
          id: 'event-id',
          sig: 'sig',
          pubkey: TEST_PUBKEY,
          kind: 27235,
          created_at: 1_700_000_000,
          content: '',
          tags: [],
        }),
        getPublicKey: vi.fn().mockResolvedValue(TEST_PUBKEY),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          notifications: [],
          unread_count: 2,
          has_more: false,
        }),
      });

      await fetchNotifications(API_URL, TEST_PUBKEY, signer as never, {
        limit: 30,
        before: 'cursor-1',
        unreadOnly: true,
        types: ['like', 'follow'],
      });

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestUrl = new URL(url as string);

      expect(requestUrl.pathname).toBe(`/api/users/${TEST_PUBKEY}/notifications`);
      expect(requestUrl.searchParams.get('limit')).toBe('30');
      expect(requestUrl.searchParams.get('before')).toBe('cursor-1');
      expect(requestUrl.searchParams.get('unread_only')).toBe('true');
      expect(requestUrl.searchParams.get('types')).toBe('like,follow');
    });
  });

  describe('fetchRecommendations', () => {
    it('falls back to offset pagination when the server omits cursor metadata', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          videos: [
            {
              id: 'vid-1',
              pubkey: TEST_PUBKEY,
              created_at: 123,
              kind: 34236,
              d_tag: 'd-1',
              title: 'Video 1',
              content: '',
              thumbnail: 'https://example.com/thumb-1.jpg',
              video_url: 'https://example.com/video-1.mp4',
            },
          ],
          source: 'personalized',
        }),
      });

      const result = await fetchRecommendations(API_URL, {
        pubkey: TEST_PUBKEY,
        limit: 12,
        offset: 24,
        fallback: 'popular',
      });

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestUrl = new URL(url as string);
      expect(requestUrl.searchParams.get('offset')).toBe('24');
      expect(result.videos).toHaveLength(1);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBe('36');
    });
  });
});
