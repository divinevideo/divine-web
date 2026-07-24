// ABOUTME: Tests for the public showcase safety floor
// ABOUTME: The point of these is that curation alone must never be enough to publish

import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import type { ParsedVideoData } from '@/types/video';
import { hasContentWarning, filterShowcaseSafeVideos } from './showcaseSafety';

const AUTHOR = 'a'.repeat(64);

function makeEvent(tags: string[][]): NostrEvent {
  return {
    id: '1'.repeat(64),
    pubkey: AUTHOR,
    created_at: 1700000000,
    kind: 34236,
    tags,
    content: '',
    sig: 'f'.repeat(128),
  };
}

function makeVideo(overrides: Partial<ParsedVideoData> = {}): ParsedVideoData {
  return {
    id: '1'.repeat(64),
    pubkey: AUTHOR,
    kind: 34236,
    createdAt: 1700000000,
    content: '',
    videoUrl: 'https://cdn.divine.video/clip.mp4',
    hashtags: [],
    vineId: 'clip',
    isVineMigrated: false,
    reposts: [],
    ...overrides,
  } as ParsedVideoData;
}

describe('hasContentWarning', () => {
  it('returns false for an undefined event', () => {
    expect(hasContentWarning(undefined)).toBe(false);
  });

  it('returns false for a clean event', () => {
    expect(hasContentWarning(makeEvent([['t', 'skateboarding']]))).toBe(false);
  });

  it('detects a NIP-36 content-warning tag', () => {
    expect(hasContentWarning(makeEvent([['content-warning', 'graphic']]))).toBe(true);
  });

  it('detects a NIP-32 L namespace label', () => {
    expect(hasContentWarning(makeEvent([['L', 'content-warning']]))).toBe(true);
  });

  it('detects a NIP-32 l label within the content-warning namespace', () => {
    expect(hasContentWarning(makeEvent([['l', 'nudity', 'content-warning']]))).toBe(true);
  });

  it('ignores an l tag in an unrelated namespace', () => {
    expect(hasContentWarning(makeEvent([['l', 'en', 'ISO-639-1']]))).toBe(false);
  });
});

describe('filterShowcaseSafeVideos', () => {
  it('keeps a clean video', () => {
    const clean = makeVideo();
    expect(filterShowcaseSafeVideos([clean])).toEqual([clean]);
  });

  // This is the test that proves the feature does its job: an admin adding an
  // age-gated video to a curated list must not be sufficient to publish it.
  it('drops an age-restricted video even though it was hand-curated', () => {
    const curated = [makeVideo({ ageRestricted: true })];
    expect(filterShowcaseSafeVideos(curated)).toEqual([]);
  });

  it('drops a video whose event carries a content warning', () => {
    const curated = [makeVideo({ originalEvent: makeEvent([['content-warning', 'graphic']]) })];
    expect(filterShowcaseSafeVideos(curated)).toEqual([]);
  });

  it('drops a video with no playable url', () => {
    expect(filterShowcaseSafeVideos([makeVideo({ videoUrl: '' })])).toEqual([]);
  });

  it('keeps safe videos while removing unsafe neighbours, preserving order', () => {
    const first = makeVideo({ id: 'a'.repeat(64), vineId: 'first' });
    const unsafe = makeVideo({ id: 'b'.repeat(64), vineId: 'unsafe', ageRestricted: true });
    const last = makeVideo({ id: 'c'.repeat(64), vineId: 'last' });

    expect(filterShowcaseSafeVideos([first, unsafe, last])).toEqual([first, last]);
  });
});
