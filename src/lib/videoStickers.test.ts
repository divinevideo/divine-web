// ABOUTME: Tests reading Divine `sticker` tags: which tags are kept, which are dropped, and why
// ABOUTME: Cases mirror divine-mobile's video_sticker_region_test.dart so web and app agree

import { describe, expect, it } from 'vitest';
import type { VideoSticker } from '@/types/video';
import {
  getReplyRootRouteId,
  getVideoStickerFields,
  isVideoStickerOnFrame,
  isVideoStickerShownAt,
  parseVideoStickerTag,
  parseVideoStickers,
  sanitizeUtf16,
} from './videoStickers';

const PUBKEY = 'a'.repeat(64);
const EVENT_ID = 'e'.repeat(64);
const AREA = '0.5 0.5 0.2 0.1';

function tagOf(kind: string, target: string, extra: string[] = []): string[] {
  return ['sticker', kind, target, AREA, '0', ...extra];
}

/** A tag with an empty window and style, then its label, like the app's vote tags. */
function labeledTag(kind: string, target: string, label: string, audience?: string): string[] {
  return [...tagOf(kind, target), '', '', 'light', label, ...(audience === undefined ? [] : [audience])];
}

describe('parseVideoStickerTag', () => {
  it('reads every field of a full tag', () => {
    expect(
      parseVideoStickerTag([
        'sticker', 'link', 'https://divine.video/about', '0.5 0.25 0.4 0.05', '30',
        '1500', '4200', 'light', 'divine.video',
      ]),
    ).toEqual<VideoSticker>({
      kind: 'link',
      target: 'https://divine.video/about',
      centerX: 0.5,
      centerY: 0.25,
      width: 0.4,
      height: 0.05,
      rotationDegrees: 30,
      startMs: 1500,
      endMs: 4200,
      style: 'light',
      label: 'divine.video',
      audience: 'everyone',
    });
  });

  it('reads a still sticker without window, style or label', () => {
    const sticker = parseVideoStickerTag(tagOf('hashtag', 'summer'));
    expect(sticker).toMatchObject({ kind: 'hashtag', target: 'summer', rotationDegrees: 0 });
    expect(sticker).not.toHaveProperty('startMs');
    expect(sticker).not.toHaveProperty('endMs');
    expect(sticker).not.toHaveProperty('style');
    expect(sticker).not.toHaveProperty('label');
  });

  it('reads an empty start or end as from the start or until the end', () => {
    expect(parseVideoStickerTag(tagOf('hashtag', 'summer', ['', '3000']))).toMatchObject({ endMs: 3000 });
    expect(parseVideoStickerTag(tagOf('hashtag', 'summer', ['1000', '']))).toMatchObject({ startMs: 1000 });
  });

  it('ignores what is not a sticker tag', () => {
    expect(parseVideoStickerTag(['t', 'summer'])).toBeNull();
    expect(parseVideoStickerTag(['sticker', 'link', 'https://divine.video', AREA])).toBeNull();
    expect(parseVideoStickerTag('sticker')).toBeNull();
    expect(parseVideoStickerTag(['sticker', 'link', 'https://divine.video', AREA, 0])).toBeNull();
  });

  it('drops a kind it does not know', () => {
    expect(parseVideoStickerTag(tagOf('music', 'summer'))).toBeNull();
    expect(parseVideoStickerTag(tagOf('Link', 'https://divine.video'))).toBeNull();
  });

  describe('link', () => {
    it('keeps an http or https address with a host', () => {
      expect(parseVideoStickerTag(tagOf('link', ' https://divine.video/about '))?.target)
        .toBe('https://divine.video/about');
      expect(parseVideoStickerTag(tagOf('link', 'HTTP://Example.com'))?.target).toBe('http://example.com/');
    });

    it.each([
      'javascript://alert',
      'javascript:alert(1)',
      'JavaScript:alert(document.cookie)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://example.com',
      'nostr:npub1abc',
      'https://',
      'https:example.com',
      'https:/example.com',
      '//example.com',
      'example.com',
      '',
      ' java\nscript:alert(1)',
    ])('drops %j, which is no http(s) page of a named host', (target) => {
      expect(parseVideoStickerTag(tagOf('link', target))).toBeNull();
    });
  });

  it('reads a pubkey in lower case and drops anything else', () => {
    expect(parseVideoStickerTag(tagOf('mention', PUBKEY.toUpperCase()))?.target).toBe(PUBKEY);
    expect(parseVideoStickerTag(tagOf('mention', 'npub1notahexkey'))).toBeNull();
    expect(parseVideoStickerTag(tagOf('mention', 'a'.repeat(63)))).toBeNull();
    expect(parseVideoStickerTag(tagOf('mention', 'g'.repeat(64)))).toBeNull();
  });

  describe('hashtag', () => {
    it('strips one leading # and lower-cases it', () => {
      expect(parseVideoStickerTag(tagOf('hashtag', '#Summer'))?.target).toBe('summer');
      expect(parseVideoStickerTag(tagOf('hashtag', 'x'.repeat(100)))?.target).toBe('x'.repeat(100));
    });

    it.each(['', '#', 'two words', '##summer', 'sum/mer', 'what?', 'tab\there', 'x'.repeat(101)])(
      'drops %j',
      (target) => {
        expect(parseVideoStickerTag(tagOf('hashtag', target))).toBeNull();
      },
    );
  });

  it('mends a broken text so it can be shown', () => {
    const sticker = parseVideoStickerTag(labeledTag('hashtag', 'sum\uD800mer', 'sum\uD800mer'));
    expect(sticker?.target).toBe('sum�mer');
    expect(sticker?.label).toBe('sum�mer');
  });

  describe('place', () => {
    it('reads a place by its full name', () => {
      expect(parseVideoStickerTag(tagOf('place', ' Zermatt, Wallis, Schweiz '))?.target)
        .toBe('Zermatt, Wallis, Schweiz');
      expect(parseVideoStickerTag(tagOf('place', 'x'.repeat(200)))).not.toBeNull();
    });

    it.each(['', 'Zermatt\nWallis', 'Zermatt\u0000', 'Zer\u007fmatt', 'x'.repeat(201)])('drops %j', (target) => {
      expect(parseVideoStickerTag(tagOf('place', target))).toBeNull();
    });
  });

  it('reads a reply by its event id in lower case', () => {
    expect(parseVideoStickerTag(tagOf('reply', EVENT_ID.toUpperCase()))?.target).toBe(EVENT_ID);
    expect(parseVideoStickerTag(tagOf('reply', 'note1abc'))).toBeNull();
    expect(parseVideoStickerTag(tagOf('reply', ''))).toBeNull();
  });

  it('keeps a sound page id and reads anything else as the video\'s own sound', () => {
    const target = (raw: string) => parseVideoStickerTag(tagOf('sound', raw))?.target;
    expect(target('bundled_potato_flew')).toBe('bundled_potato_flew');
    expect(target('C'.repeat(64))).toBe('c'.repeat(64));
    expect(target('https://example.com/song')).toBe('');
    expect(target('bundled_../../x')).toBe('');
  });

  describe('countdown', () => {
    it('reads the Unix second it ends at', () => {
      expect(parseVideoStickerTag(tagOf('countdown', '1782064800'))?.target).toBe('1782064800');
      expect(parseVideoStickerTag(tagOf('countdown', '0x6A57B7E0'))?.target).toBe('1784133600');
    });

    it.each(['soon', '0', '-5', '253402300800', '1.5', ''])('drops %j', (target) => {
      expect(parseVideoStickerTag(tagOf('countdown', target))).toBeNull();
    });
  });

  describe('polls', () => {
    it('reads a poll by its event id in lower case', () => {
      const sticker = parseVideoStickerTag(labeledTag('poll', PUBKEY.toUpperCase(), 'Which one?\nRed\nBlue'));
      expect(sticker).toMatchObject({ kind: 'poll', target: PUBKEY, label: 'Which one?\nRed\nBlue' });
    });

    it('takes a poll that names no event id as one with no vote', () => {
      expect(parseVideoStickerTag(labeledTag('quiz', 'note1abc', 'Capital?\nBern\nZurich'))?.target).toBe('');
    });

    it.each(['', 'Which one?\nRed', 'Which one?\nA\nB\nC\nD\nE', 'Which one?\n\nBlue', `Q\nA\n${'x'.repeat(300)}`])(
      'drops a poll labeled %j',
      (label) => {
        expect(parseVideoStickerTag(labeledTag('poll', PUBKEY, label))).toBeNull();
      },
    );

    it('reads a slider with its question and emoji only', () => {
      expect(parseVideoStickerTag(labeledTag('slider', PUBKEY, 'How hungry?\n😋'))?.label).toBe('How hungry?\n😋');
      expect(parseVideoStickerTag(labeledTag('slider', PUBKEY, 'How hungry?\n😋\nmore'))).toBeNull();
    });
  });

  it('reads a question by its question alone', () => {
    expect(parseVideoStickerTag(labeledTag('question', PUBKEY, 'Ask me anything')))
      .toMatchObject({ kind: 'question', target: '', label: 'Ask me anything' });
    expect(parseVideoStickerTag(labeledTag('question', '', ''))).toBeNull();
    expect(parseVideoStickerTag(labeledTag('question', '', 'Ask me\nanything'))).toBeNull();
  });

  describe('prompt', () => {
    const address = `34236:${PUBKEY}:desk-1`;

    it('reads its chain and the hashtag answers share', () => {
      expect(parseVideoStickerTag(labeledTag('prompt', address, 'Show your desk\ndesksetup')))
        .toMatchObject({ kind: 'prompt', target: address });
      expect(parseVideoStickerTag(labeledTag('prompt', '', 'Show your desk\ndesksetup'))?.target).toBe('');
    });

    it.each([
      ['note1abc', 'Show your desk\ndesksetup'],
      [`1:${PUBKEY}:d`, 'Show your desk\ndesksetup'],
      [`34236:${PUBKEY}:`, 'Show your desk\ndesksetup'],
      ['', 'Show your desk'],
      ['', 'Show your desk\ndesk setup'],
      ['', 'Show your desk\nDeskSetup'],
      ['', '\ndesksetup'],
    ])('drops target %j labeled %j', (target, label) => {
      expect(parseVideoStickerTag(labeledTag('prompt', target, label))).toBeNull();
    });
  });

  it('reads a replies sticker by its title, pointing at nothing', () => {
    expect(parseVideoStickerTag(labeledTag('replies', PUBKEY, 'Reply with a video')))
      .toMatchObject({ kind: 'replies', target: '' });
    expect(parseVideoStickerTag(labeledTag('replies', '', ''))).toBeNull();
  });

  describe('audience', () => {
    it('reads who may answer a prompt or replies sticker', () => {
      for (const [kind, label] of [['prompt', 'Show your desk\ndesksetup'], ['replies', 'Reply with a video']]) {
        expect(parseVideoStickerTag(labeledTag(kind, '', label, 'following'))?.audience).toBe('following');
        expect(parseVideoStickerTag(labeledTag(kind, '', label, 'creator'))?.audience).toBe('creator');
        expect(parseVideoStickerTag(labeledTag(kind, '', label, 'everyone'))?.audience).toBe('everyone');
        expect(parseVideoStickerTag(labeledTag(kind, '', label, ''))?.audience).toBe('everyone');
        expect(parseVideoStickerTag(labeledTag(kind, '', label))?.audience).toBe('everyone');
      }
    });

    it('drops a sticker restricted in a way it does not know', () => {
      expect(parseVideoStickerTag(labeledTag('replies', '', 'Reply with a video', 'closeFriends'))).toBeNull();
      expect(parseVideoStickerTag(labeledTag('replies', '', 'Reply with a video', 'Creator'))).toBeNull();
    });

    it('ignores an audience on any other kind', () => {
      expect(parseVideoStickerTag(labeledTag('question', '', 'Ask me anything', 'creator'))?.audience)
        .toBe('everyone');
      expect(parseVideoStickerTag(labeledTag('link', 'https://divine.video', 'x', 'closeFriends'))?.audience)
        .toBe('everyone');
    });
  });

  describe('area and angle', () => {
    const tag = (area: string, rest: string[] = []) => ['sticker', 'link', 'https://divine.video', area, '0', ...rest];

    it.each([
      ['0.5 0.5 0.2'],
      ['0.5 0.5 0.2 0.1 0.3'],
      ['0.5 0.5 0 0.1'],
      ['0.5 0.5 0.2 -0.1'],
      ['0.5 0.5 4.01 0.1'],
      ['0.5 0.5 0.2 NaN'],
      ['0.5 0.5 0.2 Infinity'],
      ['0.5 0.5 0.2 1e400'],
      ['0.5 0.5 0.2 0x1'],
      ['0.5 0.5 0.2 0.1abc'],
      ['1e308 0.5 0.2 0.1'],
      ['0.5 -3 0.2 0.1'],
      [''],
    ])('drops the area %j', (area) => {
      expect(parseVideoStickerTag(tag(area))).toBeNull();
    });

    it('reads numbers the way Dart does', () => {
      expect(parseVideoStickerTag(tag('  .5\t0.5   2e-1 1.  '))).toMatchObject({
        centerX: 0.5,
        centerY: 0.5,
        width: 0.2,
        height: 1,
      });
      expect(parseVideoStickerTag(tag('0.5 0.5 4 4'))).not.toBeNull();
    });

    it('drops an angle that is no finite number', () => {
      for (const degrees of ['', 'NaN', 'Infinity', 'ten', '1e400']) {
        expect(parseVideoStickerTag(['sticker', 'link', 'https://divine.video', AREA, degrees])).toBeNull();
      }
    });

    it('reduces an angle past whole turns, keeping its sign', () => {
      const degrees = (raw: string) =>
        parseVideoStickerTag(['sticker', 'link', 'https://divine.video', AREA, raw])?.rotationDegrees;
      expect(degrees('-405')).toBe(-45);
      expect(degrees('720')).toBe(0);
      expect(Number.isFinite(degrees('1e308'))).toBe(true);
    });
  });

  describe('time window', () => {
    const tag = (window: string[]) => tagOf('link', 'https://divine.video', window);

    it.each([
      [['2000', '1000']],
      [['1000', '1000']],
      [['-5']],
      [['', '-1']],
      [['1.5']],
      [['soon']],
      [['99999999999999999999']],
    ])('drops the window %j', (window) => {
      expect(parseVideoStickerTag(tag(window))).toBeNull();
    });

    it('reads whole milliseconds, as Dart does', () => {
      expect(parseVideoStickerTag(tag([' 0 ', '+1500']))).toMatchObject({ startMs: 0, endMs: 1500 });
      expect(parseVideoStickerTag(tag(['0x10']))).toMatchObject({ startMs: 16 });
    });
  });

  it('drops a label too long to show but keeps the button', () => {
    const sticker = parseVideoStickerTag(labeledTag('hashtag', 'summer', 'x'.repeat(301)));
    expect(sticker).toMatchObject({ kind: 'hashtag', style: 'light' });
    expect(sticker).not.toHaveProperty('label');
  });
});

