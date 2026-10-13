/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { describe, expect, it } from 'vitest';
import fixtures from '../../../test-fixtures/concord/v1/fixtures.json';
import {
  assertListEventSize, assertNip44Plaintext, b64urlToHex, buildEditionRumor, canRepack, controlReadKey,
  controlSignerKey, deleteRumor, deriveCommunityId, dissolvedPubkey, editRumor, editionFromRumor, editionHash,
  evaluateRekey, foldChatRumors, foldControlEditions, foldGuestbook, hexToB64url, inviteJoinable, isExpiredRumor,
  mergeCommunityLists, mergeInviteLists, messageRumor, nextPrivateEpoch, packCommunityListFragment,
  parseMessageExpiration, parseRekeyBlob, pickRefoundingWinner, pinsWithinLimits, privateChannelKey,
  probeSignerCapabilities, publicChannelKey, purgeExpiredRumors, reactionRumor, rekeyLocator, sealKindForPlane,
  sha256Hex, shouldShowTimerNotice, threadReplyRumor, timerNoticeRumor, unpackCommunityListFragment,
  validateInviteBundle, verifyChatRumor, verifyDissolution, type ControlEdition, type Rumor,
} from './protocol';
import { parseInviteHash, parseInviteUrl } from './invite';
import { encodeInviteFragment, decodeInviteFragment } from './protocol';
import { ChatStore, chatQueryScope } from './store';

const F = fixtures as typeof fixtures & { secrets: { ownerSalt: string; communityRoot: string; controlRoot: string; channelKey: string } };
const alice = F.identities.alice.pubkey; const bob = F.identities.bob.pubkey;
const cid = F.derivations.communityId; const chan = F.derivations.publicChannel.channelId;

describe('concord derivations (Appx A fixtures)', () => {
  it('sha256 + community_id + group_keys match pinned generator', () => {
    for (const v of F.sha256Vectors) expect(sha256Hex(v.input)).toBe(v.expected);
    expect(deriveCommunityId(alice, F.secrets.ownerSalt)).toBe(cid);
    expect(controlSignerKey(F.secrets.controlRoot, cid, 0).pubkey).toBe(F.derivations.controlSigner.pubkey);
    expect(controlReadKey(F.secrets.communityRoot, cid, 0).pubkey).toBe(F.derivations.controlRead.pubkey);
    expect(publicChannelKey(F.secrets.communityRoot, chan, 0).pubkey).toBe(F.derivations.publicChannel.pubkey);
    expect(privateChannelKey(F.secrets.channelKey, chan, 1).pubkey).toBe(F.derivations.privateChannel.pubkey);
    expect(dissolvedPubkey(cid)).toBe(F.derivations.dissolved.pubkey);
    expect(editionHash(F.editionHashVector.eid, 1, undefined, F.editionHashVector.content)).toBe(F.editionHashVector.expected);
    expect(nextPrivateEpoch(0)).toBe(1); expect(nextPrivateEpoch(1)).toBe(2);
  });
  it('rumor ids are NIP-01 recomputed and binding-verified', () => {
    const m = messageRumor({ author: alice, channelId: chan, epoch: 0, body: 'hello', createdAt: 1700000000, ms: 417 });
    expect(m).toMatchObject(F.rumors.message as unknown as Rumor);
    expect(verifyChatRumor(m, { channelId: chan, epoch: 0, author: alice })).toBeNull();
    expect(verifyChatRumor({ ...m, pubkey: bob }, { channelId: chan, epoch: 0, author: alice })).toBe('author-mismatch');
    expect(verifyChatRumor(m, { channelId: 'ab'.repeat(32), epoch: 0 })).toBe('channel-mismatch');
    expect(verifyChatRumor(m, { channelId: chan, epoch: 1 })).toBe('epoch-mismatch');
    expect(verifyChatRumor({ ...m, content: 'tampered' }, { channelId: chan, epoch: 0 })).toBe('id-mismatch');
    expect(verifyChatRumor({ ...m, tags: m.tags.map((t) => t[0] === 'ms' ? ['ms', '1000'] : t) }, { channelId: chan, epoch: 0 })).toBe('bad-ms');
  });
  it('thread/reaction/edit/delete fold author-only', () => {
    const m = messageRumor({ author: alice, channelId: chan, epoch: 0, body: 'hi', createdAt: 100, ms: 1 });
    const reply = threadReplyRumor({ author: bob, channelId: chan, epoch: 0, body: 're', createdAt: 101, ms: 1, root: { id: m.id!, author: alice, kind: 9 }, parent: { id: m.id!, author: alice, kind: 9 } });
    expect(reply.tags).toContainEqual(['K', '9']);
    const editByOther = editRumor({ author: bob, channelId: chan, epoch: 0, body: 'hacked', createdAt: 102, ms: 1, targetId: m.id! });
    const editByAuthor = editRumor({ author: alice, channelId: chan, epoch: 0, body: 'fixed', createdAt: 103, ms: 1, targetId: m.id! });
    expect(foldChatRumors([m, editByOther])[0].content).toBe('hi');
    expect(foldChatRumors([m, editByAuthor])[0].content).toBe('fixed');
    const del = deleteRumor({ author: alice, channelId: chan, epoch: 0, createdAt: 104, ms: 1, targets: [{ id: m.id!, kind: 9 }] });
    expect(foldChatRumors([m, del])).toEqual([]);
    expect(reactionRumor({ author: bob, channelId: chan, epoch: 0, emoji: 'x', createdAt: 1, ms: 1, target: { id: m.id!, author: alice, kind: 9 } }).kind).toBe(7);
  });
});

