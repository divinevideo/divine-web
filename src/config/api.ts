// ABOUTME: API configuration for external services
// ABOUTME: Centralized settings for Funnelcake and other REST APIs

export const FUNNELCAKE_PRODUCTION_API_URL = 'https://api.divine.video';
export const FUNNELCAKE_STAGING_API_URL = 'https://api.staging.divine.video';
export const NOTIFICATIONS_PRODUCTION_API_URL = 'https://relay.divine.video';
export const NOTIFICATIONS_STAGING_API_URL = 'https://relay.staging.divine.video';
export const FUNNELCAKE_API_MODE_OVERRIDE_KEY = 'divine_dev_funnelcake_api_mode';

export type FunnelcakeApiMode = 'auto' | 'production' | 'staging';

interface ResolveFunnelcakeBaseUrlOptions {
  mode?: FunnelcakeApiMode;
  hostname?: string;
  envBaseUrl?: string;
}

function getCurrentHostname(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.hostname;
}

function getSafeLocalStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storage = window.localStorage;
  if (!storage) {
    return null;
  }

  return (
    typeof storage.getItem === 'function'
    && typeof storage.setItem === 'function'
    && typeof storage.removeItem === 'function'
  )
    ? storage
    : null;
}

function resolveAutoFunnelcakeBaseUrl(hostname: string, envBaseUrl?: string): string {
  if (hostname === 'staging.divine.video' || hostname.endsWith('.staging.divine.video')) {
    return FUNNELCAKE_STAGING_API_URL;
  }

  if (envBaseUrl && hostname !== 'divine.video' && hostname !== 'www.divine.video') {
    return envBaseUrl;
  }

  return FUNNELCAKE_PRODUCTION_API_URL;
}

function mapNotificationsBaseUrl(baseUrl: string): string {
  switch (baseUrl) {
    case FUNNELCAKE_PRODUCTION_API_URL:
      return NOTIFICATIONS_PRODUCTION_API_URL;
    case FUNNELCAKE_STAGING_API_URL:
      return NOTIFICATIONS_STAGING_API_URL;
    default:
      return baseUrl;
  }
}

function resolveAutoNotificationsBaseUrl(hostname: string, envBaseUrl?: string): string {
  if (hostname === 'staging.divine.video' || hostname.endsWith('.staging.divine.video')) {
    return NOTIFICATIONS_STAGING_API_URL;
  }

  if (envBaseUrl && hostname !== 'divine.video' && hostname !== 'www.divine.video') {
    return mapNotificationsBaseUrl(envBaseUrl);
  }

  return NOTIFICATIONS_PRODUCTION_API_URL;
}

export function resolveFunnelcakeBaseUrl(options: ResolveFunnelcakeBaseUrlOptions = {}): string {
  const mode = options.mode ?? 'auto';
  const hostname = options.hostname ?? getCurrentHostname();
  const envBaseUrl = options.envBaseUrl;

  switch (mode) {
    case 'production':
      return FUNNELCAKE_PRODUCTION_API_URL;
    case 'staging':
      return FUNNELCAKE_STAGING_API_URL;
    case 'auto':
    default:
      return resolveAutoFunnelcakeBaseUrl(hostname, envBaseUrl);
  }
}

export function resolveNotificationsBaseUrl(
  options: ResolveFunnelcakeBaseUrlOptions = {},
): string {
  const mode = options.mode ?? 'auto';
  const hostname = options.hostname ?? getCurrentHostname();
  const envBaseUrl = options.envBaseUrl;

  switch (mode) {
    case 'production':
      return NOTIFICATIONS_PRODUCTION_API_URL;
    case 'staging':
      return NOTIFICATIONS_STAGING_API_URL;
    case 'auto':
    default:
      return resolveAutoNotificationsBaseUrl(hostname, envBaseUrl);
  }
}

export function getFunnelcakeApiModeOverride(): FunnelcakeApiMode {
  const storage = getSafeLocalStorage();
  const stored = storage?.getItem(FUNNELCAKE_API_MODE_OVERRIDE_KEY);
  if (stored === 'production' || stored === 'staging' || stored === 'auto') {
    return stored;
  }

  return 'auto';
}

export function setFunnelcakeApiModeOverride(mode: FunnelcakeApiMode): void {
  const storage = getSafeLocalStorage();
  storage?.setItem(FUNNELCAKE_API_MODE_OVERRIDE_KEY, mode);
}

