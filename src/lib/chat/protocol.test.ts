/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { describe, expect, it } from 'vitest';
import fixtures from '../../../test-fixtures/concord/v1/fixtures.json';
import {
  canPost, deriveChannelId, deriveCommunityId, deriveStreamId, foldControlLog, isExpired,
  messagePayload, openStreamEnvelope, packCommunityListFragment, probeSignerCapabilities,
  sealStreamEnvelope, sha256Hex, stampExpiry, unpackCommunityListFragment, type Nip44Cipher,
} from './protocol';
import { parseInviteHash } from './invite';
import { ChatStore, chatQueryScope } from './store';

const fakeCipher: Nip44Cipher = { encrypt: async (_p, text) => `enc:${text}`, decrypt: async (_p, c) => c.replace(/^enc:/, '') };

describe('concord protocol (fixtures shared with Dart)', () => {
  it('matches pinned sha256 + derivations', () => {
    for (const v of fixtures.sha256Vectors) expect(sha256Hex(v.input)).toBe(v.expected);
    const alicePub = fixtures.identities.alice.pubkey;
    // derivations use owner secret-derived pubkey? fixture community derives from secret hex alice id
    expect(deriveCommunityId(fixtures.identities.alice.secret, 'test-community')).toBe(fixtures.derivations.communityId);
    expect(deriveChannelId(fixtures.derivations.communityId, 'general')).toBe(fixtures.derivations.channelId);
    expect(deriveStreamId(fixtures.derivations.communityId, fixtures.derivations.channelId)).toBe(fixtures.derivations.streamId);
    expect(alicePub).toHaveLength(64);
  });
  it('payload + expiry', () => {
    expect(messagePayload(fixtures.derivations.channelId, 'hello', 'seed-1')).toEqual(fixtures.payloads.message);
    const stamped = stampExpiry({ a: 1 }, fixtures.expiry.ttlSeconds, fixtures.expiry.stampedAt);
    expect(stamped.exp).toBe(fixtures.expiry.exp);
    expect(isExpired(stamped, fixtures.expiry.expiredAt)).toBe(true);
    expect(isExpired(stamped, 1200)).toBe(false);
  });
  it('control fold bans + rejects unauthorised', () => {
    const state = foldControlLog(fixtures.controlFold.owner, fixtures.controlFold.events as never);
    expect(state.bans).toEqual(fixtures.controlFold.expectedBans);
    expect(canPost(state, fixtures.identities.bob.pubkey)).toBe(false);
    const bad = foldControlLog('owner', [{ seq: 1, actor: 'mallory', authorityEventId: 'e1', action: { kind: 'ban', pubkey: 'x' } }]);
    expect(bad.rejected).toEqual([{ seq: 1, reason: 'actor-not-authorised' }]);
  });
  it('33302 pack/unpack preserves unknown fields', () => {
    const packed = packCommunityListFragment(fixtures.communityList33302);
    expect(packed.kind).toBe(33302);
    expect(unpackCommunityListFragment(packed)).toEqual(fixtures.communityList33302);
  });
  it('stream envelope seal/open distinct from NIP-59, expiry enforced', async () => {
    const payload = messagePayload('chan', 'hi', 's1');
    const env = await sealStreamEnvelope(fakeCipher, 'peer', 'stream-1', 1, payload, 300, 1000);
    expect(env.alg).toBe('concord-stream-nip44-v1');
    await expect(openStreamEnvelope(fakeCipher, 'peer', env, 1100)).resolves.toEqual(payload);
    await expect(openStreamEnvelope(fakeCipher, 'peer', env, 9999)).rejects.toThrow(/expired/);
  });
  it('signer probe records nip44 gap, no new signer', () => {
    expect(probeSignerCapabilities(undefined).gap).toMatch(/logged out/);
    expect(probeSignerCapabilities({ getPublicKey: async () => 'a'.repeat(64), signEvent: async () => ({}), nip44: fakeCipher } as never).nip44).toBe(true);
    expect(probeSignerCapabilities({ getPublicKey: async () => 'a'.repeat(64), signEvent: async () => ({}) } as never).gap).toMatch(/nip44/);
  });
  it('invite fragment parse + account-scoped store isolation', () => {
    expect(parseInviteHash('#community=c1&invite=secret')).toEqual({ communityId: 'c1', code: 'secret' });
    expect(parseInviteHash('#other=1')).toBeNull();
    const a = new ChatStore('a'.repeat(64)); a.addMessage({ type: 'message', id: '1', channelId: 'c', body: 'x', author: 'a' });
    let cancelled = false; a.onCleanup(() => { cancelled = true; }); a.dispose();
    expect(cancelled).toBe(true); expect(a.messages).toEqual([]);
    expect(chatQueryScope('pk')).toBe('chat:v1:pk');
  });
});