describe('parseVideoStickers', () => {
  it('reads the sticker tags in order and skips broken ones', () => {
    const stickers = parseVideoStickers([
      ['d', 'video-stickers'],
      tagOf('link', 'https://divine.video/about'),
      ['sticker', 'link', 'javascript://alert', AREA, '0'],
      tagOf('hashtag', 'summer'),
    ]);
    expect(stickers.map((s) => s.target)).toEqual(['https://divine.video/about', 'summer']);
  });

  it('reads nothing from no tags', () => {
    expect(parseVideoStickers(undefined)).toEqual([]);
  });
});

describe('isVideoStickerOnFrame', () => {
  it('holds while any of the turned sticker can reach the frame', () => {
    expect(isVideoStickerOnFrame({ centerX: 0.5, centerY: 0.25, width: 0.4, height: 0.05 })).toBe(true);
    expect(isVideoStickerOnFrame({ centerX: -0.25, centerY: 0.5, width: 0.2, height: 0.1 })).toBe(true);
    expect(isVideoStickerOnFrame({ centerX: -0.4, centerY: 0.5, width: 0.2, height: 0.1 })).toBe(false);
    expect(isVideoStickerOnFrame({ centerX: 0.5, centerY: 1.4, width: 0.2, height: 0.1 })).toBe(false);
  });
});

