import { describe, expect, it } from 'vitest';
import { nip19 } from 'nostr-tools';
import { SHORT_VIDEO_KIND } from '@/types/video';
import {
  buildAddressableEventPath,
  buildEventPath,
  buildListPath,
  buildVideoPath,
} from '@/lib/eventRouting';
import {
  buildProfilePath,
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

  it('routes note inputs to the event page and video nevents to the video page', () => {
    const note = nip19.noteEncode(eventId);
    const nevent = nip19.neventEncode({ id: eventId, kind: SHORT_VIDEO_KIND, author: pubkey });

    expect(getDirectSearchTarget(note)).toEqual({
      path: buildEventPath(eventId),
      entity: 'event',
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

  it('routes video lists and generic addressable events to useful paths', () => {
    const listId = 'spring-picks';
    const listNaddr = nip19.naddrEncode({
      identifier: listId,
      pubkey,
      kind: 30005,
    });
    const articleId = 'post-123';
    const article = nip19.naddrEncode({
      identifier: articleId,
      pubkey,
      kind: 30023,
      relays: ['wss://relay.example'],
    });

    expect(getDirectSearchTarget(listNaddr)).toEqual({
      path: buildListPath(pubkey, listId),
      entity: 'event',
    });
    expect(getDirectSearchTarget(article)).toEqual({
      path: `${buildAddressableEventPath(30023, pubkey, articleId)}?relays=${encodeURIComponent('wss://relay.example')}`,
      entity: 'event',
    });
  });

  it('routes vine clip urls to the video page', () => {
    expect(getDirectSearchTarget('https://vine.co/v/hBFP5LFKUOU')).toEqual({
      path: buildVideoPath('hBFP5LFKUOU'),
      entity: 'video',
    });
    expect(getDirectSearchTarget('hBFP5LFKUOU')).toBeNull();
    expect(getDirectSearchTarget('https://vine.co/v/hBFP5LFKUOU?foo=bar#section')).toEqual({
      path: buildVideoPath('hBFP5LFKUOU'),
      entity: 'video',
    });
    expect(getDirectSearchTarget('https://vine.co/v/hBFP5LFKUOU/extra')).toBeNull();
  });

  it('routes vine user urls to the universal user page', () => {
    expect(getDirectSearchTarget('https://vine.co/u/1080167736266633216')).toEqual({
      path: '/u/1080167736266633216',
      entity: 'profile',
    });
    expect(getDirectSearchTarget('1080167736266633216')).toEqual({
      path: '/u/1080167736266633216',
      entity: 'profile',
    });
    expect(getDirectSearchTarget('https://vine.co/u/1080167736266633216?foo=bar#section')).toEqual({
      path: '/u/1080167736266633216',
      entity: 'profile',
    });
    expect(getDirectSearchTarget('https://vine.co/u/1080167736266633216/extra')).toBeNull();
  });

  it('routes legacy vine profile urls to the universal user page', () => {
    expect(getDirectSearchTarget('https://vine.co/someuser')).toEqual({
      path: '/u/someuser',
      entity: 'profile',
    });
    expect(getDirectSearchTarget('https://vine.co/someuser?foo=bar#section')).toEqual({
      path: '/u/someuser',
      entity: 'profile',
    });
  });

  it('rejects reserved and nested vine paths', () => {
    expect(getDirectSearchTarget('https://vine.co/v')).toBeNull();
    expect(getDirectSearchTarget('https://vine.co/v/')).toBeNull();
    expect(getDirectSearchTarget('https://vine.co/u')).toBeNull();
    expect(getDirectSearchTarget('https://vine.co/u/')).toBeNull();
    expect(getDirectSearchTarget('https://vine.co/about')).toBeNull();
    expect(getDirectSearchTarget('https://vine.co/messages/compose')).toBeNull();
  });

  it('detects hex ids and opaque pasted d tags for async lookup', () => {
    expect(isHexIdentifier(eventId)).toBe(true);
    expect(isLikelyOpaqueVideoIdentifier(eventId)).toBe(true);
    expect(isLikelyOpaqueVideoIdentifier('video_tag_123')).toBe(false);
    expect(isLikelyOpaqueVideoIdentifier('video_tag_123', true)).toBe(true);
    expect(isLikelyOpaqueVideoIdentifier('normal search words')).toBe(false);
  });
});
