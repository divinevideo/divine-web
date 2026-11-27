// ABOUTME: Hook reporting whether Funnelcake RSS feed endpoints are configured
// ABOUTME: RSS endpoints are live whenever Funnelcake API is configured; avoids uncached HEAD /feed/latest probes on every page load

import { API_CONFIG } from '@/config/api';

export function useRssFeedAvailable(enabled: boolean = true): boolean {
  return enabled && Boolean(API_CONFIG.funnelcake.baseUrl);
}
