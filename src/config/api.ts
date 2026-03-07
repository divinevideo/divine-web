// ABOUTME: API configuration for external services
// ABOUTME: Centralized settings for Funnelcake and other REST APIs

/**
 * API configuration for Funnelcake REST endpoints
 *
 * Funnelcake provides pre-computed trending scores and efficient video queries
 * via a REST API served from the same domain as Divine relays.
 *
 * Currently available at:
 * - relay.divine.video (live now)
 * - relay.divine.video (switching soon)
 */
export const API_CONFIG = {
  funnelcake: {
    // Default base URL - use relay.divine.video until relay.divine.video switches
    baseUrl: import.meta.env.VITE_FUNNELCAKE_API_URL || 'https://relay.divine.video',
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
