import {
  DIVINE_SUPPORT_PUBKEY,
  getDmConversationPath,
  type DmConversation,
  type DmMessage,
} from '@/lib/dm';

export const SUPPORT_ONLY_DM_ERROR_MESSAGE = 'For now, you can only message Divine Support.';

export class DmSupportOnlyError extends Error {
  constructor() {
    super(SUPPORT_ONLY_DM_ERROR_MESSAGE);
    this.name = 'DmSupportOnlyError';
  }
}

export function isSupportDmRecipient(pubkey: string): boolean {
  return pubkey === DIVINE_SUPPORT_PUBKEY;
}

export function isSupportOnlyDmPeerSet(pubkeys: string[]): boolean {
  return pubkeys.length === 1 && isSupportDmRecipient(pubkeys[0]);
}

/**
 * Throws unless the recipient set is exactly Divine Support. An empty list is
 * NOT valid here — callers must handle "no recipients" (e.g. their own
 * "choose at least one person" error) before calling, or it will surface as a
 * support-only violation.
 */
export function assertSupportOnlyDmRecipients(recipients: string[]): void {
  if (!isSupportOnlyDmPeerSet(recipients)) {
    throw new DmSupportOnlyError();
  }
}

export function filterSupportOnlyDmMessages(messages: DmMessage[]): DmMessage[] {
  return messages.filter((message) => isSupportOnlyDmPeerSet(message.peerPubkeys));
}

export function filterSupportOnlyDmConversations(conversations: DmConversation[]): DmConversation[] {
  return conversations.filter((conversation) => isSupportOnlyDmPeerSet(conversation.participantPubkeys));
}

export function getSupportDmConversationPath(): string {
  return getDmConversationPath([DIVINE_SUPPORT_PUBKEY]);
}
