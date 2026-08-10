// ABOUTME: Pure NIP-25 (kind 7) tag construction for a like on an addressable video
// ABOUTME: Shared by the VideoPage and useOptimisticLike callsites so they cannot drift

import { SHORT_VIDEO_KIND } from '@/types/video';

interface VideoLikeTarget {
  /** Event id of the concrete video event being liked. */
  videoId: string;
  /** Video author's pubkey. */
  videoPubkey: string;
  /** The video's `d` tag, or null when it has none. */
  vineId: string | null;
}

/**
 * Build the NIP-25 tag array for a like on a video.
 *
 * The `a` coordinate is emitted whenever the video has a `d` tag to address it
 * by: the `e` id is superseded the first time the author edits, so an id-only
 * reaction is stranded, while the coordinate outlives the edit. Without a `d`
 * tag there is no valid coordinate and the reaction falls back to the id alone.
 *
 * Does not include kind/content/signature — tags only.
 */
export function buildVideoLikeTags({
  videoId,
  videoPubkey,
  vineId,
}: VideoLikeTarget): string[][] {
  return [
    ['e', videoId],
    ...(vineId ? [['a', `${SHORT_VIDEO_KIND}:${videoPubkey}:${vineId}`]] : []),
    ['p', videoPubkey],
    ['k', SHORT_VIDEO_KIND.toString()],
  ];
}