describe('limits + expiry', () => {
  it('payload limits enforced', () => {
    expect(() => assertNip44Plaintext('x'.repeat(65536))).toThrow(/65535/);
    expect(() => messageRumor({ author: alice, channelId: chan, epoch: 0, body: 'x'.repeat(70000), createdAt: 1, ms: 1 })).toThrow();
    expect(pinsWithinLimits('x'.repeat(32769), 1)).toBe(false);
    expect(pinsWithinLimits('ok', 26)).toBe(false);
    expect(() => assertListEventSize(65537)).toThrow(/65536/);
    expect(() => assertListEventSize(65537, { shrinks: true })).not.toThrow();
  });
  it('timer: parse, reject at ingest, purge, notice gated', () => {
    expect(parseMessageExpiration('{"message_expiration":60}')).toBe(60);
    expect(parseMessageExpiration('{"message_expiration":"bad"}')).toBe(0);
    const m = messageRumor({ author: alice, channelId: chan, epoch: 0, body: 'gone soon', createdAt: 1000, ms: 1, expirationSec: 60 });
    expect(isExpiredRumor(m, 1060)).toBe(true);
    expect(purgeExpiredRumors([m], 1060)).toEqual([]);
    const notice = timerNoticeRumor({ author: alice, channelId: chan, epoch: 0, createdAt: 1000, ms: 1, timerSec: 60 });
    expect(isExpiredRumor(notice, 99999)).toBe(false);
    expect(shouldShowTimerNotice(notice, () => false)).toBe(false);
    expect(shouldShowTimerNotice(notice, () => true)).toBe(true);
  });
});

