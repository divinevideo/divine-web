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
  it('is a pass-through for a non-restricted user', () => {
    const list = [convo('a', [HQ]), convo('b', [STRANGER])];
    expect(
      filterProtectedMinorConversations(list, {
        isProtectedMinor: false,
        isApproved,
      }),
    ).toBe(list);
  });

  it('keeps only conversations with an approved counterparty', () => {
    const list = [convo('a', [HQ]), convo('b', [STRANGER])];
    const out = filterProtectedMinorConversations(list, {
      isProtectedMinor: true,
      isApproved,
    });
    expect(out.map((c) => c.id)).toEqual(['a']);
  });

  it('drops a group unless every participant is approved', () => {
    const list = [convo('g', [HQ, OTHER])];
    const out = filterProtectedMinorConversations(list, {
      isProtectedMinor: true,
      isApproved,
    });
    expect(out).toEqual([]);
  });
});

describe('isThreadAllowedForProtectedMinor', () => {
  it('allows any thread for a non-restricted user', () => {
    expect(
      isThreadAllowedForProtectedMinor([STRANGER], {
        isProtectedMinor: false,
        isApproved,
      }),
    ).toBe(true);
  });

  it('allows a thread whose peers are all approved', () => {
    expect(
      isThreadAllowedForProtectedMinor([HQ], {
        isProtectedMinor: true,
        isApproved,
      }),
    ).toBe(true);
  });

  it('blocks a thread with any non-approved peer', () => {
    expect(
      isThreadAllowedForProtectedMinor([HQ, STRANGER], {
        isProtectedMinor: true,
        isApproved,
      }),
    ).toBe(false);
  });

  it('allows an empty peer set (nothing to reveal)', () => {
    expect(
      isThreadAllowedForProtectedMinor([], {
        isProtectedMinor: true,
        isApproved,
      }),
    ).toBe(true);
  });
});
