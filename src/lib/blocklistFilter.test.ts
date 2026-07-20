// ABOUTME: Tests for pure per-viewer feed blocklist helpers
// ABOUTME: Covers muters-of-viewer, blockers-of-viewer (kind 30000 d=block), own blocks, and video filtering

import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  BLOCK_LIST_KIND,
  BLOCK_LIST_D_TAG,
  parseMutersOfViewer,
  parseBlockersOfViewer,
  parseOwnBlockedPubkeys,
  buildFeedBlocklist,
  filterBlockedVideos,
  filterBlockedVideoPages,
} from './blocklistFilter';
import { MUTE_LIST_KIND } from '@/hooks/useModeration';

const VIEWER = 'v'.repeat(64);
const ALICE = 'a'.repeat(64);
const BOB = 'b'.repeat(64);
const CAROL = 'c'.repeat(64);

let eventCounter = 0;

function makeEvent(overrides: Partial<NostrEvent>): NostrEvent {
  eventCounter++;
  return {
    id: String(eventCounter).padStart(64, '0'),
    pubkey: ALICE,
    created_at: 1700000000,
    kind: MUTE_LIST_KIND,
    tags: [],
    content: '',
    sig: 'f'.repeat(128),
    ...overrides,
  };
}

function muteListEvent(author: string, mutedPubkeys: string[], createdAt = 1700000000, id?: string): NostrEvent {
  return makeEvent({
    pubkey: author,
    kind: MUTE_LIST_KIND,
    created_at: createdAt,
    tags: mutedPubkeys.map(pk => ['p', pk]),
    ...(id ? { id } : {}),
  });
}

function blockListEvent(
  author: string,
  blockedPubkeys: string[],
  { dTag = BLOCK_LIST_D_TAG, createdAt = 1700000000 }: { dTag?: string; createdAt?: number } = {}
): NostrEvent {
  return makeEvent({
    pubkey: author,
    kind: BLOCK_LIST_KIND,
    created_at: createdAt,
    tags: [['d', dTag], ...blockedPubkeys.map(pk => ['p', pk])],
  });
}

describe('parseMutersOfViewer', () => {
  it('includes authors whose kind 10000 mute list p-tags the viewer', () => {
    const events = [
      muteListEvent(ALICE, [VIEWER]),
      muteListEvent(BOB, [CAROL]), // mutes someone else, not viewer
    ];
    expect(parseMutersOfViewer(events, VIEWER)).toEqual([ALICE]);
  });

  it('uses only the latest event per author (replaceable): unmute removes the muter', () => {
    const events = [
      muteListEvent(ALICE, [VIEWER], 100),
      muteListEvent(ALICE, [CAROL], 200), // newer list no longer p-tags viewer
    ];
    expect(parseMutersOfViewer(events, VIEWER)).toEqual([]);
  });

  it('keeps the muter when the latest event still p-tags the viewer regardless of order', () => {
    const events = [
      muteListEvent(ALICE, [CAROL], 100),
      muteListEvent(ALICE, [VIEWER], 200),
    ];
    // Reversed delivery order must not matter
    expect(parseMutersOfViewer(events, VIEWER)).toEqual([ALICE]);
    expect(parseMutersOfViewer(events.slice().reverse(), VIEWER)).toEqual([ALICE]);
  });

  it('breaks created_at ties by lowest event id (NIP-01 canonical)', () => {
    const older = muteListEvent(ALICE, [VIEWER], 100, '0'.repeat(64));
    const tied = muteListEvent(ALICE, [], 100, 'f'.repeat(64));
    // Lowest id wins on a tie → the p-tagging event is canonical
    expect(parseMutersOfViewer([older, tied], VIEWER)).toEqual([ALICE]);
  });

  it('ignores non-10000 events and events authored by the viewer', () => {
    const events = [
      blockListEvent(ALICE, [VIEWER]),
      muteListEvent(VIEWER, [VIEWER]),
    ];
    expect(parseMutersOfViewer(events, VIEWER)).toEqual([]);
  });
});

describe('parseBlockersOfViewer', () => {
  it('includes authors whose kind 30000 d=block list p-tags the viewer', () => {
    const events = [
      blockListEvent(ALICE, [VIEWER]),
      blockListEvent(BOB, [CAROL]),
    ];
    expect(parseBlockersOfViewer(events, VIEWER)).toEqual([ALICE]);
  });

  it('ignores kind 30000 lists with reserved/other d-tags (e.g. follow sets)', () => {
    const events = [
      blockListEvent(ALICE, [VIEWER], { dTag: 'friends' }),
      blockListEvent(BOB, [VIEWER], { dTag: 'mute' }),
    ];
    expect(parseBlockersOfViewer(events, VIEWER)).toEqual([]);
  });

  it('does not let a newer non-block list shadow the d=block list (addressable dedupe by pubkey:kind:d-tag)', () => {
    const events = [
      blockListEvent(ALICE, [VIEWER], { createdAt: 100 }),
      blockListEvent(ALICE, [CAROL], { dTag: 'friends', createdAt: 200 }),
    ];
    expect(parseBlockersOfViewer(events, VIEWER)).toEqual([ALICE]);
  });

  it('uses only the latest d=block event per author: unblock removes the blocker', () => {
    const events = [
      blockListEvent(ALICE, [VIEWER], { createdAt: 100 }),
      blockListEvent(ALICE, [CAROL], { createdAt: 200 }),
    ];
    expect(parseBlockersOfViewer(events, VIEWER)).toEqual([]);
  });

  it('ignores kind 10000 events and events authored by the viewer', () => {
    const events = [
      muteListEvent(ALICE, [VIEWER]),
      blockListEvent(VIEWER, [VIEWER]),
    ];
    expect(parseBlockersOfViewer(events, VIEWER)).toEqual([]);
  });
});