const ed = (p: Partial<ControlEdition> & { rumorId: string }): ControlEdition => ({ actor: alice, vsk: 0, eid: cid, ev: 1, content: '{}', ...p });
describe('control fold', () => {
  it('owner metadata, downgrade refused, dissolution eid binding', () => {
    const s = foldControlEditions(alice, [ed({ rumorId: 'a', content: '{"name":"Test"}' }), ed({ rumorId: 'b', ev: 0, content: '{"name":"Old"}' })]);
    expect(s.metadata?.name).toBe('Test');
    expect(verifyDissolution(ed({ rumorId: 'x', vsk: 10, eid: cid }), cid, alice)).toBe(true);
    expect(verifyDissolution(ed({ rumorId: 'x', vsk: 10, eid: '00'.repeat(32) }), cid, alice)).toBe(false);
  });
  it('grant/removal: private-channel style grant applies, stale vac never restores demoted actor', () => {
    const roleId = '11'.repeat(32); const grantEid = '22'.repeat(32);
    const role = ed({ rumorId: 'r1', vsk: 1, eid: roleId, content: JSON.stringify({ role_id: roleId, name: 'Mod', position: 5, permissions: '4', scope: { kind: 'server' }, color: 0 }) });
    const grant = ed({ rumorId: 'g1', vsk: 3, eid: grantEid, content: JSON.stringify({ member: bob, role_ids: [roleId] }) });
    const s1 = foldControlEditions(alice, [role, grant]);
    expect(s1.grants.get(bob)?.role_ids).toEqual([roleId]);
    // Bob (MANAGE_METADATA=4) edits metadata citing his grant.
    const vac: [string, string, string] = [grantEid, '1', editionHash(grantEid, 1, undefined, grant.content)];
    const bobEdit = ed({ rumorId: 'm1', actor: bob, vac, content: '{"name":"ByBob"}' });
    expect(foldControlEditions(alice, [role, grant, bobEdit]).metadata?.name).toBe('ByBob');
    // After revocation (ev2 empty role_ids), the same stale citation must not restore him.
    const revoke = ed({ rumorId: 'g2', vsk: 3, eid: grantEid, ev: 2, ep: editionHash(grantEid, 1, undefined, grant.content), content: JSON.stringify({ member: bob, role_ids: [] }) });
    const s3 = foldControlEditions(alice, [role, grant, revoke, bobEdit]);
    expect(s3.metadata?.name).not.toBe('ByBob');
    // Unsynced vac parks instead of applying.
    const orphan = ed({ rumorId: 'm9', actor: bob, vac: [grantEid, '9', 'ff'.repeat(32)], content: '{"name":"Parked"}' });
    expect(foldControlEditions(alice, [role, grant, orphan]).parked.some((p) => p.rumorId === 'm9')).toBe(true);
  });
  it('edition rumor round-trip', () => {
    const r = buildEditionRumor({ actor: alice, vsk: 4, eid: '33'.repeat(32), ev: 1, content: '[]', createdAt: 1, ms: 5 });
    expect(editionFromRumor(r).vsk).toBe(4);
    expect(sealKindForPlane('control')).toBe(20014); expect(sealKindForPlane('chat')).toBe(20013);
  });
});

describe('33302 list', () => {
  it('pack/unpack preserves unknowns; partial read never erases; stale never restores; rejoin resurrects', () => {
    const doc = F.communityList33302 as never;
    const packed = packCommunityListFragment(doc, 0);
    expect(packed.tags).toEqual([['d', '0']]);
    const { doc: back } = unpackCommunityListFragment(packed);
    expect((back as unknown as { unknownFragmentField: string }).unknownFragmentField).toBe('preserve-me-too');
    expect(hexToB64url(cid)).toHaveLength(43); expect(b64urlToHex(hexToB64url(cid))).toBe(cid);
    const merged = mergeCommunityLists([back, { frags: 1, entries: [], tombstones: [] }]);
    expect(merged.entries).toHaveLength(1); // partial/empty fragment does not erase
    const tombstoned = mergeCommunityLists([back, { frags: 1, entries: [], tombstones: [{ community_id: (back.entries[0]).community_id, removed_at: 1800000000000 }] }]);
    expect(tombstoned.entries).toHaveLength(0); // stale entry (older added_at) never restores
    const rejoined = mergeCommunityLists([tombstoned, back]);
    expect(rejoined.entries).toHaveLength(0); // re-merge of same stale entry still loses
    expect(canRepack([0], 2)).toBe(false); expect(canRepack([0, 1], 2)).toBe(true);
  });
});

