// ABOUTME: Tests what a click on each kind of video sticker opens on the web
// ABOUTME: and that only the kinds wired so far get a button

import { describe, expect, it } from 'vitest';
import { nip19 } from 'nostr-tools';
import type { VideoStickerKind } from '@/types/video';
import {
  getVideoStickerAction,
  isClickableVideoSticker,
  isTrustedLinkHost,
  linkDomain,
  mapSearchUrl,
  videoRoutePath,
} from './videoStickerActions';

const PUBKEY = 'a'.repeat(64);
const EVENT_ID = 'e'.repeat(64);
const NO_ROOT = { replyRootRouteId: undefined };

describe('getVideoStickerAction', () => {
  it('opens a link to Divine or one of its subdomains at once', () => {
    for (const target of ['https://divine.video/about', 'https://support.divine.video/a', 'https://DIVINE.video/']) {
      expect(getVideoStickerAction({ kind: 'link', target }, NO_ROOT))
        .toEqual({ type: 'external', url: new URL(target).href });
    }
  });

  it('shows where any other link goes before it opens', () => {
    expect(getVideoStickerAction({ kind: 'link', target: 'https://example.com/a?b=c' }, NO_ROOT))
      .toEqual({ type: 'confirmExternal', url: 'https://example.com/a?b=c' });
  });

  it('shows hosts that only look like Divine before they open', () => {
    for (const target of [
      'https://divine.video.login.example.com/',
      'https://evildivine.video/',
      'https://divine.video@example.com/',
      'https://divine-video.com/',
      'http://divine.video.:8080/',
    ]) {
      expect(getVideoStickerAction({ kind: 'link', target }, NO_ROOT)?.type).toBe('confirmExternal');
    }
  });

  it('never opens a link that is no http(s) page, however it got here', () => {
    for (const target of ['javascript:alert(1)', 'data:text/html,x', 'https://', 'not a url']) {
      expect(getVideoStickerAction({ kind: 'link', target }, NO_ROOT)).toBeNull();
    }
  });

  it('opens a mention as the profile of its npub', () => {
    expect(getVideoStickerAction({ kind: 'mention', target: PUBKEY }, NO_ROOT)).toEqual({
      type: 'internal',
      path: `/profile/${nip19.npubEncode(PUBKEY)}`,
      ownerPubkey: PUBKEY,
    });
    expect(getVideoStickerAction({ kind: 'mention', target: 'nope' }, NO_ROOT)).toBeNull();
  });

  it('opens a hashtag as its feed', () => {
    expect(getVideoStickerAction({ kind: 'hashtag', target: 'summer' }, NO_ROOT))
      .toEqual({ type: 'internal', path: '/hashtag/summer' });
    expect(getVideoStickerAction({ kind: 'hashtag', target: 'café%' }, NO_ROOT))
      .toEqual({ type: 'internal', path: '/hashtag/caf%C3%A9%25' });
  });

  it('opens a reply on the video its own NIP-22 root names', () => {
    const rootAddress = `34236:${PUBKEY}:root-video`;
    expect(getVideoStickerAction({ kind: 'reply', target: EVENT_ID }, { replyRootRouteId: rootAddress }))
      .toEqual({ type: 'internal', path: `/video/34236:${PUBKEY}:root-video` });
  });

  it('opens a reply on its target when the video names no root', () => {
    expect(getVideoStickerAction({ kind: 'reply', target: EVENT_ID }, NO_ROOT))
      .toEqual({ type: 'internal', path: `/video/${EVENT_ID}` });
  });

  it('opens a place in an OpenStreetMap search for its full name', () => {
    expect(getVideoStickerAction({ kind: 'place', target: 'Zermatt, Wallis, Schweiz' }, NO_ROOT)).toEqual({
      type: 'external',
      url: 'https://www.openstreetmap.org/search?query=Zermatt%2C+Wallis%2C+Schweiz',
    });
  });

  it.each<VideoStickerKind>(['countdown', 'sound', 'poll', 'quiz', 'slider', 'question', 'prompt', 'replies'])(
    'gives a %s sticker no button yet',
    (kind) => {
      const sticker = { kind, target: EVENT_ID };
      expect(isClickableVideoSticker(sticker)).toBe(false);
      expect(getVideoStickerAction(sticker, NO_ROOT)).toBeNull();
    },
  );
});

describe('mapSearchUrl', () => {
  it('keeps the place whole in one query parameter', () => {
    expect(new URL(mapSearchUrl('A & B #1')).searchParams.get('query')).toBe('A & B #1');
  });
});

describe('videoRoutePath', () => {
  it('keeps the author of an address and encodes its d tag', () => {
    expect(videoRoutePath(`34236:${PUBKEY.toUpperCase()}:a/b`)).toBe(`/video/34236:${PUBKEY}:a%2Fb`);
  });

  it('opens anything else as an id', () => {
    expect(videoRoutePath(EVENT_ID)).toBe(`/video/${EVENT_ID}`);
    expect(videoRoutePath('../x')).toBe('/video/..%2Fx');
  });
});

describe('isTrustedLinkHost', () => {
  it('trusts divine.video and its subdomains only', () => {
    expect(isTrustedLinkHost('divine.video')).toBe(true);
    expect(isTrustedLinkHost('api.divine.video')).toBe(true);
    expect(isTrustedLinkHost('Divine.Video')).toBe(true);
    expect(isTrustedLinkHost('divine.video.example.com')).toBe(false);
    expect(isTrustedLinkHost('notdivine.video')).toBe(false);
    expect(isTrustedLinkHost('')).toBe(false);
  });
});

describe('linkDomain', () => {
  it('names the whole host a link goes to, without www', () => {
    expect(linkDomain('https://www.example.com/a')).toBe('example.com');
    expect(linkDomain('https://divine.video.login.example.com/')).toBe('divine.video.login.example.com');
    expect(linkDomain('https://divine.video@example.com/')).toBe('example.com');
    expect(linkDomain('not a url')).toBe('');
  });
});
