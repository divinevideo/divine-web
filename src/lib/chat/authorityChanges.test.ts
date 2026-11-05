import { describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { mintCommunity } from './concord-core/community';
import { foldControlState, sealDissolved } from './concord-core/control';
import { baseRekeyGroupKey, bytesToHex, epochKeyCommitment } from './concord-core/derive';
import lifecycle from '../../../test-fixtures/concord/community-lifecycle.json';
import { decodeCommunityInvite, foldCommunity, publicChannels } from './community';
import { openWrap } from './concord-core/stream';
import { buildRekeyRumors, groupRotations, parseRekey, checkContinuity } from './concord-core/rekey';
import { sealRumor, wrapSeal } from './concord-core/stream';
import { authorityChangeEvidence, communityWatchKeys } from './authorityChanges';

describe('live authority safety fence', () => {
  it('recognizes only authenticated dissolution and continuous authorized root rotations', async () => {
    const ownerKey = generateSecretKey(); const owner = getPublicKey(ownerKey);
    const { community } = mintCommunity('test', owner, ['wss://relay.example']);
    const control = foldControlState([], community.id, owner);
    const signer = { signEvent: async (template: Parameters<typeof finalizeEvent>[0]) => finalizeEvent(template, ownerKey) };
    const dissolved = await sealDissolved(community.id, owner, signer);
    expect(authorityChangeEvidence([dissolved], communityWatchKeys(community), community, control)).toEqual({ kind: 'dissolved' });
    const group = baseRekeyGroupKey(community.root, community.id, 1n);
    const rumor = buildRekeyRumors(owner, { scope: { kind: 'root' }, newEpoch: 1n, prevEpoch: 0n, prevCommit: bytesToHex(epochKeyCommitment(0n, community.root)) }, [], Date.now())[0];
    const wrap = wrapSeal(await sealRumor(rumor, 20013, group, signer), group);
    expect(authorityChangeEvidence([wrap], communityWatchKeys(community), community, control)).toEqual({ kind: 'root', epoch: 1n });
    const strangerKey = generateSecretKey();
    const fake = await sealDissolved(community.id, getPublicKey(strangerKey), { signEvent: async template => finalizeEvent(template, strangerKey) });
    expect(authorityChangeEvidence([fake], communityWatchKeys(community), community, control)).toBeUndefined();
    expect(authorityChangeEvidence([{ ...wrap, sig: '0'.repeat(128) }], communityWatchKeys(community), community, control)).toBeUndefined();
  });
});

describe('bridge-generated lifecycle evidence', () => {
  const bootstrap = () => {
    const community = decodeCommunityInvite(lifecycle.inviteUrl, [lifecycle.bundleEvent]);
    const control = foldCommunity(community, lifecycle.controlEvents);
    return { community, control, keys: communityWatchKeys(community) };
  };

  it('recognizes the authorized continuous owner rotation and the refreshed invite epoch', () => {
    const { community, control, keys } = bootstrap();
    expect(authorityChangeEvidence(lifecycle.baseRekeyEvents, keys, community, control)).toEqual({ kind: 'root', epoch: BigInt(lifecycle.nextEpoch) });
    const refreshed = decodeCommunityInvite(lifecycle.inviteUrl, [lifecycle.refreshedBundleEvent, lifecycle.bundleEvent]);
    expect(refreshed.idHex).toBe(community.idHex);
    expect(refreshed.rootEpoch).toBe(BigInt(lifecycle.nextEpoch));
    expect(bytesToHex(refreshed.root)).not.toBe(bytesToHex(community.root));
    const restored = foldCommunity(refreshed, lifecycle.nextEpochControlEvents);
    expect(restored.incomplete).toEqual([]);
    expect(publicChannels(refreshed, restored).map(channel => channel.idHex)).toEqual(publicChannels(community, control).map(channel => channel.idHex));
  });

  it('refuses a complete and continuous rotation signed by a member without authority', () => {
    const { community, control, keys } = bootstrap();
    const group = baseRekeyGroupKey(community.root, community.id, BigInt(lifecycle.nextEpoch));
    const rotations = groupRotations(lifecycle.impostorRekeyEvents.map(event => parseRekey(openWrap(event, group))));
    expect(rotations).toHaveLength(1);
    expect(rotations[0].complete).toBe(true);
    expect(checkContinuity(rotations[0], community.rootEpoch, community.root)).toEqual({ ok: true });
    expect(authorityChangeEvidence(lifecycle.impostorRekeyEvents, keys, community, control)).toBeUndefined();
  });

  it('pauses on an authorized partial rotation without asserting that a member was excluded', () => {
    const { community, control, keys } = bootstrap();
    const group = baseRekeyGroupKey(community.root, community.id, BigInt(lifecycle.nextEpoch));
    // Group this vector alone: combining it with the complete owner vector
    // would hide its missing chunk behind their shared rotation coordinate.
    const rotations = groupRotations(lifecycle.halfPublishedRekeyEvents.map(event => parseRekey(openWrap(event, group))));
    expect(rotations).toHaveLength(1);
    expect(rotations[0].complete).toBe(false);
    expect(rotations[0].chunkCount).toBe(2);
    expect(checkContinuity(rotations[0], community.rootEpoch, community.root)).toEqual({ ok: true });
    expect(authorityChangeEvidence(lifecycle.halfPublishedRekeyEvents, keys, community, control)).toEqual({ kind: 'root', epoch: BigInt(lifecycle.nextEpoch) });
  });

  it('recognizes the owner dissolution', () => {
    const { community, control, keys } = bootstrap();
    expect(authorityChangeEvidence(lifecycle.dissolvedEvents, keys, community, control)).toEqual({ kind: 'dissolved' });
  });

  it.each([
    ['non-owner seal', lifecycle.impostorDissolvedEvents],
    ['forged rumor author', lifecycle.forgedAuthorDissolvedEvents],
    ['foreign community binding', lifecycle.replayedDissolvedEvents],
    ['all-zero community binding', lifecycle.zeroEidDissolvedEvents],
  ] as const)('refuses dissolution with %s', (_reason, carriers) => {
    const { community, control, keys } = bootstrap();
    expect(authorityChangeEvidence(carriers, keys, community, control)).toBeUndefined();
  });
});