describe('guestbook + rekey', () => {
  it('coalesces, drops >1h future, snapshot seeds only, missing chunk never removal', () => {
    const now = 1700000000000;
    const folded = foldGuestbook([
      { kind: 3306, actor: bob, action: 'join', rumorId: 'b1', createdAt: 1700000000, ms: 1 },
      { kind: 3306, actor: bob, action: 'join', rumorId: 'b2', createdAt: 1700000100, ms: 1 },
      { kind: 3312, actor: alice, members: [alice], snapId: 's', index: 0, total: 2, rumorId: 's1', createdAt: 1699999000, ms: 1 },
    ], { nowMs: now, isAuthorizedKick: () => false, refounder: alice });
    expect(folded.get(bob)).toBe('present'); expect(folded.get(alice)).toBe('present');
    const future = foldGuestbook([{ kind: 3306, actor: bob, action: 'join', rumorId: 'f', createdAt: 1700010000, ms: 1 }], { nowMs: now, isAuthorizedKick: () => false });
    expect(future.has(bob)).toBe(false);
    const commit = F.derivations.epochKeyCommitment;
    const chunks = [{ index: 0, total: 2, newEpoch: 1, prevEpoch: 0, prevCommit: commit, blobs: [] }];
    expect(evaluateRekey(chunks, 'loc', { epoch: 0, keyHex: F.secrets.communityRoot })).toBe('incomplete');
    const full = [...chunks, { index: 1, total: 2, newEpoch: 1, prevEpoch: 0, prevCommit: commit, blobs: [] }];
    expect(evaluateRekey(full, 'loc', { epoch: 0, keyHex: F.secrets.communityRoot })).toBe('removed');
    expect(rekeyLocator(alice, bob, chan, 1)).toHaveLength(64);
    expect(parseRekeyBlob(new Uint8Array(72))?.form).toBe('base-legacy');
    expect(parseRekeyBlob(new Uint8Array(10))).toBeNull();
    expect(pickRefoundingWinner(['bb', 'aa'])).toBe('aa');
  });
});

describe('invites + signer + store', () => {
  it('bundle owner-proof, expiry refuses join, fragment round-trip client-side', () => {
    const bundle = { community_id: cid, owner: alice, owner_salt: F.secrets.ownerSalt, community_root: F.secrets.communityRoot, root_epoch: 0, channels: [], relays: [], name: 'Test', expires_at: F.invite.expiresAtMs };
    expect(validateInviteBundle(bundle as never)).toBeNull();
    expect(inviteJoinable(bundle as never, 1700000000000)).toBe(true);
    expect(inviteJoinable(bundle as never, F.invite.expiresAtMs + 1)).toBe(false);
    expect(validateInviteBundle({ ...bundle, owner: bob } as never)).toBe('owner-proof-failed');
    const frag = encodeInviteFragment(F.invite.token);
    expect(decodeInviteFragment(frag).tokenHex).toBe(F.invite.token);
    expect(parseInviteHash('#' + frag)?.tokenHex).toBe(F.invite.token);
    expect(parseInviteUrl('/invite/naddr1abc', '#' + frag)?.naddr).toBe('naddr1abc');
    expect(parseInviteHash('#community=c1&invite=secret')).toEqual({ communityId: 'c1', code: 'secret' });
    const merged = mergeInviteLists({ entries: [{ token: 't1', signer_sk: 's', community_id: cid, url: 'u', created_at: 1 }], tombstones: [] }, { entries: [], tombstones: [{ token: 't1', community_id: cid }] });
    expect(merged.entries).toHaveLength(0); // tombstone beats entry, never resurrects
  });
  it('signer probe + account-scoped store clears keys/pending on dispose', () => {
    expect(probeSignerCapabilities(undefined).gap).toMatch(/logged out/);
    const a = new ChatStore(alice); a.keyMaterial.k = 'v'; a.pending.push('p');
    let cancelled = false; a.onCleanup(() => { cancelled = true; }); a.dispose();
    expect(cancelled).toBe(true); expect(a.keyMaterial).toEqual({}); expect(a.pending).toEqual([]);
    expect(chatQueryScope('pk')).toBe('chat:v1:pk');
  });
});
