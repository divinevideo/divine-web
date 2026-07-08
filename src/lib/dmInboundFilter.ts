// ABOUTME: Pure inbound-DM filter for the protected-minor restriction (#176 web):
// ABOUTME: a protected minor sees only conversations whose EVERY participant is
// ABOUTME: an approved official account. Injectable predicate so it's testable.

import type { DmConversation } from './dm';

/**
 * Filters [conversations] to those a protected minor may see. Pass-through when
 * not restricted. A group needs ALL participants approved (participantPubkeys
 * excludes self), else an attacker could p-tag the minor with a pinned decoy to
 * slip content through.
 */
export function filterProtectedMinorConversations(
  conversations: DmConversation[],
  opts: {
    isProtectedMinor: boolean;
    isApproved: (pubkey: string) => boolean;
  },
): DmConversation[] {
  if (!opts.isProtectedMinor) return conversations;
  return conversations.filter((conversation) =>
    conversation.participantPubkeys.every(opts.isApproved),
  );
}

/**
 * Whether a protected minor may view a single thread (all peers approved).
 * Applied INSIDE the thread hook to clear the messages — defense-in-depth
 * alongside the route guard, which redirects asynchronously and could otherwise
 * flash history first. Empty peers (nothing loaded yet) is allowed — there's
 * nothing to evaluate or reveal.
 */
export function isThreadAllowedForProtectedMinor(
  peerPubkeys: string[],
  opts: {
    isProtectedMinor: boolean;
    isApproved: (pubkey: string) => boolean;
  },
): boolean {
  if (!opts.isProtectedMinor) return true;
  if (peerPubkeys.length === 0) return true;
  return peerPubkeys.every(opts.isApproved);
}
