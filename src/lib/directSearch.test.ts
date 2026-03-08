import { describe, expect, it } from 'vitest';
import { nip19 } from 'nostr-tools';
import { SHORT_VIDEO_KIND } from '@/types/video';
import {
  buildProfilePath,
  buildVideoPath,
  getDirectSearchTarget,
  isHexIdentifier,
  isLikelyOpaqueVideoIdentifier,
  normalizeDirectSearchInput,
} from './directSearch';

const pubkey = 'f'.repeat(64);
const eventId = 'e'.repeat(64);

describe('directSearch', () => {
  it('normalizes nostr URIs before parsing', () => {
    const npub = nip19.npubEncode(pubkey);

    expect(normalizeDirectSearchInput(` nostr:${npub} `)).toBe(npub);
    expect(normalizeDirectSearchInput(`web+nostr:${npub}`)).toBe(npub);
  });

  it('routes npub and nprofile inputs to profile pages', () => {
    const npub = nip19.npubEncode(pubkey);
    const nprofile = nip19.nprofileEncode({ pubkey });

    expect(getDirectSearchTarget(npub)).toEqual({
      path: buildProfilePath(npub),
      entity: 'profile',
    });
    expect(getDirectSearchTarget(nprofile)).toEqual({
      path: buildProfilePath(npub),
      entity: 'profile',
    });
  });

  it('routes note and nevent inputs to the video page', () => {
    const note = nip19.noteEncode(eventId);
    const nevent = nip19.neventEncode({ id: eventId, kind: SHORT_VIDEO_KIND, author: pubkey });

    expect(getDirectSearchTarget(note)).toEqual({
      path: buildVideoPath(eventId),
      entity: 'video',
    });
    expect(getDirectSearchTarget(nevent)).toEqual({
      path: buildVideoPath(eventId),
      entity: 'video',
    });
  });

  it('routes video naddr and raw coordinates to the video page', () => {
    const identifier = 'folder/video-123';
    const naddr = nip19.naddrEncode({
      identifier,
      pubkey,
      kind: SHORT_VIDEO_KIND,
    });
    const coordinate = `${SHORT_VIDEO_KIND}:${pubkey}:${identifier}`;

    expect(getDirectSearchTarget(naddr)).toEqual({
      path: buildVideoPath(identifier),
      entity: 'video',
    });
    expect(getDirectSearchTarget(coordinate)).toEqual({
      path: buildVideoPath(identifier),
      entity: 'video',
    });
  });

  it('ignores unsupported addressable event kinds', () => {
    const article = nip19.naddrEncode({
      identifier: 'post-123',
      pubkey,
      kind: 30023,
    });

    expect(getDirectSearchTarget(article)).toBeNull();
  });

  it('detects hex ids and opaque pasted d tags for async lookup', () => {
    expect(isHexIdentifier(eventId)).toBe(true);
    expect(isLikelyOpaqueVideoIdentifier(eventId)).toBe(true);
    expect(isLikelyOpaqueVideoIdentifier('video_tag_123')).toBe(false);
    expect(isLikelyOpaqueVideoIdentifier('video_tag_123', true)).toBe(true);
    expect(isLikelyOpaqueVideoIdentifier('normal search words')).toBe(false);
  });
});
