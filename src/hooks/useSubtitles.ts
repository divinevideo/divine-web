// ABOUTME: Hook to fetch and parse subtitles for a video
// ABOUTME: Four-tier: embedded content > relay Kind 39307 > CDN VTT > null

import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { parseVtt, type VttCue } from '@/lib/vttParser';
import type { ParsedVideoData } from '@/types/video';
import { useAdultVerification } from '@/hooks/useAdultVerification';
import { isProtectedDivineMediaUrl } from '@/hooks/useAuthenticatedMediaUrl';

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

/**
 * Extract the content hash from a media.divine.video URL
 * URL patterns:
 *   https://media.divine.video/{hash}/downloads/default.mp4
 *   https://media.divine.video/{hash}/hls/master.m3u8
 *   https://media.divine.video/{hash}  (classic vines, no path suffix)
 */
function extractCdnHash(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl);
    if (!url.hostname.includes('media.divine.video')) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 1 && parts[0].length >= 16) {
      return parts[0];
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

/**
 * Fetch and parse subtitles for a video.
 *
 * Uses staleTime: Infinity so each video's subtitles are fetched at most once
 * and cached for the session. retry: false ensures 404s don't retry.
 */
export function useSubtitles(
  video: ParsedVideoData | null | undefined,
): UseSubtitlesResult {
  const { nostr } = useNostr();
  const { isVerified: isAdultVerified, getAuthHeader } = useAdultVerification();

  const hasEmbeddedContent = !!video?.textTrackContent;
  const hasRef = !!video?.textTrackRef;
  const cdnHash = video?.videoUrl ? extractCdnHash(video.videoUrl) : null;
  const requiresProtectedCdnAuth = !!video?.ageRestricted && !!video?.videoUrl && isProtectedDivineMediaUrl(video.videoUrl);
  // Only attempt subtitle fetch when video explicitly advertises text tracks.
  // This avoids blind CDN /vtt probes for videos that never declared subtitles.
  const queryEnabled = !!video && (hasEmbeddedContent || hasRef);

  const { data: cues = [], isLoading } = useQuery({
    queryKey: ['subtitles', video?.id, video?.textTrackRef, cdnHash, requiresProtectedCdnAuth, isAdultVerified],
    queryFn: async ({ signal }) => {
      if (!video) return [];

      // Tier 1: Embedded VTT content from API (zero cost)
      if (video.textTrackContent) {
        return parseVtt(video.textTrackContent);
      }

      // Tier 2: Fetch from relay via text-track ref
      if (video.textTrackRef) {
        const coords = parseTextTrackRef(video.textTrackRef);
        if (coords) {
          try {
            const events = await nostr.query([{
              kinds: [coords.kind],
              authors: [coords.pubkey],
              '#d': [coords.dTag],
              limit: 1,
            }], { signal: signal ?? AbortSignal.timeout(5000) });

            if (events.length > 0 && events[0].content) {
              const parsed = parseVtt(events[0].content);
              if (parsed.length > 0) return parsed;
            }
          } catch {
            // Fall through to CDN tier
          }
        }
      }

      // Tier 3: Fetch VTT from CDN (media.divine.video/{hash}/vtt)
      // only when a text-track ref exists. This remains a fallback path, not
      // a blind probe for all media blobs.
      if (cdnHash && video.textTrackRef) {
        try {
          const vttUrl = `https://media.divine.video/${cdnHash}/vtt`;
          const response = requiresProtectedCdnAuth
            ? await (async () => {
                const authHeader = await getAuthHeader(vttUrl, 'GET');
                if (!authHeader) {
                  return null;
                }

                return fetch(vttUrl, {
                  headers: { Authorization: authHeader },
                  signal,
                });
              })()
            : await fetch(vttUrl, { signal });

          if (!response) {
            return [];
          }

          // Optional subtitle assets can legitimately miss on CDN.
          if (response.status === 404 || response.status === 410 || response.status === 422) {
            return [];
          }

          if (response.ok) {
            const text = await response.text();
            if (text.trim().startsWith('WEBVTT')) {
              return parseVtt(text);
            }
          }
        } catch {
          // No VTT available from CDN
        }
      }

      // Tier 4: No subtitles
      return [];
    },
    enabled: queryEnabled,
    staleTime: Infinity, // Subtitles are immutable — never refetch
    gcTime: 30 * 60 * 1000, // Keep in cache 30 minutes
    retry: false, // Don't retry CDN 404s
  });

  return {
    cues,
    hasSubtitles: cues.length > 0,
    isLoading: isLoading && queryEnabled,
  };
}