describe('isVideoStickerShownAt', () => {
  it('shows the sticker from its start until just before its end', () => {
    const sticker = { startMs: 1000, endMs: 2000 };
    expect(isVideoStickerShownAt(sticker, 999)).toBe(false);
    expect(isVideoStickerShownAt(sticker, 1000)).toBe(true);
    expect(isVideoStickerShownAt(sticker, 1999.9)).toBe(true);
    expect(isVideoStickerShownAt(sticker, 2000)).toBe(false);
    expect(isVideoStickerShownAt({}, 0)).toBe(true);
  });
});

describe('getReplyRootRouteId', () => {
  const rootAddress = `34236:${PUBKEY}:root-video`;

  it('prefers the root address of a video reply', () => {
    expect(getReplyRootRouteId([['E', EVENT_ID], ['A', rootAddress], ['K', '34236']])).toBe(rootAddress);
  });

  it('falls back to the root event id', () => {
    expect(getReplyRootRouteId([['E', EVENT_ID], ['K', '34236']])).toBe(EVENT_ID);
  });

  it('takes the kind from the address when no K tag names it', () => {
    expect(getReplyRootRouteId([['A', rootAddress]])).toBe(rootAddress);
  });

  it('is undefined for a reply to anything but a video', () => {
    expect(getReplyRootRouteId([['E', EVENT_ID]])).toBeUndefined();
    expect(getReplyRootRouteId([['E', EVENT_ID], ['K', '1']])).toBeUndefined();
    expect(getReplyRootRouteId([['A', `30023:${PUBKEY}:article`]])).toBeUndefined();
    expect(getReplyRootRouteId([['e', EVENT_ID], ['k', '34236']])).toBeUndefined();
    expect(getReplyRootRouteId([])).toBeUndefined();
  });

  it('skips empty root tags', () => {
    expect(getReplyRootRouteId([['E', ' '], ['E', EVENT_ID], ['K', '34236']])).toBe(EVENT_ID);
  });
});

describe('getVideoStickerFields', () => {
  it('adds nothing to a video without stickers or a root', () => {
    expect(getVideoStickerFields([['d', 'x']])).toEqual({});
  });

  it('adds the stickers and the reply root', () => {
    expect(getVideoStickerFields([tagOf('hashtag', 'summer'), ['E', EVENT_ID], ['K', '34236']])).toEqual({
      stickers: [expect.objectContaining({ kind: 'hashtag', target: 'summer' })],
      replyRootRouteId: EVENT_ID,
    });
  });
});

describe('sanitizeUtf16', () => {
  it('replaces unpaired surrogates and keeps pairs', () => {
    expect(sanitizeUtf16('a\uD800b\uDC00c😋')).toBe('a�b�c😋');
    expect(sanitizeUtf16('trailing\uD83D')).toBe('trailing�');
  });
});
