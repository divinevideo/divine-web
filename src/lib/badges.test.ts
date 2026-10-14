import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

import {
  BADGE_KINDS,
  isProfileBadgesEvent,
  parseProfileBadges,
  selectProfileBadgesEvent,
} from './badges';

const USER_PUBKEY = 'a'.repeat(64);

function makeEvent(opts: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'f'.repeat(64),
    pubkey: USER_PUBKEY,
    created_at: 1_700_000_000,
    kind: BADGE_KINDS.PROFILE_BADGES,
    tags: [],
    content: '',
    sig: '0'.repeat(128),
    ...opts,
  };
}

describe('profile badge parsing', () => {
  it('parses adjacent a/e pairs from kind 10008 profile badges', () => {
    const event = makeEvent({
      kind: 10008,
      tags: [
        ['a', `30009:${USER_PUBKEY}:one`],
        ['e', '1'.repeat(64)],
        ['a', `30009:${USER_PUBKEY}:two`],
        ['e', '2'.repeat(64)],
      ],
    });

    expect(parseProfileBadges(event)).toEqual([
      { naddr: `30009:${USER_PUBKEY}:one`, awardId: '1'.repeat(64) },
      { naddr: `30009:${USER_PUBKEY}:two`, awardId: '2'.repeat(64) },
    ]);
  });

  it('parses legacy kind 30008 profile_badges events', () => {
    const event = makeEvent({
      kind: 30008,
      tags: [
        ['d', 'profile_badges'],
        ['a', `30009:${USER_PUBKEY}:legacy`],
        ['e', '3'.repeat(64)],
      ],
    });

    expect(isProfileBadgesEvent(event)).toBe(true);
    expect(parseProfileBadges(event)).toEqual([
      { naddr: `30009:${USER_PUBKEY}:legacy`, awardId: '3'.repeat(64) },
    ]);
  });

  it('rejects legacy kind 30008 events without d=profile_badges', () => {
    const event = makeEvent({
      kind: 30008,
      tags: [
        ['d', 'other_badge_set'],
        ['a', `30009:${USER_PUBKEY}:other`],
        ['e', '4'.repeat(64)],
      ],
    });

    expect(isProfileBadgesEvent(event)).toBe(false);
    expect(parseProfileBadges(event)).toEqual([]);
  });

  it('pairs only adjacent a/e tags', () => {
    const event = makeEvent({
      kind: 10008,
      tags: [
        ['a', `30009:${USER_PUBKEY}:orphaned`],
        ['a', `30009:${USER_PUBKEY}:paired`],
        ['e', '5'.repeat(64)],
      ],
    });

    expect(parseProfileBadges(event)).toEqual([
      { naddr: `30009:${USER_PUBKEY}:paired`, awardId: '5'.repeat(64) },
    ]);
  });
});

describe('selectProfileBadgesEvent', () => {
  it('selects the newest profile badges event', () => {
    const older = makeEvent({ id: '2'.repeat(64), kind: 10008, created_at: 10 });
    const newer = makeEvent({
      id: '1'.repeat(64),
      kind: 30008,
      created_at: 20,
      tags: [['d', 'profile_badges']],
    });

    expect(selectProfileBadgesEvent([older, newer])).toBe(newer);
  });

  it('prefers kind 10008 when timestamps tie', () => {
    const legacy = makeEvent({
      id: '1'.repeat(64),
      kind: 30008,
      created_at: 10,
      tags: [['d', 'profile_badges']],
    });
    const current = makeEvent({ id: '2'.repeat(64), kind: 10008, created_at: 10 });

    expect(selectProfileBadgesEvent([legacy, current])).toBe(current);
  });

  it('uses lowest event id as the final tie-break', () => {
    const higher = makeEvent({ id: 'f'.repeat(64), kind: 10008, created_at: 10 });
    const lower = makeEvent({ id: '0'.repeat(64), kind: 10008, created_at: 10 });

    expect(selectProfileBadgesEvent([higher, lower])).toBe(lower);
  });

  it('returns null when no profile badges event exists', () => {
    const otherSet = makeEvent({
      kind: 30008,
      tags: [['d', 'other_badge_set']],
    });

    expect(selectProfileBadgesEvent([otherSet])).toBeNull();
  });
});
