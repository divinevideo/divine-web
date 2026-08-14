import type { NostrEvent } from '@nostrify/nostrify';

export interface ContactListSelection {
  chosen: NostrEvent | null;
  reason: string;
}

export function countContactListFollows(event: NostrEvent | null): number {
  return event?.tags.filter(tag => tag[0] === 'p').length ?? 0;
}

/**
 * Selects the contact list to extend for a follow-list publish.
 *
 * Newer strictly beats larger: a newer kind 3 with fewer `p` tags can be an
 * intentional removal, and keeping an older larger list would republish the
 * removed follow. A truncation guard should be added separately if evidence
 * shows newer clients are publishing partial kind 3 events.
 */
export function selectContactListForPublish(
  passed: NostrEvent | null,
  relay: NostrEvent | null
): ContactListSelection {
  if (!passed && !relay) {
    return { chosen: null, reason: 'no contact list available' };
  }

  if (!passed) {
    return { chosen: relay, reason: 'only relay contact list is available' };
  }

  if (!relay) {
    return { chosen: passed, reason: 'only passed contact list is available' };
  }

  if (relay.created_at > passed.created_at) {
    return { chosen: relay, reason: 'relay contact list is newer' };
  }

  if (passed.created_at > relay.created_at) {
    return { chosen: passed, reason: 'passed contact list is newer' };
  }

  return {
    chosen: relay,
    reason: 'contact lists have equal timestamps; using relay copy',
  };
}
