// ABOUTME: Hook reporting whether Funnelcake RSS feed endpoints are configured
// ABOUTME: Uses the configured origin without probing the feed over the network

import { API_CONFIG } from '@/config/api';

export function useRssFeedAvailable(enabled: boolean = true): boolean {
  return enabled && Boolean(API_CONFIG.funnelcake.baseUrl);
}
