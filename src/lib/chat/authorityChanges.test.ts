import { describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { mintCommunity } from './concord-core/community';
import { foldControlState, sealDissolved } from './concord-core/control';
import { baseRekeyGroupKey, bytesToHex, epochKeyCommitment } from './concord-core/derive';
import { buildRekeyRumors } from './concord-core/rekey';
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
