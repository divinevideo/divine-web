import { describe, expect, it } from 'vitest';
import fixture from '../../../test-fixtures/concord/community-interop.json';
import { bytesToHex } from './concord-core/derive';
import { openControlWraps, controlGroups, citationSatisfied } from './concord-core/control';
import { canActOnMember, isAuthorized, Permissions } from './concord-core/roles';
import { citationFromTags } from './concord-core/edition';
import { openWrap } from './concord-core/stream';
import { parseInviteLink } from './concord-core/invite';
import { decodeCommunityInvite, foldCommunity, publicChannels, readCommunityChat, requireCompleteCommunity } from './community';

describe('bridge community interoperability', () => {
  it('verifies the owner, folds delegated public channels and opens the bridge stream', () => {
    const community = decodeCommunityInvite(fixture.inviteUrl, [fixture.bundleEvent]);
    expect(community.idHex).toBe(fixture.expected.communityId);
    expect(community.owner).toBe(fixture.expected.owner);
    const folded = foldCommunity(community, fixture.controlEvents);
    expect(() => requireCompleteCommunity(folded)).not.toThrow();
    expect(folded.banned.has(fixture.expected.bannedMember)).toBe(true);
    const channels = publicChannels(community, folded);
    expect(channels.map(c => ({ id: c.idHex, name: c.name, streams: c.streams.map(s => ({ pubkey: s.group.pk, epoch: Number(s.epoch) })) }))).toEqual(fixture.expected.channels);
    expect(readCommunityChat([fixture.chatEvent], channels[0], community, folded).map(m => ({ id: m.id, content: m.content }))).toEqual([{ id: fixture.expected.message.id, content: fixture.expected.message.content }]);
    expect(readCommunityChat([fixture.chatEvent], channels[1], community, folded)).toEqual([]);
  });
  it('refuses unsigned or missing bundles rather than falling back to a demo', () => {
    expect(() => decodeCommunityInvite(fixture.inviteUrl, [{ ...fixture.bundleEvent, sig: '0'.repeat(128) }])).toThrow();
    expect(() => decodeCommunityInvite(fixture.inviteUrl, [])).toThrow();
  });
  it('does not reuse another session’s decoded messages when the key is absent', () => {
    const community = decodeCommunityInvite(fixture.inviteUrl, [fixture.bundleEvent]);
    const folded = foldCommunity(community, fixture.controlEvents);
    const channel = publicChannels(community, folded)[0];
    expect(readCommunityChat([fixture.chatEvent], channel, community, folded)).toHaveLength(1);
    expect(readCommunityChat([fixture.chatEvent], { ...channel, streams: [] }, community, folded)).toEqual([]);
  });
});

describe('cached moderation', () => {
  it('removes a cached message on a cited moderator deletion and hides banned authors', () => {
    const community = decodeCommunityInvite(fixture.inviteUrl, [fixture.bundleEvent]);
    const control = foldCommunity(community, fixture.controlEvents);
    const channel = publicChannels(community, control)[0];
    expect(readCommunityChat([fixture.chatEvent], channel, community, control)).toHaveLength(1);
    expect(readCommunityChat([fixture.chatEvent, fixture.moderatorDeleteEvent, fixture.bannedChatEvent], channel, community, control)).toEqual([]);
  });
  it('fails closed on unavailable control-chain history, independent of authority', () => {
    const community = decodeCommunityInvite(fixture.inviteUrl, [fixture.bundleEvent]);
    const control = foldCommunity(community, [...fixture.controlEvents, ...fixture.rejectedControlEvents]);
    expect(() => requireCompleteCommunity(control)).toThrow('incomplete');
  });
});

