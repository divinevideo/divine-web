// ABOUTME: React Query hook to fetch categories from Funnelcake API
// ABOUTME: Merges API data (video counts) with static icon config

import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '@/lib/funnelcakeClient';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';
import { getCategoryConfig } from '@/lib/constants/categories';
import type { FunnelcakeCategory } from '@/types/funnelcake';
import type { CategoryConfig } from '@/lib/constants/categories';

export interface CategoryWithConfig extends FunnelcakeCategory {
  config: CategoryConfig;
}

export function useCategories() {
  return useQuery<CategoryWithConfig[]>({
    queryKey: ['categories'],
    queryFn: async ({ signal }) => {
      const categories = await fetchCategories(DEFAULT_FUNNELCAKE_URL, signal);
      // Only show categories with enough videos to be meaningful
      const MIN_VIDEO_COUNT = 5;
      return categories
        .filter(c => c.video_count >= MIN_VIDEO_COUNT)
        .map(c => ({
          ...c,
          config: getCategoryConfig(c.name),
        }))
        .sort((a, b) => b.video_count - a.video_count);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
