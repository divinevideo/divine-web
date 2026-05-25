// ABOUTME: Probe hook that checks if Funnelcake RSS feed endpoints are available
// ABOUTME: Makes a single HEAD request to /feed/latest and caches the result

import { useQuery } from '@tanstack/react-query';
import { API_CONFIG } from '@/config/api';

async function probeFeedEndpoint(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(
      `${API_CONFIG.funnelcake.baseUrl}/feed/latest`,
      { method: 'HEAD', signal: controller.signal }
    );
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

export function useRssFeedAvailable(): boolean {
  const { data } = useQuery({
    queryKey: ['rss-feed-available'],
    queryFn: probeFeedEndpoint,
    staleTime: 5 * 60 * 1000,  // Re-check every 5 minutes
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
  return data ?? false;
}
