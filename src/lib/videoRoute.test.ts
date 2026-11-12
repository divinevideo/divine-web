import { describe, expect, it } from 'vitest';
import { SHORT_VIDEO_KIND } from '@/types/video';
import { buildAddressableVideoPath } from '@/lib/eventRouting';
import { matchesVideoRoute, parseVideoRouteId } from './videoRoute';

const AUTHOR = 'a'.repeat(64);
const OTHER_AUTHOR = 'b'.repeat(64);
const SHARED_D_TAG = 'c'.repeat(64);
const EVENT_ID = 'e'.repeat(64);

function video(overrides: { id?: string; pubkey?: string; vineId?: string | null }) {
  return { id: EVENT_ID, pubkey: AUTHOR, vineId: SHARED_D_TAG, ...overrides };
}

describe('parseVideoRouteId', () => {
  it('reads the author and d tag out of an addressable video route', () => {
    expect(parseVideoRouteId(`${SHORT_VIDEO_KIND}:${AUTHOR}:${SHARED_D_TAG}`)).toEqual({
      lookupId: SHARED_D_TAG,
      address: { kind: SHORT_VIDEO_KIND, pubkey: AUTHOR, dTag: SHARED_D_TAG },
    });
  });

  it('round-trips the path the route builder writes, including a d tag with separators', () => {
    const path = buildAddressableVideoPath(SHORT_VIDEO_KIND, AUTHOR, 'folder/clip:1');
    const routeId = decodeURIComponent(path.slice('/video/'.length));

    expect(parseVideoRouteId(routeId)).toEqual({
      lookupId: 'folder/clip:1',
      address: { kind: SHORT_VIDEO_KIND, pubkey: AUTHOR, dTag: 'folder/clip:1' },
    });
  });

  it('holds a route with an empty d tag to its author instead of looking the whole segment up', () => {
    // NIP-19 allows an naddr1 with an empty identifier. No valid video has an
    // empty d tag, so this must resolve to nothing, never to whichever video
    // carries the literal `kind:pubkey:` text as its d tag.
    expect(parseVideoRouteId(`${SHORT_VIDEO_KIND}:${AUTHOR}:`)).toEqual({
      lookupId: '',
      address: { kind: SHORT_VIDEO_KIND, pubkey: AUTHOR, dTag: '' },
    });
  });

  it('keeps a d tag that starts with a line break', () => {
    expect(parseVideoRouteId(`${SHORT_VIDEO_KIND}:${AUTHOR}:\nclip`).address?.dTag).toBe('\nclip');
  });

  it('lowercases an upper-case author so exact author checks still hold', () => {
    expect(parseVideoRouteId(`${SHORT_VIDEO_KIND}:${AUTHOR.toUpperCase()}:${SHARED_D_TAG}`).address?.pubkey).toBe(AUTHOR);
  });

  it.each([
    ['an event id', EVENT_ID],
    ['a bare d tag', SHARED_D_TAG],
    ['a legacy vine id', 'hBFP5LFKUOU'],
    ['a coordinate of a kind that is not a video', `30023:${AUTHOR}:post`],
    ['a coordinate whose author is not a hex pubkey', `${SHORT_VIDEO_KIND}:npub1abc:${SHARED_D_TAG}`],
  ])('keeps %s as a bare lookup id that names no author', (_label, routeId) => {
    expect(parseVideoRouteId(routeId)).toEqual({ lookupId: routeId, address: null });
  });
});

describe('matchesVideoRoute', () => {
  it('matches a bare id against the event id or the d tag, from any author', () => {
    expect(matchesVideoRoute(video({}), EVENT_ID)).toBe(true);
    expect(matchesVideoRoute(video({ pubkey: OTHER_AUTHOR }), SHARED_D_TAG)).toBe(true);
    expect(matchesVideoRoute(video({}), 'something-else')).toBe(false);
  });

  it('holds an author-named route to that author', () => {
    expect(matchesVideoRoute(video({}), SHARED_D_TAG, AUTHOR)).toBe(true);
    expect(matchesVideoRoute(video({ pubkey: OTHER_AUTHOR }), SHARED_D_TAG, AUTHOR)).toBe(false);
  });

  it('does not let an author-named route match by event id', () => {
    // A d tag is free text, so another video's d tag can equal this event id.
    expect(matchesVideoRoute(video({ id: SHARED_D_TAG, vineId: 'other' }), SHARED_D_TAG, AUTHOR)).toBe(false);
  });

  it('compares authors case-insensitively', () => {
    expect(matchesVideoRoute(video({ pubkey: AUTHOR.toUpperCase() }), SHARED_D_TAG, AUTHOR)).toBe(true);
  });
});
