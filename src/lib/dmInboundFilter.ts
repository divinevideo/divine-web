// ABOUTME: Pure inbound-DM filter for the protected-minor restriction (#176 web):
// ABOUTME: a DM-restricted user (protected minor, or unknown status — fail closed)
// ABOUTME: sees only conversations whose EVERY participant is an approved official.

import type { DmConversation } from './dm';
import { isMinorDmRestricted, type ProtectedMinorState } from './protectedMinor';

/**
 * Filters [conversations] to those a DM-restricted user may see. Pass-through
 * for a positive `not_protected` verdict; `unknown` restricts like `protected`.
 * A group needs ALL participants approved (participantPubkeys excludes self),
 * else an attacker could p-tag the minor with a pinned decoy to slip content
 * through.
 */
export function filterProtectedMinorConversations(
  conversations: DmConversation[],
  opts: {
    state: ProtectedMinorState;
    isApproved: (pubkey: string) => boolean;
  },
): DmConversation[] {
  if (!isMinorDmRestricted(opts.state)) return conversations;
  return conversations.filter((conversation) =>
    conversation.participantPubkeys.every(opts.isApproved),
  );
}

/**
 * Whether a DM-restricted user may view a single thread (all peers approved).
 * Applied INSIDE the thread hook to clear the messages — defense-in-depth
 * alongside the route guard, which redirects asynchronously and could otherwise
 * flash history first. Empty peers (nothing loaded yet) is allowed — there's
 * nothing to evaluate or reveal.
 */
export function isThreadAllowedForProtectedMinor(
  peerPubkeys: string[],
  opts: {
    state: ProtectedMinorState;
    isApproved: (pubkey: string) => boolean;
  },
): boolean {
  if (!isMinorDmRestricted(opts.state)) return true;
  if (peerPubkeys.length === 0) return true;
  return peerPubkeys.every(opts.isApproved);
}
