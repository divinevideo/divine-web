// ABOUTME: Safety floor for the public showcase reel — drops anything not all-ages safe
// ABOUTME: Runs AFTER human curation, so a mis-curated entry still cannot reach the web

import type { NostrEvent } from '@nostrify/nostrify';
import type { ParsedVideoData } from '@/types/video';

/**
 * True if the event carries a content warning.
 *
 * Covers both conventions in use:
 * - NIP-36: a bare `["content-warning", "<reason>"]` tag set by the uploader.
 * - NIP-32 labels: `["L", "content-warning"]` / `["l", "<value>", "content-warning"]`
 *   as written by our moderation pipeline (see `src/lib/videoVerification.ts`).
 */
export function hasContentWarning(event: NostrEvent | undefined): boolean {
  if (!event?.tags) return false;

  return event.tags.some(tag => {
    const [name, value, namespace] = tag;
    if (name === 'content-warning') return true;
    if (name === 'L' && value === 'content-warning') return true;
    if (name === 'l' && namespace === 'content-warning') return true;
    return false;
  });
}

/**
 * Filter a curated set down to what is safe to show a general audience.
 *
 * This is deliberately redundant with human curation. The showcase is the one
 * surface where content reaches people who never opted into anything, so an
 * admin accidentally adding an age-gated video to a list must not be sufficient
 * to publish it. Curation decides what is *interesting*; this decides what is
 * *permissible*, and both have to agree.
 *
 * Drops:
 * - `ageRestricted` videos (the server-side flag, resolved via
 *   `enrichAgeRestrictedVideos` before this runs).
 * - Anything tagged with a content warning.
 * - Anything with no playable video URL.
 */
export function filterShowcaseSafeVideos(videos: ParsedVideoData[]): ParsedVideoData[] {
  return videos.filter(video => {
    if (video.ageRestricted === true) return false;
    if (hasContentWarning(video.originalEvent)) return false;
    if (!video.videoUrl) return false;
    return true;
  });
}
