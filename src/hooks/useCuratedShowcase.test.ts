// ABOUTME: Tests for merging curated showcase lists (title match + seed coordinate)
// ABOUTME: Covers union, dedupe, recency, both ref kinds, title gating, and admin allowlist

import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { mergeCuratedRefs } from './useCuratedShowcase';
import type { CurationListRef } from '@/config/curation';

const CURATOR_A = 'a'.repeat(64);
const CURATOR_B = 'b'.repeat(64);
const SEED_PK = 'd'.repeat(64);
const IMPOSTOR = 'c'.repeat(64);

const TITLE = 'Divine Web Showcase';
const OPTS = {
  adminPubkeys: [CURATOR_A, CURATOR_B],
  title: TITLE,
  seedLists: [{ pubkey: SEED_PK, dTag: 'list_seed' }] as CurationListRef[],
};

const eventId = (n: number) => n.toString(16).padStart(64, '0');
const coord = (dTag: string, pubkey = CURATOR_A) => `34236:${pubkey}:${dTag}`;

function listEvent(
  pubkey: string,
  opts: { dTag?: string; title?: string; e?: string[]; a?: string[]; createdAt?: number } = {},
): NostrEvent {
  const { dTag = 'list_1', title = TITLE, e = [], a = [], createdAt = 1700000000 } = opts;
  return {
    id: eventId(900 + createdAt % 100),
    pubkey,
    created_at: createdAt,
    kind: 30005,
    tags: [
      ['d', dTag],
      ['title', title],
      ...e.map(id => ['e', id]),
      ...a.map(c => ['a', c]),
    ],
    content: '',
    sig: 'f'.repeat(128),
  };
}

describe('mergeCuratedRefs', () => {
  it('returns nothing for no events', () => {
    expect(mergeCuratedRefs([], OPTS)).toEqual([]);
  });

  it('renders an allowlisted curator list matching the title', () => {
    const ev = listEvent(CURATOR_A, { e: [eventId(1), eventId(2)] });
    expect(mergeCuratedRefs([ev], OPTS)).toEqual([eventId(1), eventId(2)]);
  });

  it('reads a-tag coordinates as well as e-tag ids', () => {
    const ev = listEvent(CURATOR_A, { a: [coord('one')] });
    expect(mergeCuratedRefs([ev], OPTS)).toEqual([coord('one')]);
  });

  it('matches the title case-insensitively and trimming whitespace', () => {
    const ev = listEvent(CURATOR_A, { title: '  divine web showcase  ', e: [eventId(1)] });
    expect(mergeCuratedRefs([ev], OPTS)).toEqual([eventId(1)]);
  });

  // The title is not a secret; the pubkey allowlist is the trust boundary.
  it('ignores a correctly-titled list from a non-allowlisted pubkey', () => {
    const ev = listEvent(IMPOSTOR, { e: [eventId(66)] });
    expect(mergeCuratedRefs([ev], OPTS)).toEqual([]);
  });

  it('ignores an allowlisted curator list with a different title', () => {
    const ev = listEvent(CURATOR_A, { title: 'My List', e: [eventId(50)] });
    expect(mergeCuratedRefs([ev], OPTS)).toEqual([]);
  });

  it('renders a seed-coordinate list regardless of its title', () => {
    const ev = listEvent(SEED_PK, { dTag: 'list_seed', title: 'new & good', e: [eventId(9)] });
    expect(mergeCuratedRefs([ev], OPTS)).toEqual([eventId(9)]);
  });

  it('ignores a seed pubkey publishing a different d tag', () => {
    const ev = listEvent(SEED_PK, { dTag: 'list_other', title: 'whatever', e: [eventId(9)] });
    expect(mergeCuratedRefs([ev], OPTS)).toEqual([]);
  });

  it('unions across curators, newest list first', () => {
    const older = listEvent(CURATOR_A, { e: [eventId(1)], createdAt: 1700000000 });
    const newer = listEvent(CURATOR_B, { e: [eventId(2)], createdAt: 1700000050 });
    expect(mergeCuratedRefs([older, newer], OPTS)).toEqual([eventId(2), eventId(1)]);
  });

  it('dedupes a video referenced by two lists', () => {
    const shared = eventId(7);
    const a = listEvent(CURATOR_A, { e: [shared, eventId(1)], createdAt: 1700000050 });
    const b = listEvent(CURATOR_B, { e: [shared, eventId(2)], createdAt: 1700000000 });
    expect(mergeCuratedRefs([a, b], OPTS)).toEqual([shared, eventId(1), eventId(2)]);
  });
});
