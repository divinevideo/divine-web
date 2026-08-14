import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

import {
  countContactListFollows,
  selectContactListForPublish,
} from './contactListSelection';

const USER_PUBKEY = 'aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344';

function event(pubkeys: string[], createdAt: number): NostrEvent {
  return {
    id: `event-${createdAt}-${pubkeys.length}`,
    pubkey: USER_PUBKEY,
    created_at: createdAt,
    kind: 3,
    tags: pubkeys.map(pubkey => ['p', pubkey, '', '']),
    content: '',
    sig: 'sig',
  };
}

describe('selectContactListForPublish', () => {
  it('returns null when neither side has a contact list', () => {
    const result = selectContactListForPublish(null, null);

    expect(result.chosen).toBeNull();
    expect(result.reason).toBe('no contact list available');
  });

  it('uses relay when passed contact list is missing', () => {
    const relay = event(['a'.repeat(64)], 100);

    const result = selectContactListForPublish(null, relay);

    expect(result.chosen).toBe(relay);
  });

  it('uses passed when relay contact list is missing', () => {
    const passed = event(['a'.repeat(64)], 100);

    const result = selectContactListForPublish(passed, null);

    expect(result.chosen).toBe(passed);
  });

  it('uses newer relay contact list even when it removed a follow', () => {
    const removedPubkey = 'b'.repeat(64);
    const keptPubkey = 'a'.repeat(64);
    const passed = event([keptPubkey, removedPubkey], 100);
    const relay = event([keptPubkey], 200);

    const result = selectContactListForPublish(passed, relay);

    expect(result.chosen).toBe(relay);
    expect(result.reason).toBe('relay contact list is newer');
  });

  it('uses newer relay contact list when it both adds and removes follows', () => {
    const passed = event(['a'.repeat(64), 'b'.repeat(64)], 100);
    const relay = event(['b'.repeat(64), 'c'.repeat(64)], 200);

    const result = selectContactListForPublish(passed, relay);

    expect(result.chosen).toBe(relay);
  });

  it('uses newer passed contact list', () => {
    const passed = event(['a'.repeat(64), 'b'.repeat(64)], 200);
    const relay = event(['a'.repeat(64)], 100);

    const result = selectContactListForPublish(passed, relay);

    expect(result.chosen).toBe(passed);
    expect(result.reason).toBe('passed contact list is newer');
  });

  it('uses relay when timestamps are equal even if passed has more follows', () => {
    const passed = event(['a'.repeat(64), 'b'.repeat(64)], 100);
    const relay = event(['a'.repeat(64)], 100);

    const result = selectContactListForPublish(passed, relay);

    expect(result.chosen).toBe(relay);
    expect(result.reason).toBe('contact lists have equal timestamps; using relay copy');
  });

  it('uses relay on equal timestamp when relay has the same number of follows', () => {
    const passed = event(['a'.repeat(64)], 100);
    const relay = event(['b'.repeat(64)], 100);

    const result = selectContactListForPublish(passed, relay);

    expect(result.chosen).toBe(relay);
    expect(result.reason).toBe('contact lists have equal timestamps; using relay copy');
  });
});

describe('countContactListFollows', () => {
  it('counts only p tags', () => {
    const contactList = {
      ...event(['a'.repeat(64)], 100),
      tags: [
        ['p', 'a'.repeat(64), '', ''],
        ['relay', 'wss://relay.divine.video'],
      ],
    };

    expect(countContactListFollows(contactList)).toBe(1);
    expect(countContactListFollows(null)).toBe(0);
  });
});