export function clearFunnelcakeApiModeOverride(): void {
  const storage = getSafeLocalStorage();
  storage?.removeItem(FUNNELCAKE_API_MODE_OVERRIDE_KEY);
}

export function getFunnelcakeBaseUrl(): string {
  return resolveFunnelcakeBaseUrl({
    mode: getFunnelcakeApiModeOverride(),
    hostname: getCurrentHostname(),
    envBaseUrl: import.meta.env.VITE_FUNNELCAKE_API_URL,
  });
}

export function getNotificationsBaseUrl(): string {
  return resolveNotificationsBaseUrl({
    mode: getFunnelcakeApiModeOverride(),
    hostname: getCurrentHostname(),
    envBaseUrl: import.meta.env.VITE_FUNNELCAKE_API_URL,
  });
}

/**
 * API configuration for Funnelcake REST endpoints
 *
 * Funnelcake provides pre-computed trending scores and efficient video queries.
 * REST reads go through the Fastly-cached api.divine.video endpoint.
 * WebSocket connections still use relay.divine.video directly.
 */
export const API_CONFIG = {
  funnelcake: {
    get baseUrl() {
      return getFunnelcakeBaseUrl();
    },
    // Request timeout in milliseconds (profile API should be fast)
    timeout: 5000,
    // Endpoints
    endpoints: {
      videos: '/api/videos',
      search: '/api/search',
      searchProfiles: '/api/search/profiles',
      userProfile: '/api/users/{pubkey}',
      userVideos: '/api/users/{pubkey}/videos',
      userFeed: '/api/users/{pubkey}/feed',
      userSocial: '/api/users/{pubkey}/social',
      userFollowers: '/api/users/{pubkey}/followers',
      userFollowing: '/api/users/{pubkey}/following',
      userRecommendations: '/api/users/{pubkey}/recommendations',
      videoStats: '/api/videos/{eventId}/stats',
      bulkUsers: '/api/users/bulk',
      bulkVideoStats: '/api/videos/stats/bulk',
      hashtags: '/api/hashtags',
      trendingHashtags: '/api/hashtags/trending',
      categories: '/api/categories',
      stats: '/api/stats',
      viners: '/api/viners',
      health: '/api/health',
      leaderboardCreators: '/api/leaderboard/creators',
      userNotifications: '/api/users/{pubkey}/notifications',
      userNotificationsRead: '/api/users/{pubkey}/notifications/read',
      // RSS feed endpoints
      feedLatest: '/feed/latest',
      feedTrending: '/feed/trending',
      feedUserVideos: '/feed/{npub}/videos',
      feedUserFeed: '/feed/{npub}/feed',
      feedHashtag: '/feed/tag/{hashtag}',
      feedCategory: '/feed/category/{category}',
    },
  },

  verificationService: {
    baseUrl: import.meta.env.VITE_VERIFICATION_SERVICE_URL || 'https://verifyer.divine.video',
    timeout: 10000,
    endpoints: {
      verify: '/api/verify',
    },
  },

  moderationService: {
    baseUrl: import.meta.env.VITE_MODERATION_SERVICE_URL || '',
    timeout: 10000,
    endpoints: {
      checkResult: '/api/moderation/check-result/{sha256}',
    },
  },

  // Feature flags (can be overridden via localStorage for debugging)
  features: {
    // Use Funnelcake API when available (default: true)
    useFunnelcake: true,
    // Enable debug logging for API calls
    debugApi: false,
    // Use external verification service for identity proofs
    useVerificationService: true,
  },
} as const;

/**
 * Get a feature flag value, checking localStorage for overrides
 */
export function getFeatureFlag(flag: keyof typeof API_CONFIG.features): boolean {
  // Check localStorage for override
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem(`divine_feature_${flag}`);
    if (override !== null) {
      return override === 'true';
    }
  }
  return API_CONFIG.features[flag];
}

/**
 * Set a feature flag override in localStorage
 */
export function setFeatureFlag(flag: keyof typeof API_CONFIG.features, value: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`divine_feature_${flag}`, String(value));
  }
}

/**
 * Clear a feature flag override (use default value)
 */
export function clearFeatureFlag(flag: keyof typeof API_CONFIG.features): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(`divine_feature_${flag}`);
  }
}
