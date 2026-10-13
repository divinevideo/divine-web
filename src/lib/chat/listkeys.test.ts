/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { describe, expect, it } from 'vitest';
import { hexToB64url, streamKeyFromListEntry, type ListEntry } from './protocol';
import fixtures from '../../../test-fixtures/concord/v1/fixtures.json';

const fx = fixtures as unknown as {
  communityList33302: { entries: ListEntry[] };
  derivations: { publicChannel: { pubkey: string }; privateChannel: { pubkey: string } };
  secrets: { channelKey: string };
};

describe('streamKeyFromListEntry (33302-held keys)', () => {
  it('resolves the public channel key from held community_root', () => {
    const entry = fx.communityList33302.entries[0] as ListEntry;
    const key = streamKeyFromListEntry(entry, entry.current.channels[0].id);
    expect(key?.pubkey).toBe(fx.derivations.publicChannel.pubkey);
    expect(key?.seed).toBeDefined();
  });
  it('resolves the private channel key from the held channel key', () => {
    const base = fx.communityList33302.entries[0] as ListEntry;
    const entry: ListEntry = JSON.parse(JSON.stringify(base)) as ListEntry;
    entry.current.channels[0].key = hexToB64url(fx.secrets.channelKey);
    entry.current.channels[0].epoch = 1;
    const key = streamKeyFromListEntry(entry, entry.current.channels[0].id);
    expect(key?.pubkey).toBe(fx.derivations.privateChannel.pubkey);
  });
  it('returns null for a channel the list does not hold', () => {
    const entry = fx.communityList33302.entries[0] as ListEntry;
    expect(streamKeyFromListEntry(entry, hexToB64url('ab'.repeat(32)))).toBeNull();
  });
});
