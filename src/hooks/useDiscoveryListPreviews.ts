// ABOUTME: Batches member-avatar + first-video-thumbnail fetches for the Discovery > Lists grid
// ABOUTME: Warms useAuthor cache for first 3 members per people list, queries kind 34236 for first video per video list

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent, NostrMetadata } from '@nostrify/nostrify';
import { useBatchedAuthors } from './useBatchedAuthors';
import { extractVideoMetadata } from '@/lib/videoParser';
import type { DiscoveryListItem } from './useDiscoveryLists';

const SHORT_VIDEO_KIND = 34236;
const PREVIEW_MEMBERS_PER_LIST = 3;

export interface DiscoveryListPreviews {
  getMemberMetadata: (pubkey: string) => NostrMetadata | undefined;
  getVideoThumbnail: (listPubkey: string, listId: string) => string | undefined;
}

interface FirstVideoCoord {
  listKey: string;
  author: string;
  dTag: string;
}

function parseFirstCoord(coord: string): { author: string; dTag: string } | null {
  const parts = coord.split(':');
  if (parts.length !== 3) return null;
  if (parts[0] !== String(SHORT_VIDEO_KIND)) return null;
  if (!parts[1] || !parts[2]) return null;
  return { author: parts[1], dTag: parts[2] };
}

export function useDiscoveryListPreviews(items: DiscoveryListItem[]): DiscoveryListPreviews {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();

  // Aggregate first N members across all people lists.
  const memberPubkeys = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.kind !== 30000) continue;
      for (const pk of it.list.members.slice(0, PREVIEW_MEMBERS_PER_LIST)) {
        set.add(pk);
      }
    }
    return Array.from(set);
  }, [items]);

  // Aggregate first video coordinate per video list.
  const firstVideoCoords = useMemo<FirstVideoCoord[]>(() => {
    const result: FirstVideoCoord[] = [];
    for (const it of items) {
      if (it.kind !== 30005) continue;
      const first = it.list.videoCoordinates[0];
      if (!first) continue;
      const parsed = parseFirstCoord(first);
      if (!parsed) continue;
      result.push({
        listKey: `${it.list.pubkey}:${it.list.id}`,
        author: parsed.author,
        dTag: parsed.dTag,
      });
    }
    return result;
  }, [items]);

  // Warm the per-author cache so PeopleListCard's downstream useAuthor calls hit cache.
  useBatchedAuthors(memberPubkeys);

  // Fetch first-video events for all video lists in one query, then map to thumbnails.
  const videoQuery = useQuery<Map<string, string>>({
    queryKey: [
      'discovery-list-first-videos',
      firstVideoCoords.map(c => `${c.author}:${c.dTag}`).sort().join(','),
    ],
    queryFn: async ({ signal }) => {
      if (firstVideoCoords.length === 0) return new Map();
      const authors = Array.from(new Set(firstVideoCoords.map(c => c.author)));
      const dTags = Array.from(new Set(firstVideoCoords.map(c => c.dTag)));
      const events = await nostr.query(
        [{ kinds: [SHORT_VIDEO_KIND], authors, '#d': dTags }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
      );

      // Index parsed thumbnails by `author:dTag`.
      const thumbByCoord = new Map<string, string>();
      for (const ev of events as NostrEvent[]) {
        const dTag = ev.tags.find(t => t[0] === 'd')?.[1];
        if (!dTag) continue;
        const meta = extractVideoMetadata(ev);
        if (meta?.thumbnailUrl) {
          thumbByCoord.set(`${ev.pubkey}:${dTag}`, meta.thumbnailUrl);
        }
      }

      // Map listKey -> thumbnail.
      const thumbsByListKey = new Map<string, string>();
      for (const c of firstVideoCoords) {
        const thumb = thumbByCoord.get(`${c.author}:${c.dTag}`);
        if (thumb) thumbsByListKey.set(c.listKey, thumb);
      }
      return thumbsByListKey;
    },
    enabled: firstVideoCoords.length > 0,
    staleTime: 300_000,
    gcTime: 600_000,
  });

  return {
    getMemberMetadata: (pubkey: string) => {
      return queryClient.getQueryData<{ metadata?: NostrMetadata }>(['author', pubkey])?.metadata;
    },
    getVideoThumbnail: (listPubkey: string, listId: string) => {
      return videoQuery.data?.get(`${listPubkey}:${listId}`);
    },
  };
}
