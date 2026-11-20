// ABOUTME: Pure utility functions for generating share URLs and share data
// ABOUTME: Single source of truth for all share link construction across the app

import { naddrEncode, neventEncode } from 'nostr-tools/nip19';

import { getApexShareUrl } from '@/lib/subdomainLinks';
import { buildListPath, buildPeopleListPath } from '@/lib/eventRouting';
import type { ParsedVideoData } from '@/types/video';

export function getVideoShareUrl(video: ParsedVideoData): string {
  const kind = video.originalEvent?.kind ?? video.kind;
  const dTag = video.originalEvent
    ? video.originalEvent.tags.find(tag => tag[0] === 'd')?.[1]
    : video.vineId;
  if ([34235, 34236].includes(kind) && dTag && new TextEncoder().encode(dTag).length <= 255 && /^[0-9a-f]{64}$/i.test(video.pubkey)) {
    return getApexShareUrl(`/video/${naddrEncode({
      kind, pubkey: video.pubkey.toLowerCase(), identifier: dTag,
    })}`);
  }
  if (/^[0-9a-f]{64}$/i.test(video.id)) {
    return getApexShareUrl(`/video/${neventEncode({ id: video.id.toLowerCase() })}`);
  }
  return getApexShareUrl(`/video/${encodeURIComponent(video.vineId || video.id)}`);
}

/** Build shareable data for a video (URL only — owner decision). */
export function getVideoShareData(video: ParsedVideoData): { url: string } {
  return {
    url: getVideoShareUrl(video),
  };
}

/** Build a shareable list URL (always apex domain). */
export function getListShareUrl(pubkey: string, listId: string): string {
  return getApexShareUrl(buildListPath(pubkey, listId));
}

/** Build a shareable people-list URL (always apex domain). */
export function getPeopleListShareUrl(pubkey: string, listId: string): string {
  return getApexShareUrl(buildPeopleListPath(pubkey, listId));
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

/** Build shareable data for a people list (URL only — matches video share behavior). */
export function getPeopleListShareData(
  pubkey: string,
  listId: string,
): { url: string } {
  return {
    url: getPeopleListShareUrl(pubkey, listId),
  };
}