describe('parseOwnBlockedPubkeys', () => {
  it('returns p-tags from the viewer’s latest kind 30000 d=block event', () => {
    const events = [
      blockListEvent(VIEWER, [ALICE, BOB], { createdAt: 100 }),
      blockListEvent(VIEWER, [ALICE], { createdAt: 200 }),
    ];
    expect(parseOwnBlockedPubkeys(events, VIEWER)).toEqual([ALICE]);
  });

  it('ignores other authors, non-block d-tags, and self-references', () => {
    const events = [
      blockListEvent(ALICE, [BOB]),
      blockListEvent(VIEWER, [CAROL], { dTag: 'friends' }),
      blockListEvent(VIEWER, [VIEWER, BOB]),
    ];
    expect(parseOwnBlockedPubkeys(events, VIEWER)).toEqual([BOB]);
  });

  it('returns empty when the viewer has no block list', () => {
    expect(parseOwnBlockedPubkeys([], VIEWER)).toEqual([]);
  });
});

describe('buildFeedBlocklist', () => {
  it('unions all sources', () => {
    const set = buildFeedBlocklist({
      viewerPubkey: VIEWER,
      ownMutedPubkeys: [ALICE],
      ownBlockedPubkeys: [BOB],
      mutersOfViewer: [CAROL],
      blockersOfViewer: [ALICE, BOB],
    });
    expect(set).toEqual(new Set([ALICE, BOB, CAROL]));
  });

  it('never contains the viewer’s own pubkey (a malformed list must not hide own content)', () => {
    const set = buildFeedBlocklist({
      viewerPubkey: VIEWER,
      ownMutedPubkeys: [VIEWER, ALICE],
      mutersOfViewer: [VIEWER],
    });
    expect(set.has(VIEWER)).toBe(false);
    expect(set.has(ALICE)).toBe(true);
  });

  it('returns an empty set when no sources given', () => {
    expect(buildFeedBlocklist({ viewerPubkey: VIEWER }).size).toBe(0);
  });
});

describe('filterBlockedVideos', () => {
  const video = (pubkey: string, id: string) => ({ pubkey, id });

  it('drops videos from blocked authors', () => {
    const videos = [video(ALICE, '1'), video(BOB, '2'), video(CAROL, '3')];
    const result = filterBlockedVideos(videos, new Set([BOB]));
    expect(result.map(v => v.id)).toEqual(['1', '3']);
  });

  it('returns the same array reference when the blocklist is empty (identity for render stability)', () => {
    const videos = [video(ALICE, '1')];
    expect(filterBlockedVideos(videos, new Set())).toBe(videos);
  });

  it('returns the same array reference when nothing matches', () => {
    const videos = [video(ALICE, '1')];
    expect(filterBlockedVideos(videos, new Set([BOB]))).toBe(videos);
  });
});

describe('filterBlockedVideoPages', () => {
  const page = (pubkeys: string[]) => ({
    videos: pubkeys.map((pk, i) => ({ pubkey: pk, id: `${pk}-${i}` })),
    nextCursor: undefined,
  });

  it('filters blocked authors out of every page', () => {
    const data = { pages: [page([ALICE, BOB]), page([BOB, CAROL])], pageParams: [undefined] };
    const result = filterBlockedVideoPages(data, new Set([BOB]));
    expect(result?.pages[0].videos.map(v => v.pubkey)).toEqual([ALICE]);
    expect(result?.pages[1].videos.map(v => v.pubkey)).toEqual([CAROL]);
  });

  it('preserves identity when nothing is filtered', () => {
    const data = { pages: [page([ALICE])], pageParams: [undefined] };
    expect(filterBlockedVideoPages(data, new Set([BOB]))).toBe(data);
    expect(filterBlockedVideoPages(data, new Set())).toBe(data);
  });

  it('passes through undefined data', () => {
    expect(filterBlockedVideoPages(undefined, new Set([BOB]))).toBeUndefined();
  });

  it('preserves untouched page references while replacing filtered ones', () => {
    const clean = page([ALICE]);
    const dirty = page([BOB]);
    const data = { pages: [clean, dirty], pageParams: [undefined] };
    const result = filterBlockedVideoPages(data, new Set([BOB]));
    expect(result).not.toBe(data);
    expect(result?.pages[0]).toBe(clean);
    expect(result?.pages[1]).not.toBe(dirty);
    expect(result?.pages[1].videos).toEqual([]);
  });
});
