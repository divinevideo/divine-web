// ABOUTME: Unit tests for parsing public NIP-51 kind 30000 people lists

import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  deduplicatePeopleLists,
  isReservedListDTag,
  parsePeopleListFromEvent,
  PEOPLE_LIST_KIND,
  peopleListAddress,
} from './parsePeopleListFromEvent';

const OWNER = 'a'.repeat(64);
const ALICE = 'b'.repeat(64);
const BOB = 'c'.repeat(64);
const CAROL = 'f'.repeat(64);

function peopleListEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'd'.repeat(64),
    pubkey: OWNER,
    kind: PEOPLE_LIST_KIND,
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

  it('rejects missing d tags, the reserved block list, and other event kinds', () => {
    expect(parsePeopleListFromEvent(peopleListEvent({ tags: [] }))).toBeNull();
    expect(parsePeopleListFromEvent(peopleListEvent({ tags: [['d', 'block']] }))).toBeNull();
    expect(parsePeopleListFromEvent(peopleListEvent({ kind: 30005 }))).toBeNull();
  });

  it('filters normalized system d tags without hiding curated lists', () => {
    expect(parsePeopleListFromEvent(peopleListEvent({ tags: [['d', ' Block ']] }))).toBeNull();
    expect(parsePeopleListFromEvent(peopleListEvent({ tags: [['d', 'close-friends']] }))?.id).toBe(
      'close-friends',
    );
  });

  it('ignores invalid p tags', () => {
    const event = peopleListEvent({
      tags: [
        ['d', 'friends'],
        ['p', ALICE],
        ['p', 'not-a-pubkey'],
        ['p', 'g'.repeat(64)],
        ['p', CAROL],
      ],
    });

    expect(parsePeopleListFromEvent(event)?.memberPubkeys).toEqual([ALICE, CAROL]);
  });

  it('uses the complete addressable coordinate as its key', () => {
    const list = parsePeopleListFromEvent(peopleListEvent());
    expect(list && peopleListAddress(list)).toBe(`30000:${OWNER}:friends`);
  });
});

describe('isReservedListDTag', () => {
  it('matches reserved d tags after trimming and case folding', () => {
    const reservedDTags = [
      'mute',
      'Mute',
      'mutelist',
      'mute-list',
      'mute list',
      'muted',
      'block',
      'Block List',
      'block-list',
      'blocklist',
      'blocked',
      'dm-contacts',
      'dm contacts',
      'dmcontacts',
      'hidden',
      'denylist',
    ];

    reservedDTags.forEach((dTag) => expect(isReservedListDTag(` ${dTag} `)).toBe(true));
    expect(isReservedListDTag('friends')).toBe(false);
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
});
