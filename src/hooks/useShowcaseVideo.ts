// ABOUTME: Resolves a single video for the showcase share page, by vineId or event id
// ABOUTME: Applies the same safety floor as the reel — crafted links can't surface unsafe media

import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { getEventLookupRelayUrls } from '@/config/relays';
import { VIDEO_KINDS, type ParsedVideoData } from '@/types/video';
import { mapVideoEvent } from '@/lib/fetchListVideos';
import { enrichAgeRestrictedVideos } from '@/lib/ageRestrictedVideos';
import { filterShowcaseSafeVideos } from '@/lib/showcaseSafety';
import type { NostrFilter } from '@nostrify/nostrify';

const HEX_ID_RE = /^[0-9a-f]{64}$/i;

/**
 * Fetch one curated-safe video for the public share page.
 *
 * The id is usually a vineId (d tag) from a share URL, occasionally a raw event
 * id. Either way, the resolved video runs through the SAME safety floor as the
 * reel — a hand-crafted `/video/<id>` link must not be a way to surface an
 * age-gated or content-warned clip on the public site.
 */
export function useShowcaseVideo(id: string | undefined) {
  const { nostr } = useNostr();
  const { config } = useAppContext();
  const relayUrls = config.relayUrls || [config.relayUrl];

  return useQuery<ParsedVideoData | null>({
    queryKey: ['showcase-video', id, relayUrls.join(',')],
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async (context) => {
      if (!id) return null;
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(8000)]);
      const relays = getEventLookupRelayUrls({ configuredRelayUrls: relayUrls });

      const filters: NostrFilter[] = [{ kinds: VIDEO_KINDS, '#d': [id], limit: 5 }];
      if (HEX_ID_RE.test(id)) filters.push({ ids: [id] });

      const events = await nostr.query(filters, { signal, relays });
      if (events.length === 0) return null;

      // Prefer an exact vineId (d tag) match, then a direct event-id match,
      // else the newest candidate.
      const chosen =
        events.find(e => e.tags.some(t => t[0] === 'd' && t[1] === id)) ??
        events.find(e => e.id === id) ??
        [...events].sort((a, b) => b.created_at - a.created_at)[0];

      const video = mapVideoEvent(chosen);
      if (!video) return null;

      const [enriched] = await enrichAgeRestrictedVideos([video], signal);
      const [safe] = filterShowcaseSafeVideos([enriched]);
      return safe ?? null;
    },
  });
}
