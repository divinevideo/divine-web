// ABOUTME: Tests bounded relay filters and addressable dedupe for people-list videos

import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { VIDEO_KINDS } from '@/types/video';
import {
  buildPeopleListVideoFilters,
  mergePeopleListVideoEvents,
} from './peopleListVideos';

const OWNER = 'a'.repeat(64);

function videoEvent(dTag: string, createdAt: number): NostrEvent {
  return {
    id: `${createdAt}`.padStart(64, '0'),
    pubkey: OWNER,
    kind: VIDEO_KINDS[0],
    created_at: createdAt,
    tags: [['d', dTag]],
    content: '',
    sig: 'f'.repeat(128),
  };
}

describe('buildPeopleListVideoFilters', () => {
  it('deduplicates and chunks authors at the relay-safe maximum', () => {
    const pubkeys = Array.from({ length: 101 }, (_, index) => index.toString(16).padStart(64, '0'));
    const filters = buildPeopleListVideoFilters([...pubkeys, pubkeys[0]], 999);

    expect(filters).toHaveLength(2);
    expect(filters[0]).toEqual({
      kinds: VIDEO_KINDS,
      authors: pubkeys.slice(0, 100),
      limit: 60,
      until: 999,
    });
    expect(filters[1].authors).toEqual([pubkeys[100]]);
  });

  it('returns no filters when the list has no people', () => {
    expect(buildPeopleListVideoFilters([])).toEqual([]);
  });
});

describe('mergePeopleListVideoEvents', () => {
  it('keeps the newest addressable version and sorts recent videos first', () => {
    const merged = mergePeopleListVideoEvents([
      videoEvent('same', 10),
      videoEvent('other', 20),
      videoEvent('same', 30),
    ]);

    expect(merged.map((event) => [event.tags[0][1], event.created_at])).toEqual([
      ['same', 30],
      ['other', 20],
    ]);
  });

  it('caps a merged page at 60 videos', () => {
    const events = Array.from({ length: 70 }, (_, index) => videoEvent(`video-${index}`, index));
    expect(mergePeopleListVideoEvents(events)).toHaveLength(60);
  });
});
