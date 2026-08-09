// ABOUTME: Unit tests for parsing public NIP-51 kind 30000 people lists

import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  deduplicatePeopleLists,
  parsePeopleListFromEvent,
  peopleListAddress,
} from './parsePeopleListFromEvent';

const OWNER = 'a'.repeat(64);
const ALICE = 'b'.repeat(64);
const BOB = 'c'.repeat(64);

function peopleListEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'd'.repeat(64),
    pubkey: OWNER,
    kind: 30000,
    created_at: 100,
    tags: [
      ['d', 'friends'],
      ['title', 'Friends'],
      ['description', 'Good people'],
      ['image', 'https://example.com/friends.jpg'],
      ['p', ALICE],
      ['p', BOB],
      ['p', ALICE],
    ],
    content: '',
    sig: 'e'.repeat(128),
    ...overrides,
  };
}

describe('parsePeopleListFromEvent', () => {
  it('parses a public people list and preserves member order', () => {
    expect(parsePeopleListFromEvent(peopleListEvent())).toEqual({
      id: 'friends',
      name: 'Friends',
      description: 'Good people',
      image: 'https://example.com/friends.jpg',
      pubkey: OWNER,
      createdAt: 100,
      memberPubkeys: [ALICE, BOB],
    });
  });

  it('falls back to the d tag for an unnamed list', () => {
    const event = peopleListEvent({ tags: [['d', 'makers']] });
    expect(parsePeopleListFromEvent(event)?.name).toBe('makers');
  });

  it('accepts empty lists', () => {
    expect(parsePeopleListFromEvent(peopleListEvent({ tags: [
      ['d', 'makers'],
      ['title', 'Makers'],
    ] }))?.memberPubkeys).toEqual([]);
  });

  it('rejects missing d tags, the reserved block list, and other event kinds', () => {
    expect(parsePeopleListFromEvent(peopleListEvent({ tags: [] }))).toBeNull();
    expect(parsePeopleListFromEvent(peopleListEvent({ tags: [
      ['d', 'block'],
      ['title', 'Blocked'],
      ['p', ALICE],
    ] }))).toBeNull();
    expect(parsePeopleListFromEvent(peopleListEvent({ kind: 30005 }))).toBeNull();
  });

  it.each(['block', 'mute', 'hidden', 'denylist', 'dm-contacts'])(
    'rejects reserved public-list d tag %s',
    (id) => {
      expect(parsePeopleListFromEvent(peopleListEvent({ tags: [
        ['d', id],
        ['title', 'Reserved'],
        ['p', ALICE],
      ] }))).toBeNull();
    },
  );

  it('uses the complete addressable coordinate as its key', () => {
    const list = parsePeopleListFromEvent(peopleListEvent());
    expect(list && peopleListAddress(list)).toBe(`${OWNER}:30000:friends`);
  });
});

describe('deduplicatePeopleLists', () => {
  it('keeps the newest event for each owner and d tag', () => {
    const older = peopleListEvent({ created_at: 10, tags: [['d', 'friends'], ['title', 'Old']] });
    const newer = peopleListEvent({ created_at: 20, tags: [['d', 'friends'], ['title', 'New']] });
    const other = peopleListEvent({ created_at: 15, tags: [['d', 'makers']] });

    expect(deduplicatePeopleLists([older, other, newer]).map((list) => list.name)).toEqual([
      'New',
      'makers',
    ]);
  });

  it('uses the lowest event id as the tie-breaker for equal timestamps', () => {
    const higherId = peopleListEvent({
      id: 'f'.repeat(64),
      created_at: 20,
      tags: [['d', 'friends'], ['title', 'Higher']],
    });
    const lowerId = peopleListEvent({
      id: '0'.repeat(64),
      created_at: 20,
      tags: [['d', 'friends'], ['title', 'Lower']],
    });

    expect(deduplicatePeopleLists([higherId, lowerId])[0]?.name).toBe('Lower');
  });
});