describe('decisive bridge authority and read-path vectors', () => {
  const bootstrap = () => {
    const community = decodeCommunityInvite(fixture.inviteUrl, [fixture.bundleEvent]);
    const control = foldCommunity(community, fixture.controlEvents);
    const channel = publicChannels(community, control).find(c => c.idHex === fixture.expected.message.channelId)!;
    return { community, control, channel };
  };

  it('folds the live invite registry and refuses the newest revocation in either arrival order', () => {
    const { control } = bootstrap();
    expect(control.liveInviteLinks.has(parseInviteLink(fixture.inviteUrl)!.linkSigner)).toBe(true);
    expect(decodeCommunityInvite(fixture.revokedInviteUrl, [fixture.revokedLiveBundleEvent]).idHex).toBe(fixture.expected.communityId);
    expect(fixture.revokedBundleEvent.created_at).toBeGreaterThan(fixture.revokedLiveBundleEvent.created_at);
    for (const events of [[fixture.revokedLiveBundleEvent, fixture.revokedBundleEvent], [fixture.revokedBundleEvent, fixture.revokedLiveBundleEvent]]) {
      expect(() => decodeCommunityInvite(fixture.revokedInviteUrl, events)).toThrow(/revoked/);
    }
  });

  it('rejects a chained and correctly cited rename solely because its actor lacks channel permission', () => {
    const { community, control, channel } = bootstrap();
    const head = control.heads.get(channel.idHex)!;
    const [edition] = openControlWraps(fixture.unauthorizedControlEvents, controlGroups(community));
    expect(edition.author).toBe(fixture.expected.moderator);
    expect(edition.version).toBe(head.version + 1n);
    expect(bytesToHex(edition.prevHash!)).toBe(bytesToHex(head.hash));
    expect(citationSatisfied(control, community.id, edition.author, edition.authority)).toBe(true);
    expect(isAuthorized(control.roster, edition.author, community.owner, Permissions.MANAGE_CHANNELS)).toBe(false);
    const refused = foldCommunity(community, [...fixture.controlEvents, ...fixture.unauthorizedControlEvents]);
    expect(refused.incomplete).toEqual([]);
    expect(refused.heads.get(channel.idHex)).toEqual(head);
    expect(publicChannels(community, refused).find(c => c.idHex === channel.idHex)?.name).toBe('general');
  });

  it.each([
    ['plaintext seal', fixture.plaintextChatEvent],
    ['foreign channel binding', fixture.misboundChatEvent],
    ['foreign epoch binding', fixture.epochMisboundChatEvent],
  ] as const)('refuses a validly signed carrier with %s', (_reason, carrier) => {
    const { community, control, channel } = bootstrap();
    expect(openWrap(carrier, channel.current.group).author).toBe(fixture.expected.member);
    expect(readCommunityChat([carrier], channel, community, control)).toEqual([]);
  });

  it.each([
    ['member without a grant', fixture.unprivilegedDeleteEvent, fixture.expected.bystander, false, false],
    ['moderator without a citation', fixture.uncitedModeratorDeleteEvent, fixture.expected.moderator, false, true],
    ['cited channel manager without message permission', fixture.citedUnprivilegedDeleteEvent, fixture.expected.channelManager, true, false],
  ] as const)('keeps a cached message when deleted by a %s', (_reason, deletion, actor, cited, permitted) => {
    const { community, control, channel } = bootstrap();
    const action = openWrap(deletion, channel.current.group);
    expect(action.kind).toBe(5);
    expect(action.author).toBe(actor);
    expect(citationSatisfied(control, community.id, action.author, citationFromTags(action.tags))).toBe(cited);
    expect(isAuthorized(control.roster, action.author, community.owner, Permissions.MANAGE_MESSAGES)).toBe(permitted);
    expect(readCommunityChat([fixture.chatEvent, deletion, fixture.bannedChatEvent], channel, community, control).map(m => m.id)).toEqual([fixture.expected.message.id]);
  });

  it.each([
    ['owner', fixture.ownerChatEvent, fixture.moderatorDeletesOwnerEvent, fixture.expected.ownerMessageId, fixture.expected.owner],
    ['higher-ranked administrator', fixture.adminChatEvent, fixture.moderatorDeletesAdminEvent, fixture.expected.adminMessageId, fixture.expected.admin],
  ] as const)('keeps the %s message despite a correctly cited moderator deletion', (_role, message, deletion, id, author) => {
    const { community, control, channel } = bootstrap();
    expect(openWrap(message, channel.current.group).author).toBe(author);
    const action = openWrap(deletion, channel.current.group);
    expect(action.author).toBe(fixture.expected.moderator);
    expect(citationSatisfied(control, community.id, action.author, citationFromTags(action.tags))).toBe(true);
    expect(isAuthorized(control.roster, action.author, community.owner, Permissions.MANAGE_MESSAGES)).toBe(true);
    expect(canActOnMember(control.roster, action.author, community.owner, author, Permissions.MANAGE_MESSAGES)).toBe(false);
    expect(readCommunityChat([message, deletion], channel, community, control).map(m => m.id)).toEqual([id]);
  });
});
