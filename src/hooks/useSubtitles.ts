// ABOUTME: Hook to fetch and parse subtitles for a video
// ABOUTME: Tiers: embedded content (or the newer caption file the video names) > relay Kind 39307 > CDN VTT > null

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

const CONTENT_HASH = /^[0-9a-f]{64}$/i;

/**
 * The SHA-256 an http(s) caption ref names its file by: the last path
 * segment minus any extension, e.g. https://media.divine.video/{sha256}.
 * Null for a ref that names no hash, such as a 39307 coordinate.
 */
function captionRefHash(ref: string): string | null {
  try {
    const url = new URL(ref);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const name = url.pathname.split('/').pop()?.split('.')[0] ?? '';
    return CONTENT_HASH.test(name) ? name.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The caption file the video's ref names, when the embedded captions are not
 * that file; otherwise null.
 *
 * A subtitle save republishes the video with its new caption file before the
 * Kind 39307 event Funnelcake embeds from, so embedded captions that hash to
 * something else predate the video's own track. A ref that names no hash
 * cannot be checked and counts as matching.
 */
async function newerCaptionFileUrl(embedded: string, ref: string | undefined): Promise<string | null> {
  if (!ref) return null;
  const refHash = captionRefHash(ref);
  if (!refHash) return null;
  try {
    return (await sha256Hex(embedded)) === refHash ? null : ref;
  } catch {
    // No Web Crypto (insecure context): keep the embedded captions.
    return null;
  }
}

async function fetchVttFile(url: string, signal: AbortSignal): Promise<VttCue[]> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return [];
    const text = await response.text();
    return text.trim().startsWith('WEBVTT') ? parseVtt(text) : [];
  } catch {
    return [];
  }
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

      // Tier 1: Embedded VTT content from API (zero cost), unless the video
      // names a newer caption file; then that file, falling back to embedded.
      if (video.textTrackContent) {
        const newerFileUrl = await newerCaptionFileUrl(video.textTrackContent, video.textTrackRef);
        if (!newerFileUrl) {
          return parseVtt(video.textTrackContent);
        }

        const fromFile = await fetchVttFile(newerFileUrl, signal);
        if (fromFile.length > 0) return fromFile;

        const embedded = parseVtt(video.textTrackContent);
        if (embedded.length > 0) return embedded;
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
