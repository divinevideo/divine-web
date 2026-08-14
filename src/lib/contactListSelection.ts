import type { NostrEvent } from '@nostrify/nostrify';

export interface ContactListSelection {
  chosen: NostrEvent | null;
  reason: string;
}

export function countContactListFollows(event: NostrEvent | null): number {
  return event?.tags.filter(tag => tag[0] === 'p').length ?? 0;
}

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

  const relayFollowCount = countContactListFollows(relay);
  const passedFollowCount = countContactListFollows(passed);

  if (relayFollowCount >= passedFollowCount) {
    return {
      chosen: relay,
      reason: 'contact lists have equal timestamps and relay has at least as many follows',
    };
  }

  return {
    chosen: passed,
    reason: 'contact lists have equal timestamps and passed has more follows',
  };
}
