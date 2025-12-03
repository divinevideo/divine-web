// ABOUTME: Extended Nostr types for NIP-50 search and custom filter parameters
// ABOUTME: Supports full-text search with sort modes (hot, top, rising, controversial)

import type { NostrFilter } from '@nostrify/nostrify';

import { VIDEO_KINDS } from './video';

/**
 * NIP-50 search filter extension
 * Adds full-text search and advanced sorting capabilities
 */
export interface NIP50Filter extends NostrFilter {
  /**
   * NIP-50 search query
   * Can include text search and sort directives
   * Examples:
   * - "bitcoin" - Search for bitcoin in content
   * - "sort:hot" - Sort by recent + engagement
   * - "sort:top bitcoin" - Top bitcoin content
   */
  search?: string;
}

/**
 * Supported sort modes for NIP-50 queries
 *
 * - relevance: Default NIP-50 search ranking by content relevance (no sort directive)
 * - hot: Recent events with high engagement (recency + popularity)
 * - top: Most referenced events (all-time or within time range)
 * - rising: Recently created events gaining engagement quickly
 * - controversial: Events with mixed positive/negative reactions
 */
export type SortMode = 'hot' | 'top' | 'rising' | 'controversial';

/**
 * Pagination options for cursor-based queries
 */
export interface PaginationOptions {
  /** Number of items per page */
  limit: number;
  /** Cursor for next page (timestamp) */
  until?: number;
  /** Start time filter */
  since?: number;
}

/**
 * Video-specific query filter
 * Enforces video event kinds allowed for this project (34236).
 */
export interface VideoQuery extends NIP50Filter {
  kinds: typeof VIDEO_KINDS;
}

/**
 * Helper to create a search string with sort mode
 */
export function createSearchWithSort(sortMode: SortMode, searchTerm?: string): string {
  const parts = [`sort:${sortMode}`];
  if (searchTerm && searchTerm.trim()) {
    parts.push(searchTerm.trim());
  }
  return parts.join(' ');
}

/**
 * Helper to create a paginated filter
 */
export function createPaginatedFilter<T extends NostrFilter>(
  baseFilter: T,
  pagination: PaginationOptions
): T {
  return {
    ...baseFilter,
    limit: pagination.limit,
    until: pagination.until,
    since: pagination.since
  };
}
