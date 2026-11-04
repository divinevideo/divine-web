import { describe, expect, it } from 'vitest';
import moderationFixture from '../../../test-fixtures/concord/community-moderation.json';
import fixture from '../../../test-fixtures/concord/community-interop.json';
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
  it('refuses unsigned or revoked bundles rather than falling back to a demo', () => {
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
    const community = decodeCommunityInvite(moderationFixture.inviteUrl, [moderationFixture.bundleEvent]);
    const control = foldCommunity(community, moderationFixture.controlEvents);
    const channel = publicChannels(community, control)[0];
    expect(readCommunityChat([moderationFixture.chatEvent], channel, community, control)).toHaveLength(1);
    expect(readCommunityChat([moderationFixture.chatEvent, moderationFixture.moderatorDeleteEvent, moderationFixture.bannedChatEvent], channel, community, control)).toEqual([]);
  });
  it('fails the session closed on incomplete control chains', () => {
    const community = decodeCommunityInvite(fixture.inviteUrl, [fixture.bundleEvent]);
    const control = foldCommunity(community, [...fixture.controlEvents, ...fixture.rejectedControlEvents]);
    expect(() => requireCompleteCommunity(control)).toThrow('incomplete');
  });
});
