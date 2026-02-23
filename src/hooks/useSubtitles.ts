// ABOUTME: Hook to fetch and parse subtitles for a video
// ABOUTME: Three-tier: embedded content > relay query for Kind 39307 > null

import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { parseVtt, type VttCue } from '@/lib/vttParser';
import type { ParsedVideoData } from '@/types/video';

interface UseSubtitlesResult {
  cues: VttCue[];
  hasSubtitles: boolean;
  isLoading: boolean;
}

/**
 * Parse a text-track ref coordinate string
 * Format: "39307:<pubkey>:subtitles:<d-tag>"
 */
function parseTextTrackRef(ref: string): { kind: number; pubkey: string; dTag: string } | null {
  const parts = ref.split(':');
  if (parts.length < 4) return null;
  const kind = parseInt(parts[0], 10);
  const pubkey = parts[1];
  // d-tag may contain colons, so rejoin remaining parts after pubkey:identifier
  const identifier = parts[2]; // e.g. "subtitles"
  const dTagParts = parts.slice(3);
  const dTag = `${identifier}:${dTagParts.join(':')}`;
  if (isNaN(kind) || !pubkey) return null;
  return { kind, pubkey, dTag };
}

export function useSubtitles(video: ParsedVideoData | null | undefined): UseSubtitlesResult {
  const { nostr } = useNostr();

  const hasEmbeddedContent = !!video?.textTrackContent;
  const hasRef = !!video?.textTrackRef;

  const { data: cues = [], isLoading } = useQuery({
    queryKey: ['subtitles', video?.id, video?.textTrackRef],
    queryFn: async ({ signal }) => {
      if (!video) return [];

      // Tier 1: Embedded VTT content from API
      if (video.textTrackContent) {
        return parseVtt(video.textTrackContent);
      }

      // Tier 2: Fetch from relay via text-track ref
      if (video.textTrackRef) {
        const coords = parseTextTrackRef(video.textTrackRef);
        if (!coords) return [];

        const events = await nostr.query([{
          kinds: [coords.kind],
          authors: [coords.pubkey],
          '#d': [coords.dTag],
          limit: 1,
        }], { signal: signal ?? AbortSignal.timeout(5000) });

        if (events.length > 0 && events[0].content) {
          return parseVtt(events[0].content);
        }
      }

      // Tier 3: No subtitles
      return [];
    },
    enabled: !!video && (hasEmbeddedContent || hasRef),
    staleTime: Infinity, // Subtitles are immutable
    gcTime: 30 * 60 * 1000, // Keep in cache 30 minutes
  });

  return {
    cues,
    hasSubtitles: cues.length > 0,
    isLoading: isLoading && (hasEmbeddedContent || hasRef),
  };
}
