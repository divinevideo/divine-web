import { describe, expect, it } from 'vitest';
import { naddrEncode, neventEncode } from 'nostr-tools/nip19';
import { SHORT_VIDEO_KIND } from '@/types/video';
import { buildAddressableVideoPath } from '@/lib/eventRouting';
import { matchesVideoRoute, matchesVideoTarget, parseVideoRouteId } from './videoRoute';

const AUTHOR = 'a'.repeat(64);
const OTHER_AUTHOR = 'b'.repeat(64);
const SHARED_D_TAG = 'c'.repeat(64);
const EVENT_ID = 'e'.repeat(64);

function video(overrides: { id?: string; pubkey?: string; vineId?: string | null }) {
  return { id: EVENT_ID, pubkey: AUTHOR, vineId: SHARED_D_TAG, ...overrides };
}

describe('parseVideoRouteId', () => {
  it('reads a standard naddr produced by an independent client', () => {
    const reference = 'naddr1qq9kjup3v3jrjazpd3khwq3qsxktkuz8tw9hzhpc6pevaymknj3827parpueqyt7crqpa2zfh72sxpqqqzzmcqtynsu';
    expect(parseVideoRouteId(reference)).toEqual({
      lookupId: 'ip1dd9tAlmw', strictKind: true,
      address: { kind: 34236, pubkey: '81acbb70475b8b715c38d072ce93769ca275783d187990117ec0c01ea849bf95', dTag: 'ip1dd9tAlmw' },
    });
  });

  it('keeps the kind, author and arbitrary identifier in a standard address', () => {
    const reference = naddrEncode({ kind: 34235, pubkey: AUTHOR, identifier: 'folder/clip:1' });
    expect(parseVideoRouteId(reference, OTHER_AUTHOR)).toEqual({
      lookupId: 'folder/clip:1', strictKind: true,
      address: { kind: 34235, pubkey: AUTHOR, dTag: 'folder/clip:1' },
    });
  });

  it('reads nevent links as event IDs', () => {
    expect(parseVideoRouteId(neventEncode({ id: EVENT_ID }))).toEqual({ lookupId: EVENT_ID, eventId: EVENT_ID, address: null });
  });

  it('retains legacy author-qualified links', () => {
    expect(parseVideoRouteId(SHARED_D_TAG, AUTHOR.toUpperCase())).toEqual({
      lookupId: SHARED_D_TAG,
      address: null, legacyAuthor: AUTHOR,
    });
    expect(parseVideoRouteId(SHARED_D_TAG, 'invalid')).toEqual({ lookupId: SHARED_D_TAG, address: null });
  });

  it('preserves the legacy author for a d tag that only looks like a standard reference', () => {
    const target = parseVideoRouteId('naddr1broken', AUTHOR);
    expect(matchesVideoTarget(video({ vineId: 'naddr1broken' }), target)).toBe(true);
    expect(matchesVideoTarget(video({ pubkey: OTHER_AUTHOR, vineId: 'naddr1broken' }), target)).toBe(false);
  });

  it('does not use the embedded author of a standard address for a non-video kind', () => {
    const reference = naddrEncode({ kind: 30023, pubkey: AUTHOR, identifier: SHARED_D_TAG });
    expect(parseVideoRouteId(reference, OTHER_AUTHOR)).toEqual({ lookupId: reference, address: null });
  });

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

describe('matchesVideoTarget', () => {
  it('requires the kind as well as the author and d tag of an naddr', () => {
    const target = parseVideoRouteId(naddrEncode({ kind: 34235, pubkey: AUTHOR, identifier: SHARED_D_TAG }));
    expect(matchesVideoTarget({ ...video({}), kind: 34236 }, target)).toBe(false);
    expect(matchesVideoTarget({ ...video({}), kind: 34235 }, target)).toBe(true);
  });
  it('requires the exact event ID of an nevent, never a matching d tag', () => {
    const target = parseVideoRouteId(neventEncode({ id: EVENT_ID }));
    expect(matchesVideoTarget(video({ id: 'd'.repeat(64), vineId: EVENT_ID }), target)).toBe(false);
    expect(matchesVideoTarget(video({}), target)).toBe(true);
  });
  it('keeps author-qualified legacy event IDs and d tags working', () => {
    expect(matchesVideoTarget(video({ vineId: null }), parseVideoRouteId(EVENT_ID, AUTHOR))).toBe(true);
    expect(matchesVideoTarget(video({}), parseVideoRouteId(SHARED_D_TAG, AUTHOR))).toBe(true);
    expect(matchesVideoTarget(video({ pubkey: OTHER_AUTHOR }), parseVideoRouteId(SHARED_D_TAG, AUTHOR))).toBe(false);
  });
});
