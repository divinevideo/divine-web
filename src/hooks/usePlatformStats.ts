// ABOUTME: Fetches high-level platform stats such as total and archived video counts
// ABOUTME: Used by marketing pages to display live aggregate numbers from Funnelcake

import { useQuery } from '@tanstack/react-query';
import { API_CONFIG } from '@/config/api';

export interface PlatformStats {
  total_events: number;
  total_videos: number;
  vine_videos: number;
}

async function fetchPlatformStats(signal?: AbortSignal): Promise<PlatformStats> {
  const response = await fetch(
    `${API_CONFIG.funnelcake.baseUrl}${API_CONFIG.funnelcake.endpoints.stats}`,
    {
      headers: {
        Accept: 'application/json',
      },
      signal,
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch platform stats');
  }

  return response.json() as Promise<PlatformStats>;
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: ({ signal }) => fetchPlatformStats(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}
