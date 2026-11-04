// ABOUTME: Real community reads use the same owner-rooted Concord kernel as the bridge.
import { getEventHash, verifyEvent, type Event as NostrEvent } from 'nostr-tools';
import { parseInviteLink, parseBundleEvent, validateBundle } from './concord-core/invite';
import { bundleToEntry } from './concord-core/join';
import { rehydrateCommunity } from './concord-core/communityList';
import { controlGroups, openControlEditions, foldControlState, citationSatisfied, type FoldedControl } from './concord-core/control';
import { channelsView } from './concord-core/community';
import { checkChannelBinding, openWrap } from './concord-core/stream';
import { foldTimeline, type OpenedChat } from './concord-core/chat';
import { canActOnMember, Permissions } from './concord-core/roles';
import type { CommunityV2, ChannelV2 } from './concord-core/types';
import type { Rumor } from './protocol';

export { parseInviteLink, controlGroups };
export type { CommunityV2, ChannelV2, FoldedControl };
export const verifiedEvent = (event: NostrEvent): boolean => {
  try { return getEventHash(event) === event.id && verifyEvent({ ...event }); } catch { return false; }
};
export function decodeCommunityInvite(url: string, events: NostrEvent[]): CommunityV2 {
  const invite = parseInviteLink(url);
  if (!invite) throw new Error('Invalid community invite');
  const newest = events.filter(e => e.kind === 33301 && e.pubkey === invite.linkSigner && e.tags.some(t => t[0] === 'd' && t[1] === '') && verifiedEvent(e))
    .sort((a,b) => b.created_at - a.created_at || a.id.localeCompare(b.id))[0];
  if (!newest) throw new Error('Community invite not found');
  const bundle = validateBundle(parseBundleEvent(newest, invite.linkSigner, invite.token, Date.now()));
  const community = rehydrateCommunity(bundleToEntry(bundle));
  if (!community || !community.relays.length) throw new Error('Invalid community identity or relay set');
  return community;
}
export function foldCommunity(community: CommunityV2, wraps: NostrEvent[]): FoldedControl {
  const groups = new Map(controlGroups(community).map(g => [g.pk, g]));
  // Open and verify this session's wraps before consulting the kernel's fold.
  // A prior account's decoded event must never bypass possession of its key.
  const opened = wraps.flatMap(w => {
    const group = groups.get(w.pubkey);
    if (!group || !verifiedEvent(w)) return [];
    try { const event = openWrap(w, group); return event.sealKind === 20014 ? [event] : []; } catch { return []; }
  });
  return foldControlState(openControlEditions(opened), community.id, community.owner);
}
export function publicChannels(community: CommunityV2, folded: FoldedControl): ChannelV2[] {
  return channelsView(community, folded).filter(c => !c.isPrivate && !/^tickets?$/i.test(c.name.trim()) && !/^tickets?$/i.test(c.category?.trim() ?? ''));
}
export function readCommunityChat(wraps: NostrEvent[], channel: ChannelV2, community: CommunityV2, folded: FoldedControl): Rumor[] {
  const opened: OpenedChat[] = [];
  for (const wrap of wraps) {
    const stream = channel.streams.find(s => s.group.pk === wrap.pubkey);
    if (!stream || !verifiedEvent(wrap)) continue;
    try {
      const event = openWrap(wrap, stream.group);
      if (event.sealKind !== 20013) continue;
      checkChannelBinding(event, channel.idHex, stream.epoch);
      if (stream.retiredAt !== undefined && event.createdAt > stream.retiredAt) continue;
      opened.push({ ...event, channelIdHex: channel.idHex, epoch: stream.epoch });
    } catch { /* Unverifiable or foreign stream events never enter the timeline. */ }
  }
  return foldTimeline(opened, {
    banned: folded.banned,
    canDelete: (actor, target, action) => citationSatisfied(folded, community.id, actor, action?.citation) && canActOnMember(folded.roster, actor, community.owner, target, Permissions.MANAGE_MESSAGES),
    canSetTimer: actor => actor === community.owner,
  }).messages.map(event => ({ id: event.rumorId, pubkey: event.author, kind: event.kind, content: event.content, tags: event.tags, created_at: event.createdAt }));
}

export function requireCompleteCommunity(control: FoldedControl): void {
  if (control.incomplete.length || !control.metadata || !control.channels.size) throw new Error('The signed community state is incomplete.');
}
