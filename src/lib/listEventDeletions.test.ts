import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { excludeDeletedListEvents } from './listEventDeletions';

const owner = 'a'.repeat(64);
const stranger = 'b'.repeat(64);

function event(overrides: Partial<NostrEvent>): NostrEvent {
  return {
    id: '0'.repeat(64),
    pubkey: owner,
    kind: 30005,
    created_at: 100,
    tags: [['d', 'saved']],
    content: '',
    sig: 'f'.repeat(128),
    ...overrides,
  };
}

const list = event({ id: '1'.repeat(64) });
const address = `30005:${owner}:saved`;

function deletion(tags: string[][], overrides: Partial<NostrEvent> = {}): NostrEvent {
  return event({ id: '2'.repeat(64), kind: 5, created_at: 200, tags, ...overrides });
}

describe('excludeDeletedListEvents', () => {
  it('hides a list whose event id its owner deleted', () => {
    expect(excludeDeletedListEvents([list], [deletion([['e', list.id]])])).toEqual([]);
  });

  it('ignores deletion requests from anyone but the owner', () => {
    const forged = [
      deletion([['e', list.id]], { pubkey: stranger }),
      deletion([['a', address]], { pubkey: stranger }),
    ];
    expect(excludeDeletedListEvents([list], forged)).toEqual([list]);
  });

  it('hides versions up to the latest address deletion and keeps later recreations', () => {
    const recreated = event({ id: '3'.repeat(64), created_at: 250 });
    const deletions = [
      deletion([['a', address]], { id: '5'.repeat(64), created_at: 200 }),
      deletion([['a', address]], { id: '4'.repeat(64), created_at: 150 }),
    ];
    const atDeletion = event({ id: '6'.repeat(64), created_at: 200 });

    expect(excludeDeletedListEvents([list, atDeletion, recreated], deletions)).toEqual([recreated]);
  });

  it('matches the address by d tag and kind', () => {
    const other = event({ id: '7'.repeat(64), tags: [['d', 'other']] });
    const peopleList = event({ id: '8'.repeat(64), kind: 30000 });

    expect(excludeDeletedListEvents([list, other, peopleList], [deletion([['a', address]])]))
      .toEqual([other, peopleList]);
  });

  it('passes non-list events through and ignores events that are not deletions', () => {
    const video = event({ id: '9'.repeat(64), kind: 34236 });
    const notADeletion = event({ id: 'c'.repeat(64), kind: 1, tags: [['e', list.id], ['a', address]] });

    expect(excludeDeletedListEvents([list, video], [notADeletion, deletion([['e', video.id]])]))
      .toEqual([list, video]);
  });
});
