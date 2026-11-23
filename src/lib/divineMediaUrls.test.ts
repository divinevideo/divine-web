// ABOUTME: Tests for picking the playback URL of Divine-hosted videos
// ABOUTME: Covers the 720p MP4 rewrite, its fallback order and the unavailable-rendition memory

import { describe, expect, it } from 'vitest';
import {
  buildPlaybackUrls,
  getProgressive720pUrl,
  markProgressiveUnavailable,
} from './divineMediaUrls';

const hashOf = (char: string) => char.repeat(64);

describe('getProgressive720pUrl', () => {
  it('returns the 720p MP4 for an original Divine blob URL', () => {
    expect(getProgressive720pUrl(`https://media.divine.video/${hashOf('a')}`))
      .toBe(`https://media.divine.video/${hashOf('a')}/720p.mp4`);
  });

  it('ignores the file extension of the original blob', () => {
    expect(getProgressive720pUrl(`https://media.divine.video/${hashOf('b')}.mp4`))
      .toBe(`https://media.divine.video/${hashOf('b')}/720p.mp4`);
  });

  it('normalizes an upper-case hash', () => {
    expect(getProgressive720pUrl(`https://media.divine.video/${hashOf('C')}`))
      .toBe(`https://media.divine.video/${hashOf('c')}/720p.mp4`);
  });

  it.each([
    ['another host', `https://cdn.example.com/${hashOf('d')}`],
    ['a path that is not a blob hash', 'https://media.divine.video/test-video.mp4'],
    ['a rendition URL', `https://media.divine.video/${hashOf('d')}/480p.mp4`],
    ['an HLS URL', `https://media.divine.video/${hashOf('d')}/hls/master.m3u8`],
    ['an invalid URL', 'not a url'],
  ])('returns undefined for %s', (_, url) => {
    expect(getProgressive720pUrl(url)).toBeUndefined();
  });
});

describe('buildPlaybackUrls', () => {
  it('plays the 720p MP4 first and keeps the original as fallback', () => {
    const original = `https://media.divine.video/${hashOf('e')}`;

    expect(buildPlaybackUrls(original, ['https://mirror.example.com/e.mp4'])).toEqual([
      `${original}/720p.mp4`,
      original,
      'https://mirror.example.com/e.mp4',
    ]);
  });

  it('keeps non-Divine sources unchanged', () => {
    expect(buildPlaybackUrls('https://cdn.example.com/video.mp4', ['https://cdn.example.com/fallback.mp4']))
      .toEqual(['https://cdn.example.com/video.mp4', 'https://cdn.example.com/fallback.mp4']);
  });

  it('does not speculate on a 720p rendition for migrated archive clips', () => {
    const original = `https://media.divine.video/${hashOf('7')}`;

    expect(buildPlaybackUrls(original, ['https://mirror.example.com/v.mp4'], { isVineMigrated: true }))
      .toEqual([original, 'https://mirror.example.com/v.mp4']);
  });

  it('drops duplicate URLs', () => {
    const original = `https://media.divine.video/${hashOf('f')}`;

    expect(buildPlaybackUrls(original, [original])).toEqual([`${original}/720p.mp4`, original]);
  });

  it('returns only the fallbacks when there is no source', () => {
    expect(buildPlaybackUrls(undefined, ['https://cdn.example.com/fallback.mp4']))
      .toEqual(['https://cdn.example.com/fallback.mp4']);
  });

  it('skips the 720p MP4 after it failed, until the failure expires', () => {
    const original = `https://media.divine.video/${hashOf('1')}`;
    const failedAt = 1_000_000;

    markProgressiveUnavailable(`${original}/720p.mp4`, failedAt);

    expect(buildPlaybackUrls(original, [], { now: failedAt + 60_000 })).toEqual([original]);
    expect(buildPlaybackUrls(original, [], { now: failedAt + 11 * 60_000 }))
      .toEqual([`${original}/720p.mp4`, original]);
  });

  it('only skips the 720p MP4 of the video whose rendition failed', () => {
    const failed = `https://media.divine.video/${hashOf('2')}`;
    const other = `https://media.divine.video/${hashOf('3')}`;

    markProgressiveUnavailable(`${failed}/720p.mp4`);

    expect(buildPlaybackUrls(other)).toEqual([`${other}/720p.mp4`, other]);
  });

  it('ignores failures reported for URLs that are not 720p renditions', () => {
    const original = `https://media.divine.video/${hashOf('4')}`;

    markProgressiveUnavailable(original);

    expect(buildPlaybackUrls(original)).toEqual([`${original}/720p.mp4`, original]);
  });
});
