import { describe, expect, it } from 'vitest';

import {
  DIVINE_SUPPORT_PUBKEY,
  getDmConversationPath,
  type DmConversation,
  type DmMessage,
} from '@/lib/dm';
import {
  assertSupportOnlyDmRecipients,
  DmSupportOnlyError,
  filterSupportOnlyDmConversations,
  filterSupportOnlyDmMessages,
  getSupportDmConversationPath,
  isSupportDmRecipient,
  isSupportOnlyDmPeerSet,
  SUPPORT_ONLY_DM_ERROR_MESSAGE,
} from '@/lib/dmAccessPolicy';

const OTHER_PUBKEY = 'ab'.repeat(32);

function message(id: string, peerPubkeys: string[]): DmMessage {
  return {
    conversationId: `conversation-${id}`,
    wrapId: `wrap-${id}`,
    rumorId: `rumor-${id}`,
    senderPubkey: OTHER_PUBKEY,
    participantPubkeys: peerPubkeys,
    peerPubkeys,
    content: 'Need help',
    createdAt: 1,
    isOutgoing: false,
  };
}

function conversation(id: string, participantPubkeys: string[]): DmConversation {
  return {
    id,
    participantPubkeys,
    lastMessage: message(id, participantPubkeys),
    unreadCount: 0,
  };
}

describe('support-only DM access policy', () => {
  it('allows only the Support recipient and exact single-peer set', () => {
    expect(isSupportDmRecipient(DIVINE_SUPPORT_PUBKEY)).toBe(true);
    expect(isSupportDmRecipient(OTHER_PUBKEY)).toBe(false);
    expect(isSupportOnlyDmPeerSet([DIVINE_SUPPORT_PUBKEY])).toBe(true);
    expect(isSupportOnlyDmPeerSet([])).toBe(false);
    expect(isSupportOnlyDmPeerSet([OTHER_PUBKEY])).toBe(false);
    expect(isSupportOnlyDmPeerSet([DIVINE_SUPPORT_PUBKEY, OTHER_PUBKEY])).toBe(false);
  });

  it('throws the typed error for peer sets other than Support alone', () => {
    expect(() => assertSupportOnlyDmRecipients([OTHER_PUBKEY])).toThrow(DmSupportOnlyError);
    expect(() => assertSupportOnlyDmRecipients([OTHER_PUBKEY])).toThrow(SUPPORT_ONLY_DM_ERROR_MESSAGE);
  });

  it('retains only Support messages', () => {
    const supportMessage = message('support', [DIVINE_SUPPORT_PUBKEY]);
    const messages = [
      supportMessage,
      message('empty', []),
      message('other', [OTHER_PUBKEY]),
      message('group', [DIVINE_SUPPORT_PUBKEY, OTHER_PUBKEY]),
    ];

    expect(filterSupportOnlyDmMessages(messages)).toEqual([supportMessage]);
  });

  it('retains only Support conversations', () => {
    const supportConversation = conversation('support', [DIVINE_SUPPORT_PUBKEY]);
    const conversations = [
      supportConversation,
      conversation('empty', []),
      conversation('other', [OTHER_PUBKEY]),
      conversation('group', [DIVINE_SUPPORT_PUBKEY, OTHER_PUBKEY]),
    ];

    expect(filterSupportOnlyDmConversations(conversations)).toEqual([supportConversation]);
  });

  it('uses the canonical Support conversation path', () => {
    expect(getSupportDmConversationPath()).toBe(getDmConversationPath([DIVINE_SUPPORT_PUBKEY]));
  });
});
