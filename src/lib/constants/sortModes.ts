// ABOUTME: Centralized sort mode definitions for NIP-50 search
// ABOUTME: Single source of truth for sort modes across all pages

import { Flame, TrendingUp, Zap, Scale, Clock, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SortMode } from '@/types/nostr';

export interface SortModeDefinition {
  value: SortMode | undefined;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface SearchSortModeDefinition {
  value: SortMode | 'relevance';
  label: string;
  description?: string;
  icon: LucideIcon;
}

/**
 * Standard sort modes for video feeds
 * Used in: HomePage, TrendingPage, HashtagPage
 */
export const SORT_MODES: SortModeDefinition[] = [
  {
    value: 'hot',
    label: 'Hot',
    description: 'Recent + high engagement',
    icon: Flame
  },
  {
    value: 'top',
    label: 'Classic',
    description: 'Popular archived Vines',
    icon: TrendingUp
  },
  {
    value: 'rising',
    label: 'Rising',
    description: 'Gaining traction',
    icon: Zap
  },
  {
    value: undefined,
    label: 'Recent',
    description: 'Latest videos',
    icon: Clock
  }
];

/**
 * Extended sort modes including controversial
 * Used in: TrendingPage, HashtagPage
 */
export const EXTENDED_SORT_MODES: SortModeDefinition[] = [
  {
    value: 'hot',
    label: 'Hot',
    description: 'Recent + high engagement',
    icon: Flame
  },
  {
    value: 'top',
    label: 'Classic',
    description: 'Popular archived Vines',
    icon: TrendingUp
  },
  {
    value: 'rising',
    label: 'Rising',
    description: 'Gaining traction',
    icon: Zap
  },
  {
    value: 'controversial',
    label: 'Controversial',
    description: 'Mixed reactions',
    icon: Scale
  }
];

/**
 * Search-specific sort modes including relevance
 * Used in: SearchPage
 */
/**
 * Sort modes for profile video feeds
 * Used in: ProfilePage
 */
export const PROFILE_SORT_MODES: SortModeDefinition[] = [
  {
    value: undefined,
    label: 'Recent',
    description: 'Latest videos',
    icon: Clock
  },
  {
    value: 'top',
    label: 'Most Loops',
    description: 'Highest loop count',
    icon: TrendingUp
  },
];

export const SEARCH_SORT_MODES: SearchSortModeDefinition[] = [
  {
    value: 'relevance',
    label: 'Relevance',
    description: 'Best match',
    icon: Search
  },
  {
    value: 'hot',
    label: 'Hot',
    description: 'Recent + high engagement',
    icon: Flame
  },
  {
    value: 'top',
    label: 'Classic',
    description: 'Popular archived Vines',
    icon: TrendingUp
  },
  {
    value: 'rising',
    label: 'Rising',
    description: 'Gaining traction',
    icon: Zap
  },
  {
    value: 'controversial',
    label: 'Controversial',
    description: 'Mixed reactions',
    icon: Scale
  }
];
