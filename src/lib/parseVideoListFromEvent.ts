// ABOUTME: Pure parser for NIP-51 kind 30005 video list events into app VideoList shape

import type { NostrEvent } from '@nostrify/nostrify';
import { VIDEO_KINDS } from '@/types/video';

export type PlayOrder = 'chronological' | 'reverse' | 'manual' | 'shuffle';
type VideoListMemberBase = { value: string; sourceTag?: string[] };
export type VideoListMember =
  | ({ type: 'e' } & VideoListMemberBase)
  | ({ type: 'a' } & VideoListMemberBase);

export const LIST_VIDEO_KINDS = [34235, ...VIDEO_KINDS];

const HEX_EVENT_ID_RE = /^[0-9a-f]{64}$/i;

export interface VideoList {
  id: string;
  name: string;
  description?: string;
  image?: string;
  pubkey: string;
  createdAt: number;
  members: VideoListMember[];
  memberCount: number;
  videoCoordinates: string[];
  public: boolean;
  tags?: string[];
  isCollaborative?: boolean;
  allowedCollaborators?: string[];
  thumbnailEventId?: string;
  playOrder?: PlayOrder;
  sourceTags: string[][];
}

export function videoListAddress(list: VideoList): string {
  return `${list.pubkey}:30005:${list.id}`;
}

function isVideoEventId(value: string): boolean {
  return HEX_EVENT_ID_RE.test(value);
}

export function isVideoCoordinate(value: string): boolean {
  return LIST_VIDEO_KINDS.some(kind => value.startsWith(`${kind}:`));
}

export function videoListMemberToTag(member: VideoListMember): string[] {
  if (member.sourceTag) return [...member.sourceTag];
  return [member.type, member.value];
}

export function videoListMemberKey(member: VideoListMember): string {
  return `${member.type}:${member.value}`;
}

export function memberMatchesCoordinate(member: VideoListMember, coordinate: string): boolean {
  return member.type === 'a' && member.value === coordinate;
}

export function memberMatchesVideoId(member: VideoListMember, videoId: string, videoEventId?: string): boolean {
  if (member.type === 'e') {
    return !!videoEventId && member.value === videoEventId.toLowerCase();
  }

  const firstSeparator = member.value.indexOf(':');
  const secondSeparator = member.value.indexOf(':', firstSeparator + 1);
  if (firstSeparator < 0 || secondSeparator < 0) return false;

  return member.value.slice(secondSeparator + 1) === videoId;
}

/**
 * Parse a video list event (kind 30005) into a VideoList, or null if invalid.
 */
export function parseVideoListFromEvent(event: NostrEvent): VideoList | null {
  const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
  if (!dTag) return null;

  const title = event.tags.find(tag => tag[0] === 'title')?.[1] || dTag;
  const description = event.tags.find(tag => tag[0] === 'description')?.[1];
  const image = event.tags.find(tag => tag[0] === 'image')?.[1];

  const members: VideoListMember[] = event.tags.flatMap((tag): VideoListMember[] => {
    if (!tag[1]) return [];
    if (tag[0] === 'e' && isVideoEventId(tag[1])) {
      const value = tag[1].toLowerCase();
      return [{ type: 'e', value, sourceTag: [tag[0], value, ...tag.slice(2)] }];
    }
    if (tag[0] === 'a' && isVideoCoordinate(tag[1])) {
      return [{ type: 'a', value: tag[1], sourceTag: [...tag] }];
    }
    return [];
  });

  const videoCoordinates = members
    .filter((member): member is Extract<VideoListMember, { type: 'a' }> => member.type === 'a')
    .map(member => member.value);

  const tags = event.tags
    .filter(tag => tag[0] === 't')
    .map(tag => tag[1]!);

  const isCollaborative = event.tags.find(tag => tag[0] === 'collaborative')?.[1] === 'true';
  const allowedCollaborators = event.tags
    .filter(tag => tag[0] === 'collaborator')
    .map(tag => tag[1]!);

  const thumbnailEventId =
    event.tags.find(tag => tag[0] === 'thumbnail')?.[1] ??
    event.tags.find(tag => tag[0] === 'thumbnail-event')?.[1];

  const playOrderTag =
    event.tags.find(tag => tag[0] === 'playorder')?.[1] ??
    event.tags.find(tag => tag[0] === 'play-order')?.[1];
  const playOrder: PlayOrder =
    playOrderTag === 'reverse' || playOrderTag === 'manual' || playOrderTag === 'shuffle'
      ? playOrderTag
      : 'chronological';

  return {
    id: dTag,
    name: title,
    description,
    image,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    members,
    memberCount: members.length,
    videoCoordinates,
    public: true,
    tags,
    isCollaborative,
    allowedCollaborators,
    thumbnailEventId,
    playOrder,
    sourceTags: event.tags.map(tag => [...tag]),
  };
}

export function deduplicateVideoLists(events: NostrEvent[]): VideoList[] {
  const newestByAddress = new Map<string, VideoList>();

  events
    .map(parseVideoListFromEvent)
    .filter((list): list is VideoList => list !== null)
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((list) => {
      const address = videoListAddress(list);
      if (!newestByAddress.has(address)) {
        newestByAddress.set(address, list);
      }
    });

  return Array.from(newestByAddress.values());
}
