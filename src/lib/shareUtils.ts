// ABOUTME: Pure utility functions for generating share URLs and share data
// ABOUTME: Single source of truth for all share link construction across the app

import { getApexShareUrl } from '@/lib/subdomainLinks';
import type { ParsedVideoData } from '@/types/video';

/** Build a shareable video URL (always apex domain, stable d-tag ID). */
export function getVideoShareUrl(video: ParsedVideoData): string {
  // Prefer vineId (d-tag) for stable URLs that survive edits
  const id = video.vineId || video.id;
  return getApexShareUrl(`/video/${id}`);
}

/** Build shareable data for a video (URL only — owner decision). */
export function getVideoShareData(video: ParsedVideoData): { url: string } {
  return {
    url: getVideoShareUrl(video),
  };
}

/** Build a shareable list URL (always apex domain). */
export function getListShareUrl(pubkey: string, listId: string): string {
  return getApexShareUrl(`/list/${pubkey}/${listId}`);
}

/** Build shareable data for a list (URL only — matches video share behavior). */
export function getListShareData(
  pubkey: string,
  listId: string,
): { url: string } {
  return {
    url: getListShareUrl(pubkey, listId),
  };
}
