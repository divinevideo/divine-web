import { describe, expect, it } from 'vitest';
import type { DmConversation } from './dm';
import {
  filterProtectedMinorConversations,
  isThreadAllowedForProtectedMinor,
} from './dmInboundFilter';

const HQ = 'c4a39f1291291d452405cd8ddd798c4a29a3858c52cd0d843f1f6852cf17682e';
const STRANGER = 'de'.repeat(32);
const OTHER = '11'.repeat(32);

function convo(id: string, participants: string[]): DmConversation {
  return {
    id,
    participantPubkeys: participants,
    lastMessage: {} as DmConversation['lastMessage'],
    unreadCount: 0,
  };
}

const isApproved = (pubkey: string) => pubkey === HQ;

describe('filterProtectedMinorConversations', () => {
  it('is a pass-through for a positively not-protected user', () => {
    const list = [convo('a', [HQ]), convo('b', [STRANGER])];
    expect(
      filterProtectedMinorConversations(list, {
        state: 'not_protected',
        isApproved,
      }),
    ).toBe(list);
  });

  it('keeps only conversations with an approved counterparty', () => {
    const list = [convo('a', [HQ]), convo('b', [STRANGER])];
    const out = filterProtectedMinorConversations(list, {
      state: 'protected',
      isApproved,
    });
    expect(out.map((c) => c.id)).toEqual(['a']);
  });

  it('drops a group unless every participant is approved', () => {
    const list = [convo('g', [HQ, OTHER])];
    const out = filterProtectedMinorConversations(list, {
      state: 'protected',
      isApproved,
    });
    expect(out).toEqual([]);
  });

  it('fails closed on unknown: filters like protected', () => {
    const list = [convo('a', [HQ]), convo('b', [STRANGER])];
    const out = filterProtectedMinorConversations(list, {
      state: 'unknown',
      isApproved,
    });
    expect(out.map((c) => c.id)).toEqual(['a']);
  });
});

describe('isThreadAllowedForProtectedMinor', () => {
  it('allows any thread for a positively not-protected user', () => {
    expect(
      isThreadAllowedForProtectedMinor([STRANGER], {
        state: 'not_protected',
        isApproved,
      }),
    ).toBe(true);
  });

  it('allows a thread whose peers are all approved', () => {
    expect(
      isThreadAllowedForProtectedMinor([HQ], {
        state: 'protected',
        isApproved,
      }),
    ).toBe(true);
  });

  it('blocks a thread with any non-approved peer', () => {
    expect(
      isThreadAllowedForProtectedMinor([HQ, STRANGER], {
        state: 'protected',
        isApproved,
      }),
    ).toBe(false);
  });

  it('allows an empty peer set (nothing to reveal)', () => {
    expect(
      isThreadAllowedForProtectedMinor([], {
        state: 'protected',
        isApproved,
      }),
    ).toBe(true);
  });

  it('fails closed on unknown: blocks a thread with a non-approved peer', () => {
    expect(
      isThreadAllowedForProtectedMinor([STRANGER], {
        state: 'unknown',
        isApproved,
      }),
    ).toBe(false);
  });

  it('still allows an all-approved thread while unknown', () => {
    expect(
      isThreadAllowedForProtectedMinor([HQ], {
        state: 'unknown',
        isApproved,
      }),
    ).toBe(true);
  });
});
