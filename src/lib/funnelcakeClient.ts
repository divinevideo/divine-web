// ABOUTME: Funnelcake REST API client for efficient video queries
// ABOUTME: Provides pre-computed trending scores and engagement metrics

import { debugLog, debugError } from './debug';
import { API_CONFIG } from '@/config/api';
import { recordFunnelcakeSuccess, recordFunnelcakeFailure, isFunnelcakeAvailable } from './funnelcakeHealth';
import type {
  FunnelcakeVideoRaw,
  FunnelcakeResponse,
  FunnelcakeFetchOptions,
  FunnelcakeSearchOptions,
  FunnelcakeUserFeedOptions,
  FunnelcakeVideoStats,
  FunnelcakeHashtag,
  FunnelcakeViner,
} from '@/types/funnelcake';

/**
 * Convert a byte array to hex string
 * Funnelcake returns id/pubkey as number arrays like [49, 52, 55, ...]
 */
export function parseByteArrayId(raw: number[]): string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return '';
  }
  return raw.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Build URL with query parameters
 */
function buildUrl(baseUrl: string, endpoint: string, params: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(endpoint, baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

/**
 * Make a Funnelcake API request with error handling
 */
async function funnelcakeRequest<T>(
  apiUrl: string,
  endpoint: string,
  params: Record<string, string | number | boolean | undefined> = {},
  signal?: AbortSignal
): Promise<T> {
  const url = buildUrl(apiUrl, endpoint, params);
  const timeout = API_CONFIG.funnelcake.timeout;

  debugLog(`[FunnelcakeClient] Request: ${url}`);

  const timeoutSignal = AbortSignal.timeout(timeout);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetch(url, {
      signal: combinedSignal,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new FunnelcakeApiError(
        `Funnelcake API error: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data = await response.json();
    recordFunnelcakeSuccess(apiUrl);

    debugLog(`[FunnelcakeClient] Response OK:`, { endpoint, resultCount: Array.isArray(data?.videos) ? data.videos.length : 'N/A' });

    return data as T;
  } catch (err) {
    // Don't double-record if it's already a FunnelcakeApiError
    if (err instanceof FunnelcakeApiError) {
      recordFunnelcakeFailure(apiUrl, err.message);
      throw err;
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    recordFunnelcakeFailure(apiUrl, message);

    debugError(`[FunnelcakeClient] Request failed: ${message}`);
    throw new FunnelcakeApiError(message, null, undefined);
  }
}

/**
 * Custom error class for Funnelcake API errors
 */
export class FunnelcakeApiError extends Error {
  constructor(
    message: string,
    public statusCode: number | null,
    public details?: string
  ) {
    super(message);
    this.name = 'FunnelcakeApiError';
  }
}

/**
 * Check if Funnelcake API is available at the given URL
 * Uses circuit breaker state and optional active health check
 */
export async function checkFunnelcakeAvailable(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  activeCheck: boolean = false
): Promise<boolean> {
  // First check circuit breaker state
  if (!isFunnelcakeAvailable(apiUrl)) {
    return false;
  }

  // Optionally perform active health check
  if (activeCheck) {
    try {
      await funnelcakeRequest<{ status: string }>(
        apiUrl,
        API_CONFIG.funnelcake.endpoints.health,
        {},
        AbortSignal.timeout(5000)
      );
      return true;
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Fetch videos from Funnelcake API
 *
 * @param apiUrl - Base URL of the Funnelcake API
 * @param options - Fetch options (sort, limit, pagination cursor, etc.)
 * @returns Promise with videos and pagination info
 */
export async function fetchVideos(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  options: FunnelcakeFetchOptions = {}
): Promise<FunnelcakeResponse> {
  const { sort = 'trending', limit = 20, before, classic, platform, signal } = options;

  const params: Record<string, string | number | boolean | undefined> = {
    sort,
    limit,
    before,
    classic,
    platform,
  };

  // API returns array directly, wrap it in expected format
  const videos = await funnelcakeRequest<FunnelcakeVideoRaw[]>(
    apiUrl,
    API_CONFIG.funnelcake.endpoints.videos,
    params,
    signal
  );

  return {
    videos,
    has_more: videos.length >= limit,
    next_cursor: videos.length > 0 ? String(videos[videos.length - 1].created_at) : undefined,
  };
}

/**
 * Search videos via Funnelcake API
 *
 * @param apiUrl - Base URL of the Funnelcake API
 * @param options - Search options (query, tag, author, etc.)
 * @returns Promise with matching videos and pagination info
 */
export async function searchVideos(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  options: FunnelcakeSearchOptions = {}
): Promise<FunnelcakeResponse> {
  const { query, tag, author, sort = 'trending', limit = 20, before, classic, platform, signal } = options;

  // Use /api/videos endpoint for hashtag searches (tag parameter)
  // Use /api/search endpoint for text searches (q parameter)
  const isHashtagSearch = !!tag && !query;
  const endpoint = isHashtagSearch
    ? API_CONFIG.funnelcake.endpoints.videos
    : API_CONFIG.funnelcake.endpoints.search;

  const params: Record<string, string | number | boolean | undefined> = {
    q: query,
    tag,
    author,
    sort,
    limit,
    before,
    classic,
    platform,
  };

  // API returns array directly, wrap it in expected format
  const videos = await funnelcakeRequest<FunnelcakeVideoRaw[]>(
    apiUrl,
    endpoint,
    params,
    signal
  );

  return {
    videos,
    has_more: videos.length >= limit,
    next_cursor: videos.length > 0 ? String(videos[videos.length - 1].created_at) : undefined,
  };
}

/**
 * Fetch videos by a specific user
 *
 * @param apiUrl - Base URL of the Funnelcake API
 * @param pubkey - User's public key (hex)
 * @param options - Fetch options
 * @returns Promise with user's videos and pagination info
 */
export async function fetchUserVideos(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  pubkey: string,
  options: FunnelcakeFetchOptions = {}
): Promise<FunnelcakeResponse> {
  const { sort = 'recent', limit = 20, before, signal } = options;

  const endpoint = API_CONFIG.funnelcake.endpoints.userVideos.replace('{pubkey}', pubkey);

  const params: Record<string, string | number | boolean | undefined> = {
    sort,
    limit,
    before,
  };

  // API returns array directly, wrap it in expected format
  const videos = await funnelcakeRequest<FunnelcakeVideoRaw[]>(
    apiUrl,
    endpoint,
    params,
    signal
  );

  return {
    videos,
    has_more: videos.length >= limit,
    next_cursor: videos.length > 0 ? String(videos[videos.length - 1].created_at) : undefined,
  };
}

/**
 * Fetch personalized feed for a user (videos from followed accounts)
 *
 * @param apiUrl - Base URL of the Funnelcake API
 * @param options - User feed options including pubkey
 * @returns Promise with feed videos and pagination info
 */
export async function fetchUserFeed(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  options: FunnelcakeUserFeedOptions
): Promise<FunnelcakeResponse> {
  const { pubkey, sort = 'recent', limit = 20, before, signal } = options;

  const endpoint = API_CONFIG.funnelcake.endpoints.userFeed.replace('{pubkey}', pubkey);

  const params: Record<string, string | number | boolean | undefined> = {
    sort,
    limit,
    before,
  };

  // API returns array directly, wrap it in expected format
  const videos = await funnelcakeRequest<FunnelcakeVideoRaw[]>(
    apiUrl,
    endpoint,
    params,
    signal
  );

  return {
    videos,
    has_more: videos.length >= limit,
    next_cursor: videos.length > 0 ? String(videos[videos.length - 1].created_at) : undefined,
  };
}

/**
 * Response from recommendations endpoint
 */
interface FunnelcakeRecommendationsResponse {
  videos: FunnelcakeVideoRaw[];
  source: 'personalized' | 'popular' | 'recent';
}

/**
 * Options for fetching recommendations
 */
export interface FunnelcakeRecommendationsOptions {
  pubkey: string;
  limit?: number;
  category?: string;
  fallback?: 'popular' | 'recent';
  signal?: AbortSignal;
}

/**
 * Fetch personalized video recommendations for a user
 *
 * @param apiUrl - Base URL of the Funnelcake API
 * @param options - Recommendations options including pubkey
 * @returns Promise with recommended videos and pagination info
 */
export async function fetchRecommendations(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  options: FunnelcakeRecommendationsOptions
): Promise<FunnelcakeResponse & { source?: string }> {
  const { pubkey, limit = 20, category, fallback, signal } = options;

  const endpoint = API_CONFIG.funnelcake.endpoints.userRecommendations.replace('{pubkey}', pubkey);

  const params: Record<string, string | number | boolean | undefined> = {
    limit,
    category,
    fallback,
  };

  debugLog(`[FunnelcakeClient] Fetching recommendations for ${pubkey}`, { limit, category, fallback });

  const response = await funnelcakeRequest<FunnelcakeRecommendationsResponse>(
    apiUrl,
    endpoint,
    params,
    signal
  );

  debugLog(`[FunnelcakeClient] Got ${response.videos?.length || 0} recommendations (source: ${response.source})`);

  return {
    videos: response.videos || [],
    has_more: (response.videos?.length || 0) >= limit,
    next_cursor: undefined, // Recommendations don't support cursor-based pagination
    source: response.source,
  };
}

/**
 * Fetch statistics for a specific video
 *
 * @param apiUrl - Base URL of the Funnelcake API
 * @param eventId - Video event ID (hex)
 * @param signal - Optional abort signal
 * @returns Promise with video statistics
 */
export async function fetchVideoStats(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  eventId: string,
  signal?: AbortSignal
): Promise<FunnelcakeVideoStats> {
  const endpoint = API_CONFIG.funnelcake.endpoints.videoStats.replace('{eventId}', eventId);

  return funnelcakeRequest<FunnelcakeVideoStats>(
    apiUrl,
    endpoint,
    {},
    signal
  );
}

/**
 * Fetch popular hashtags (by total video count)
 *
 * @param apiUrl - Base URL of the Funnelcake API
 * @param limit - Maximum number of hashtags to return (1-100, default 50)
 * @param signal - Optional abort signal
 * @returns Promise with popular hashtags
 */
export async function fetchPopularHashtags(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  limit: number = 50,
  signal?: AbortSignal
): Promise<FunnelcakeHashtag[]> {
  // API returns array directly
  return funnelcakeRequest<FunnelcakeHashtag[]>(
    apiUrl,
    API_CONFIG.funnelcake.endpoints.hashtags,
    { limit },
    signal
  );
}

/**
 * Fetch trending hashtags (time-weighted)
 *
 * @param apiUrl - Base URL of the Funnelcake API
 * @param limit - Maximum number of hashtags to return
 * @param signal - Optional abort signal
 * @returns Promise with trending hashtags
 */
export async function fetchTrendingHashtags(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  limit: number = 20,
  signal?: AbortSignal
): Promise<FunnelcakeHashtag[]> {
  // API returns array directly
  return funnelcakeRequest<FunnelcakeHashtag[]>(
    apiUrl,
    API_CONFIG.funnelcake.endpoints.trendingHashtags,
    { limit },
    signal
  );
}

/**
 * Fetch classic Vine creators (popular Viners)
 *
 * @param apiUrl - Base URL of the Funnelcake API
 * @param limit - Maximum number of viners to return
 * @param signal - Optional abort signal
 * @returns Promise with classic viners
 */
export async function fetchClassicViners(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  limit: number = 20,
  signal?: AbortSignal
): Promise<FunnelcakeViner[]> {
  // API returns array directly
  return funnelcakeRequest<FunnelcakeViner[]>(
    apiUrl,
    API_CONFIG.funnelcake.endpoints.viners,
    { limit },
    signal
  );
}

/**
 * Response from /api/videos/{id} endpoint
 */
interface VideoByIdResponse {
  event: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig: string;
  };
  stats: {
    reactions: number;
    comments: number;
    reposts: number;
    engagement_score: number;
    trending_score: number;
    embedded_loops?: number;
  };
}

/**
 * Fetch a single video by event ID or d_tag
 *
 * @param apiUrl - Base URL of the Funnelcake API
 * @param identifier - Video event ID (hex) or d_tag
 * @param pubkey - Optional author pubkey for faster lookup
 * @param signal - Optional abort signal
 * @returns Promise with the video or null if not found
 */
export async function fetchVideoById(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  identifier: string,
  pubkey?: string,
  signal?: AbortSignal
): Promise<FunnelcakeVideoRaw | null> {
  debugLog(`[FunnelcakeClient] fetchVideoById: ${identifier}, pubkey: ${pubkey || 'none'}`);

  try {
    // First try the direct /api/videos/{id} endpoint
    try {
      const response = await funnelcakeRequest<VideoByIdResponse>(
        apiUrl,
        `${API_CONFIG.funnelcake.endpoints.videos}/${identifier}`,
        {},
        signal
      );

      if (response && response.event) {
        debugLog(`[FunnelcakeClient] Found video via direct lookup`);
        // Transform the response to FunnelcakeVideoRaw format
        const event = response.event;
        const stats = response.stats;

        // Extract data from tags
        const getTag = (name: string) => event.tags.find(t => t[0] === name)?.[1];
        const getImeta = () => {
          const imetaTag = event.tags.find(t => t[0] === 'imeta');
          if (!imetaTag) return {};
          const imeta: Record<string, string> = {};
          for (let i = 1; i < imetaTag.length; i++) {
            const parts = imetaTag[i].split(' ');
            if (parts.length >= 2) {
              imeta[parts[0]] = parts.slice(1).join(' ');
            }
          }
          return imeta;
        };
        const imeta = getImeta();

        return {
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          kind: event.kind,
          d_tag: getTag('d') || '',
          title: getTag('title'),
          content: event.content,
          thumbnail: imeta.image,
          video_url: imeta.url || '',
          author_name: getTag('author'),
          reactions: stats.reactions,
          comments: stats.comments,
          reposts: stats.reposts,
          engagement_score: stats.engagement_score,
          trending_score: stats.trending_score,
          loops: stats.embedded_loops || parseInt(getTag('loops') || '0') || null,
        };
      }
    } catch {
      debugLog(`[FunnelcakeClient] Direct lookup failed, trying fallbacks`);
    }

    // If we have pubkey, try fetching user's videos
    if (pubkey) {
      const response = await fetchUserVideos(apiUrl, pubkey, {
        limit: 50,
        signal,
      });

      const video = response.videos.find(
        v => v.id === identifier || v.d_tag === identifier
      );

      if (video) {
        debugLog(`[FunnelcakeClient] Found video via user videos`);
        return video;
      }
    }

    debugLog(`[FunnelcakeClient] Video not found: ${identifier}`);
    return null;
  } catch (err) {
    debugError(`[FunnelcakeClient] fetchVideoById error:`, err);
    return null;
  }
}

/**
 * Convert raw Funnelcake video to a format with hex IDs
 * Utility for use in transformation layer
 */
export function normalizeVideoIds(video: FunnelcakeVideoRaw): FunnelcakeVideoRaw & { id: string; pubkey: string } {
  return {
    ...video,
    id: Array.isArray(video.id) ? parseByteArrayId(video.id as unknown as number[]) : video.id as unknown as string,
    pubkey: Array.isArray(video.pubkey) ? parseByteArrayId(video.pubkey as unknown as number[]) : video.pubkey as unknown as string,
  } as FunnelcakeVideoRaw & { id: string; pubkey: string };
}

/**
 * Raw API response from /api/users/{pubkey} endpoint
 */
interface FunnelcakeUserResponse {
  pubkey: string;
  profile: {
    name?: string;
    display_name?: string;
    picture?: string;
    banner?: string;
    about?: string;
    nip05?: string;
    lud16?: string;
    website?: string;
  } | null;
  social: {
    follower_count: number;
    following_count: number;
  };
  stats: {
    video_count: number;
  };
  engagement: {
    total_reactions: number;
  };
}

/**
 * Flattened profile data for easy consumption
 */
export interface FunnelcakeProfile {
  pubkey: string;
  name?: string;
  display_name?: string;
  picture?: string;
  banner?: string;
  about?: string;
  nip05?: string;
  lud16?: string;
  website?: string;
  // Stats
  video_count?: number;
  follower_count?: number;
  following_count?: number;
  total_loops?: number;
  total_reactions?: number;
}

/**
 * Fetch user profile data from Funnelcake /api/users/{pubkey} endpoint
 * This is the dedicated profile endpoint that returns user metadata and stats
 *
 * @param apiUrl - Base URL of the Funnelcake API
 * @param pubkey - User's public key (hex)
 * @param signal - Optional abort signal
 * @returns Promise with profile data or null if not found
 */
export async function fetchUserProfile(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  pubkey: string,
  signal?: AbortSignal
): Promise<FunnelcakeProfile | null> {
  debugLog(`[FunnelcakeClient] fetchUserProfile: ${pubkey}`);

  const endpoint = API_CONFIG.funnelcake.endpoints.userProfile.replace('{pubkey}', pubkey);

  try {
    const response = await funnelcakeRequest<FunnelcakeUserResponse>(
      apiUrl,
      endpoint,
      {},
      signal
    );

    // Flatten the nested response into FunnelcakeProfile
    const profile: FunnelcakeProfile = {
      pubkey: response.pubkey,
      // Profile fields (may be null)
      name: response.profile?.name,
      display_name: response.profile?.display_name,
      picture: response.profile?.picture,
      banner: response.profile?.banner,
      about: response.profile?.about,
      nip05: response.profile?.nip05,
      lud16: response.profile?.lud16,
      website: response.profile?.website,
      // Stats
      video_count: response.stats?.video_count,
      follower_count: response.social?.follower_count,
      following_count: response.social?.following_count,
      total_reactions: response.engagement?.total_reactions,
    };

    debugLog(`[FunnelcakeClient] Got profile:`, profile);
    return profile;
  } catch (err) {
    debugLog(`[FunnelcakeClient] Profile fetch failed:`, err);
    return null;
  }
}

/**
 * Response from POST /api/users/bulk endpoint
 */
export interface FunnelcakeBulkUsersResponse {
  users: Array<{
    pubkey: string;
    profile?: {
      name?: string;
      display_name?: string;
      picture?: string;
      banner?: string;
      about?: string;
      nip05?: string;
      lud16?: string;
      website?: string;
    };
    social?: {
      follower_count: number;
      following_count: number;
    };
    stats?: {
      video_count: number;
    };
  }>;
  missing: string[];
}

/**
 * Response from POST /api/videos/stats/bulk endpoint
 */
export interface FunnelcakeBulkStatsResponse {
  stats: Array<{
    id: string;
    reactions: number;
    comments: number;
    reposts: number;
    loops?: number;
    engagement_score?: number;
    trending_score?: number;
  }>;
  missing: string[];
}

/**
 * Fetch multiple user profiles in bulk via POST /api/users/bulk
 * Much more efficient than individual requests for feeds and lists
 *
 * @param apiUrl - Base URL of the Funnelcake API
 * @param pubkeys - Array of user public keys (hex)
 * @param signal - Optional abort signal
 * @returns Promise with users array and missing pubkeys
 */
export async function fetchBulkUsers(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  pubkeys: string[],
  signal?: AbortSignal
): Promise<FunnelcakeBulkUsersResponse> {
  // Return early for empty input
  if (pubkeys.length === 0) {
    return { users: [], missing: [] };
  }

  debugLog(`[FunnelcakeClient] fetchBulkUsers: ${pubkeys.length} pubkeys`);

  const timeout = API_CONFIG.funnelcake.timeout;
  const timeoutSignal = AbortSignal.timeout(timeout);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetch(`${apiUrl}/api/users/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkeys }),
      signal: combinedSignal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      recordFunnelcakeFailure(apiUrl, `HTTP ${response.status}`);
      throw new FunnelcakeApiError(
        `Funnelcake bulk users error: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data = await response.json();
    recordFunnelcakeSuccess(apiUrl);

    debugLog(`[FunnelcakeClient] Got ${data.users?.length || 0} users, ${data.missing?.length || 0} missing`);

    return {
      users: data.users || [],
      missing: data.missing || [],
    };
  } catch (err) {
    if (err instanceof FunnelcakeApiError) {
      throw err;
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    recordFunnelcakeFailure(apiUrl, message);
    debugError(`[FunnelcakeClient] fetchBulkUsers failed: ${message}`);
    throw new FunnelcakeApiError(message, null, undefined);
  }
}

/**
 * Fetch statistics for multiple videos in bulk via POST /api/videos/stats/bulk
 * Much more efficient than individual fetchVideoStats calls
 *
 * @param apiUrl - Base URL of the Funnelcake API
 * @param eventIds - Array of video event IDs (hex)
 * @param signal - Optional abort signal
 * @returns Promise with stats array and missing event IDs
 */
export async function fetchBulkVideoStats(
  apiUrl: string = API_CONFIG.funnelcake.baseUrl,
  eventIds: string[],
  signal?: AbortSignal
): Promise<FunnelcakeBulkStatsResponse> {
  // Return early for empty input
  if (eventIds.length === 0) {
    return { stats: [], missing: [] };
  }

  debugLog(`[FunnelcakeClient] fetchBulkVideoStats: ${eventIds.length} event IDs`);

  const timeout = API_CONFIG.funnelcake.timeout;
  const timeoutSignal = AbortSignal.timeout(timeout);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetch(`${apiUrl}/api/videos/stats/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_ids: eventIds }),
      signal: combinedSignal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      recordFunnelcakeFailure(apiUrl, `HTTP ${response.status}`);
      throw new FunnelcakeApiError(
        `Funnelcake bulk stats error: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data = await response.json();
    recordFunnelcakeSuccess(apiUrl);

    debugLog(`[FunnelcakeClient] Got ${data.stats?.length || 0} stats, ${data.missing?.length || 0} missing`);

    return {
      stats: data.stats || [],
      missing: data.missing || [],
    };
  } catch (err) {
    if (err instanceof FunnelcakeApiError) {
      throw err;
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    recordFunnelcakeFailure(apiUrl, message);
    debugError(`[FunnelcakeClient] fetchBulkVideoStats failed: ${message}`);
    throw new FunnelcakeApiError(message, null, undefined);
  }
}
