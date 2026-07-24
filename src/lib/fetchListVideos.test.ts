// ABOUTME: Tests for resolving list video refs (a coordinates + e event ids) into videos
// ABOUTME: The e-id path is what makes mobile-authored lists render on the web

import { describe, it, expect } from 'vitest';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { fetchListVideos } from './fetchListVideos';

const AUTHOR_A = 'a'.repeat(64);
const AUTHOR_B = 'b'.repeat(64);

const id = (n: number) => n.toString(16).padStart(64, '0');

function videoEvent(eventId: string, dTag: string, pubkey = AUTHOR_A): NostrEvent {
  return {
    id: eventId,
    pubkey,
    created_at: 1700000000,
    kind: 34236,
    tags: [
      ['d', dTag],
      ['title', `video ${dTag}`],
      ['imeta', `url https://cdn.divine.video/${dTag}.mp4`, 'm video/mp4'],
    ],
    content: '',
    sig: 'f'.repeat(128),
  };
}

/** A fake relay that returns the given events for any query. */
function querierReturning(events: NostrEvent[]) {
  const calls: NostrFilter[][] = [];
  return {
    calls,
    query: async (filters: NostrFilter[]) => {
      calls.push(filters);
      return events;
    },
  };
}

const signal = new AbortController().signal;

describe('fetchListVideos', () => {
  it('resolves e-tag event ids and preserves ref order', async () => {
    const events = [videoEvent(id(2), 'two'), videoEvent(id(1), 'one')];
    const nostr = querierReturning(events);

    const videos = await fetchListVideos(nostr, [id(1), id(2)], signal);

    expect(videos.map(v => v.id)).toEqual([id(1), id(2)]);
    // e-ids are batched into a single ids filter.
    expect(nostr.calls[0].some(f => Array.isArray(f.ids))).toBe(true);
  });

  it('resolves a-tag coordinates', async () => {
    const events = [videoEvent(id(5), 'clip')];
    const nostr = querierReturning(events);

    const videos = await fetchListVideos(nostr, [`34236:${AUTHOR_A}:clip`], signal);

    expect(videos.map(v => v.id)).toEqual([id(5)]);
  });

  it('resolves a mixed list of both ref kinds in order', async () => {
    const byId = videoEvent(id(9), 'nine', AUTHOR_B);
    const byCoord = videoEvent(id(8), 'eight', AUTHOR_A);
    const nostr = querierReturning([byId, byCoord]);

    const videos = await fetchListVideos(
      nostr,
      [id(9), `34236:${AUTHOR_A}:eight`],
      signal,
    );

    expect(videos.map(v => v.id)).toEqual([id(9), id(8)]);
  });

  it('dedupes when the same video is reached via both an e-id and an a-coord', async () => {
    const event = videoEvent(id(3), 'three', AUTHOR_A);
    const nostr = querierReturning([event]);

    const videos = await fetchListVideos(
      nostr,
      [id(3), `34236:${AUTHOR_A}:three`],
      signal,
    );

    expect(videos).toHaveLength(1);
  });

  it('drops refs that resolve to nothing', async () => {
    const nostr = querierReturning([videoEvent(id(1), 'one')]);
    const videos = await fetchListVideos(nostr, [id(1), id(2)], signal);
    expect(videos.map(v => v.id)).toEqual([id(1)]);
  });

  it('drops an event with no playable media', async () => {
    const noMedia: NostrEvent = {
      id: id(1),
      pubkey: AUTHOR_A,
      created_at: 1700000000,
      kind: 34236,
      tags: [['d', 'one'], ['title', 'no media']],
      content: '',
      sig: 'f'.repeat(128),
    };
    const nostr = querierReturning([noMedia]);
    expect(await fetchListVideos(nostr, [id(1)], signal)).toEqual([]);
  });

  it('returns nothing for an empty ref list without querying', async () => {
    const nostr = querierReturning([]);
    expect(await fetchListVideos(nostr, [], signal)).toEqual([]);
    expect(nostr.calls).toHaveLength(0);
  });
});
