// ABOUTME: Centralized sort mode definitions for NIP-50 search
// ABOUTME: Single source of truth for sort modes across all pages

import { Flame, TrendUp as TrendingUp, Lightning as Zap, Clock, MagnifyingGlass as Search, FilmSlate as Clapperboard } from '@phosphor-icons/react';
import type { Icon as LucideIcon } from '@phosphor-icons/react';
import type { SortMode } from '@/types/nostr';
import type { FunnelcakePeriod } from '@/types/funnelcake';

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
    label: 'Top',
    description: 'Most viewed all-time',
    icon: TrendingUp
  },
  {
    value: 'rising',
    label: 'Rising',
    description: 'Gaining traction',
    icon: Zap
  },
  {
    value: 'classic',
    label: 'Classic',
    description: 'Vine archive favorites',
    icon: Clapperboard
  },
  {
    value: undefined,
    label: 'Recent',
    description: 'Latest videos',
    icon: Clock
  }
];

/**
 * Extended sort modes including popular
 * Used in: TrendingPage, HashtagPage
 */
export const EXTENDED_SORT_MODES: SortModeDefinition[] = [
  { value: 'hot',     label: 'Hot',     description: 'Recent + high engagement', icon: Flame },
  { value: undefined, label: 'New',     description: 'Latest videos',           icon: Clock },
  { value: 'top',     label: 'Top',     description: 'Most viewed all-time',    icon: TrendingUp },
  { value: 'rising',  label: 'Rising',  description: 'Gaining traction',        icon: Zap },
  { value: 'popular', label: 'Popular', description: 'Trending in this window', icon: TrendingUp },
  { value: 'classic', label: 'Classic', description: 'Vine archive favorites',  icon: Clapperboard },
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
    label: 'Top',
    description: 'Most viewed all-time',
    icon: TrendingUp
  },
  {
    value: 'rising',
    label: 'Rising',
    description: 'Gaining traction',
    icon: Zap
  },
  {
    value: 'classic',
    label: 'Classic',
    description: 'Vine archive favorites',
    icon: Clapperboard
  }
];

export interface PopularPeriodDefinition {
  value: FunnelcakePeriod;
  label: string;            // i18n key: trendingPage.popular.period.<value>
  shortLabel: string;       // for compact pills on mobile
}

export const POPULAR_PERIODS: PopularPeriodDefinition[] = [
  { value: 'now',   label: 'Now',        shortLabel: 'Now' },
  { value: 'today', label: 'Today',      shortLabel: 'Today' },
  { value: 'week',  label: 'This Week',  shortLabel: 'Week' },
  { value: 'month', label: 'This Month', shortLabel: 'Month' },
  { value: 'all',   label: 'All Time',   shortLabel: 'All' },
];
