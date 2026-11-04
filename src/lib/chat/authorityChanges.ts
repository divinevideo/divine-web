// ABOUTME: Authenticated severance/rekey evidence closes the old session before any further write.
import type { Event as NostrEvent } from 'nostr-tools';
import { baseRekeyGroupKey, channelRekeyGroupKey, dissolvedGroupKey, type GroupKey } from './concord-core/derive';
import { isDissolvedOpened, citationSatisfied, type FoldedControl } from './concord-core/control';
import { checkContinuity, parseRekey, CHANNEL_REKEY_LOOKAHEAD } from './concord-core/rekey';
import { openWrap } from './concord-core/stream';
import { isAuthorized, Permissions } from './concord-core/roles';
import type { CommunityV2, ChannelV2 } from './concord-core/types';
import { verifiedEvent } from './community';
export type WatchKey = { group: GroupKey; scope: string; epoch: bigint };
export type AuthorityChange = { kind: 'dissolved' } | { kind: 'root'; epoch: bigint } | { kind: 'channel'; id: string; epoch: bigint };
const ROOT = '0'.repeat(64);
export function communityWatchKeys(community: CommunityV2, channel?: ChannelV2): WatchKey[] {
  const keys: WatchKey[] = [{ group: dissolvedGroupKey(community.id), scope: 'dissolved', epoch: 0n }];
  for (let step = 1n; step <= BigInt(CHANNEL_REKEY_LOOKAHEAD); step++) {
    const epoch = community.rootEpoch + step;
    keys.push({ group: baseRekeyGroupKey(community.root, community.id, epoch), scope: ROOT, epoch });
  }
  if (channel) for (const root of community.heldRoots) for (let epoch = 1n; epoch <= BigInt(CHANNEL_REKEY_LOOKAHEAD); epoch++) {
    keys.push({ group: channelRekeyGroupKey(root.key, channel.id, epoch), scope: channel.idHex, epoch });
  }
  return keys;
}
export function authorityChangeEvidence(wraps: NostrEvent[], keys: WatchKey[], community: CommunityV2, control: FoldedControl): AuthorityChange | undefined {
  const byPk = new Map(keys.map(key => [key.group.pk, key]));
  for (const wrap of wraps) {
    const key = byPk.get(wrap.pubkey);
    if (!key || !verifiedEvent(wrap)) continue;
    try {
      const event = openWrap(wrap, key.group);
      if (key.scope === 'dissolved') {
        if (isDissolvedOpened(event, community.owner, community.id)) return { kind: 'dissolved' };
        continue;
      }
      const rotation = parseRekey(event);
      if (rotation.scopeIdHex !== key.scope || rotation.newEpoch !== key.epoch || rotation.newEpoch <= rotation.prevEpoch || control.banned.has(rotation.rotator)) continue;
      const permission = key.scope === ROOT ? Permissions.BAN : Permissions.MANAGE_CHANNELS;
      if (!isAuthorized(control.roster, rotation.rotator, community.owner, permission) || !citationSatisfied(control, community.id, rotation.rotator, rotation.authority)) continue;
      if (key.scope === ROOT) {
        if (rotation.newEpoch <= community.rootEpoch || !checkContinuity(rotation, community.rootEpoch, community.root).ok) continue;
        return { kind: 'root', epoch: rotation.newEpoch };
      }
      const channelHead = control.headEditions.get(key.scope);
      if (channelHead && rotation.ms <= channelHead.opened.ms) continue;
      // This is a pause and a verified reload, never an assertion that a
      // member was excluded: incomplete chunk sets are not removal evidence.
      return { kind: 'channel', id: key.scope, epoch: rotation.newEpoch };
    } catch { /* A findable stream address alone grants no authority. */ }
  }
  return undefined;
}
