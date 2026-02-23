// ABOUTME: Enriches Funnelcake feed videos with ProofMode data via WebSocket
// ABOUTME: Queries relay for full events to extract verification tags missing from REST API

import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { ParsedVideoData } from '@/types/video';
import type { ProofModeData } from '@/types/video';
import { getProofModeData } from '@/lib/videoParser';
import { debugLog } from '@/lib/debug';

const BATCH_SIZE = 20;
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Hook that enriches videos with ProofMode data from WebSocket queries
 *
 * Feed videos from Funnelcake REST API don't include event tags,
 * so ProofMode data is always undefined. This hook fetches the full
 * events via WebSocket to extract verification tags.
 *
 * Returns the same videos array with proofMode populated where available.
 */
export function useProofModeEnrichment(videos: ParsedVideoData[]): ParsedVideoData[] {
  const { nostr } = useNostr();

  // Find videos that need enrichment (no proofMode and have an ID)
  const videosNeedingEnrichment = useMemo(
    () => videos.filter(v => !v.proofMode && v.id).slice(0, BATCH_SIZE),
    [videos]
  );

  const videoIds = useMemo(
    () => videosNeedingEnrichment.map(v => v.id),
    [videosNeedingEnrichment]
  );

  // Query relay for full events by ID
  const { data: proofModeMap } = useQuery<Map<string, ProofModeData>>({
    queryKey: ['proofmode-enrichment', ...videoIds],
    queryFn: async ({ signal }) => {
      if (videoIds.length === 0) return new Map();

      debugLog(`[ProofModeEnrichment] Fetching ${videoIds.length} events for ProofMode data`);

      const events = await nostr.query(
        [{ ids: videoIds, limit: BATCH_SIZE }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) },
      );

      debugLog(`[ProofModeEnrichment] Got ${events.length} events`);

      const map = new Map<string, ProofModeData>();
      for (const event of events) {
        const proofMode = getProofModeData(event);
        if (proofMode) {
          map.set(event.id, proofMode);
        }
      }

      debugLog(`[ProofModeEnrichment] Found ${map.size} videos with ProofMode data`);
      return map;
    },
    enabled: videoIds.length > 0,
    staleTime: STALE_TIME,
    gcTime: STALE_TIME * 2,
  });

  // Merge ProofMode data into videos
  return useMemo(() => {
    if (!proofModeMap || proofModeMap.size === 0) return videos;

    return videos.map(video => {
      if (video.proofMode) return video; // Already has data
      const proofMode = proofModeMap.get(video.id);
      if (!proofMode) return video;
      return { ...video, proofMode };
    });
  }, [videos, proofModeMap]);
}
