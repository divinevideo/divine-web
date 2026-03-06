// ABOUTME: Hook for searching user profiles via Funnelcake REST API
// ABOUTME: Fast, ranked results with follower/video counts and NIP-05 info

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useState, useEffect } from 'react';
import { searchProfiles, type FunnelcakeProfileResult } from '@/lib/funnelcakeClient';
import { API_CONFIG } from '@/config/api';
import { debugLog } from '@/lib/debug';
import { reportFunnelcakeFallback } from '@/lib/funnelcakeFallbackReporting';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import type { NostrMetadata, NostrEvent } from '@nostrify/nostrify';

interface UseSearchUsersOptions {
  query: string;
  limit?: number;
}

export interface SearchUserResult {
  pubkey: string;
  metadata?: NostrMetadata;
}

const FUNNELCAKE_PROFILE_SEARCH_TIMEOUT_MS = 500;

function normalizeSearchValue(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

function getNip05LocalPart(nip05?: string): string {
  const normalized = normalizeSearchValue(nip05);
  const atIndex = normalized.indexOf('@');
  return atIndex === -1 ? normalized : normalized.slice(0, atIndex);
}

function profileMatchesQuery(profile: FunnelcakeProfileResult, query: string): boolean {
  const searchValue = normalizeSearchValue(query);
  if (!searchValue) return true;

  return [
    profile.name,
    profile.display_name,
    profile.nip05,
    getNip05LocalPart(profile.nip05),
    profile.about,
  ].some(field => normalizeSearchValue(field).includes(searchValue));
}

function isSuspiciousProfile(profile: FunnelcakeProfileResult): boolean {
  const about = normalizeSearchValue(profile.about);
  const picture = normalizeSearchValue(profile.picture);

  return about.includes('<script') ||
    about.includes('javascript:') ||
    picture.includes('iplogger.');
}

function isLowSignalProfile(profile: FunnelcakeProfileResult): boolean {
  return profile.follower_count <= 0 &&
    profile.video_count <= 0 &&
    !normalizeSearchValue(profile.display_name) &&
    !normalizeSearchValue(profile.about) &&
    !normalizeSearchValue(profile.nip05) &&
    !normalizeSearchValue(profile.picture);
}

function getProfileSearchScore(profile: FunnelcakeProfileResult, query: string): number {
  const searchValue = normalizeSearchValue(query);
  const name = normalizeSearchValue(profile.name);
  const displayName = normalizeSearchValue(profile.display_name);
  const nip05 = normalizeSearchValue(profile.nip05);
  const nip05Local = getNip05LocalPart(profile.nip05);
  const about = normalizeSearchValue(profile.about);

  let score = 0;

  if (name === searchValue) score += 500;
  if (displayName === searchValue) score += 450;
  if (nip05Local === searchValue) score += 425;

  if (name.startsWith(searchValue)) score += 220;
  if (displayName.startsWith(searchValue)) score += 180;
  if (nip05Local.startsWith(searchValue)) score += 160;

  if (name.includes(searchValue)) score += 80;
  if (displayName.includes(searchValue)) score += 60;
  if (nip05.includes(searchValue)) score += 50;
  if (about.includes(searchValue)) score += 25;

  score += Math.min(profile.follower_count, 250);
  score += Math.min(profile.video_count * 8, 160);

  if (profile.nip05) score += 30;
  if (profile.picture) score += 20;
  if (profile.about) score += 10;
  if (profile.display_name) score += 10;

  if (isLowSignalProfile(profile)) score -= 150;

  return score;
}

/**
 * Convert Funnelcake profile result to SearchUserResult for compatibility
 */
function toSearchUserResult(profile: FunnelcakeProfileResult): SearchUserResult {
  return {
    pubkey: profile.pubkey,
    metadata: {
      name: profile.name,
      display_name: profile.display_name,
      nip05: profile.nip05 || undefined,
      about: profile.about || undefined,
      picture: profile.picture || undefined,
      banner: profile.banner || undefined,
    },
  };
}

/**
 * Parse kind:0 event into SearchUserResult
 */
function parseUserEvent(event: NostrEvent): SearchUserResult | null {
  try {
    const metadata = JSON.parse(event.content) as NostrMetadata;
    return { pubkey: event.pubkey, metadata };
  } catch {
    return null;
  }
}

/**
 * Proper debounce hook that returns a stable debounced value
 */
function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delay <= 0) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Search users via Funnelcake REST API (/api/search/profiles)
 * Falls back to NIP-50 WebSocket if Funnelcake fails
 */
export function useSearchUsers(options: UseSearchUsersOptions) {
  const { nostr } = useNostr();
  const { query, limit = 20 } = options;
  const apiUrl = API_CONFIG.funnelcake.baseUrl;

  const isTest = process.env.NODE_ENV === 'test';
  const debouncedQuery = useDebouncedValue(query, isTest ? 0 : 300);

  return useQuery({
    queryKey: ['search-users', debouncedQuery, limit],
    queryFn: async ({ signal }) => {
      if (!debouncedQuery.trim()) return [];

      // Try Funnelcake REST API first (fast, ranked)
      if (isFunnelcakeAvailable(apiUrl)) {
        try {
          const profiles = await searchProfiles(
            apiUrl,
            {
              query: debouncedQuery,
              limit,
              sortBy: 'relevance',
              signal: AbortSignal.any([signal, AbortSignal.timeout(FUNNELCAKE_PROFILE_SEARCH_TIMEOUT_MS)]),
            },
          );

          const rankedProfiles = profiles
            .filter(profile => profileMatchesQuery(profile, debouncedQuery))
            .filter(profile => !isSuspiciousProfile(profile))
            .sort((a, b) => getProfileSearchScore(b, debouncedQuery) - getProfileSearchScore(a, debouncedQuery));

          const preferredProfiles = rankedProfiles.filter(profile => !isLowSignalProfile(profile));
          const visibleProfiles = preferredProfiles.length >= Math.min(limit, 2)
            ? preferredProfiles
            : rankedProfiles;

          return visibleProfiles.slice(0, limit).map(toSearchUserResult);
        } catch (error) {
          debugLog('[useSearchUsers] Funnelcake profile search failed, falling back to NIP-50:', error);
          reportFunnelcakeFallback({
            source: 'useSearchUsers',
            apiUrl,
            reason: error instanceof Error ? error.message : String(error),
            dedupeKey: `useSearchUsers:${debouncedQuery}`,
            context: {
              query: debouncedQuery,
            },
          });
        }
      } else {
        reportFunnelcakeFallback({
          source: 'useSearchUsers',
          apiUrl,
          reason: 'Funnelcake unavailable or circuit breaker open',
          dedupeKey: `useSearchUsers:${debouncedQuery}:unavailable`,
          context: {
            query: debouncedQuery,
          },
        });
      }

      // Fallback: NIP-50 WebSocket search
      const events = await nostr.query(
        [{ kinds: [0], search: debouncedQuery, limit: Math.min(limit * 2, 100) }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) },
      );

      const seen = new Set<string>();
      const results: SearchUserResult[] = [];
      for (const event of events) {
        if (seen.has(event.pubkey)) continue;
        seen.add(event.pubkey);
        const parsed = parseUserEvent(event);
        if (parsed) results.push(parsed);
      }

      return results.slice(0, limit);
    },
    enabled: !!debouncedQuery.trim(),
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
