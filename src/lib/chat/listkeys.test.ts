/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { describe, expect, it } from 'vitest';
import { b64urlToHex, heldStream, hexToB64url, streamKeyFromListEntry, type ListEntry } from './protocol';
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
  it('resolves the held key from the community named in the route, not the first held entry', () => {
    const a = fx.communityList33302.entries[0] as ListEntry;
    const b: ListEntry = JSON.parse(JSON.stringify(a)) as ListEntry;
    b.community_id = hexToB64url('cd'.repeat(32));
    b.current.community_root = hexToB64url('ef'.repeat(32));
    const entries = [a, b];
    const expected = streamKeyFromListEntry(b, b.current.channels[0].id)?.pubkey;
    expect(expected).not.toBe(streamKeyFromListEntry(a, a.current.channels[0].id)?.pubkey);
    expect(heldStream(entries, b.community_id, 'general')?.key.pubkey).toBe(expected);
    expect(heldStream(entries, b64urlToHex(b.community_id), 'general')?.key.pubkey).toBe(expected);
    expect(heldStream(entries, 'demo-community', 'general')).toBeNull();
    expect(heldStream(entries, undefined, 'general')).toBeNull();
  });
  it('binds held-channel rumors to the canonical hex channel id and the key epoch', () => {
    const fxr = fixtures as unknown as { rumors: { message: { tags: string[][] } } };
    const base = fx.communityList33302.entries[0] as ListEntry;
    const pub = heldStream([base], base.community_id, 'general');
    expect(pub?.channelId).toBe(fxr.rumors.message.tags.find((t) => t[0] === 'channel')?.[1]);
    expect(pub?.epoch).toBe(0);
    const priv: ListEntry = JSON.parse(JSON.stringify(base)) as ListEntry;
    priv.current.channels[0].key = hexToB64url(fx.secrets.channelKey);
    priv.current.channels[0].epoch = 1;
    expect(heldStream([priv], priv.community_id, 'general')?.epoch).toBe(1);
  });
});
