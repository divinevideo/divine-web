// src/types/peopleList.test.ts
import { describe, it, expect } from 'vitest';
import { parsePeopleList } from './peopleList';
import type { NostrEvent } from '@nostrify/nostrify';

const PUBKEY = 'a'.repeat(64);
const MEMBER_A = 'b'.repeat(64);
const MEMBER_B = 'c'.repeat(64);

function makeEvent(tags: string[][], created_at = 1000): NostrEvent {
  return {
    id: 'x'.repeat(64),
    kind: 30000,
    pubkey: PUBKEY,
    created_at,
    tags,
    content: '',
    sig: 'y'.repeat(128),
  };
}

describe('parsePeopleList', () => {
  it('returns null when no d-tag', () => {
    expect(parsePeopleList(makeEvent([['title', 'X']]))).toBeNull();
  });

  it('parses minimal event', () => {
    const list = parsePeopleList(makeEvent([['d', 'close-friends']]));
    expect(list).toEqual({
      id: 'close-friends',
      pubkey: PUBKEY,
      name: 'close-friends', // falls back to d-tag
      description: undefined,
      image: undefined,
      members: [],
      createdAt: 1000,
    });
  });

  it.each([
    ['mute'],
    ['Mute'],
    ['mutelist'],
    ['mute-list'],
    ['muted'],
    ['block'],
    ['Block List'],
    ['block-list'],
    ['blocklist'],
    ['dm-contacts'],
    ['dm contacts'],
    ['hidden'],
    ['denylist'],
  ])('returns null for reserved system d-tag %p', (dTag) => {
    expect(parsePeopleList(makeEvent([['d', dTag]]))).toBeNull();
    expect(parsePeopleList(makeEvent([['d', dTag], ['title', 'X']]))).toBeNull();
  });

  it('still parses real curated lists with normal d-tags', () => {
    const list = parsePeopleList(makeEvent([['d', 'close-friends'], ['title', 'Close Friends']]));
    expect(list).not.toBeNull();
    expect(list?.name).toBe('Close Friends');
  });

  it('parses full event with members', () => {
    const list = parsePeopleList(makeEvent([
      ['d', 'team'],
      ['title', 'Divine Team'],
      ['description', 'the crew'],
      ['image', 'https://example/cover.png'],
      ['p', MEMBER_A],
      ['p', MEMBER_B],
      ['p', 'invalid'],          // dropped: not 64 hex
      ['p', MEMBER_A],            // dropped: dedupe
    ]));
    expect(list?.members).toEqual([MEMBER_A, MEMBER_B]);
    expect(list?.name).toBe('Divine Team');
    expect(list?.description).toBe('the crew');
    expect(list?.image).toBe('https://example/cover.png');
  });
});
