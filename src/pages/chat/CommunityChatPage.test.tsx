import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import fixture from '../../../test-fixtures/concord/community-interop.json';
import { mintCommunity } from '@/lib/chat/concord-core/community';
import { bytesToHex } from '@/lib/chat/concord-core/derive';
import { buildBundleEvent, buildInviteUrl } from '@/lib/chat/concord-core/invite';
import { buildBanlistEdition, buildChannelEdition, buildMetadataEdition, currentControlWriteGroup, sealEdition, sealDissolved } from '@/lib/chat/concord-core/control';
import { useCommunityChat } from '@/hooks/useCommunityChat';
import { messageRumor } from '@/lib/chat/protocol';
import { foldCommunity } from '@/lib/chat/community';
import { CommunityChatPage } from './CommunityChatPage';

class FixtureSocket {
  static data: { inviteUrl: string; bundleEvent: typeof fixture.bundleEvent; controlEvents: typeof fixture.controlEvents; chatEvent?: typeof fixture.chatEvent } = fixture;
  static instances: FixtureSocket[] = [];
  static acceptPublications = false;
  static refuseNextChannelRead = false;
  frames: unknown[][] = [];
  requests = new Map<string, { authors?: string[] }>();
  readyState = 0; onopen?: () => void; onclose?: () => void; onmessage?: (event: { data: string }) => void;
  constructor(_url: string) { FixtureSocket.instances.push(this); queueMicrotask(() => { this.readyState = 1; this.onopen?.(); }); }
  emit(frame: unknown[]) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  send(data: string) {
    const frame = JSON.parse(data); this.frames.push(frame);
    if (frame[0] === 'CLOSE') this.requests.delete(frame[1]);
    if (frame[0] === 'REQ') this.requests.set(frame[1], frame[2]);
    if (frame[0] === 'REQ') queueMicrotask(() => {
      const filter = frame[2];
      const source = FixtureSocket.data;
      if (FixtureSocket.refuseNextChannelRead && filter.kinds.includes(1059) && !filter.authors?.includes(source.controlEvents[0].pubkey)) {
        FixtureSocket.refuseNextChannelRead = false;
        this.emit(['CLOSED', frame[1], 'restricted: channel unavailable']);
        return;
      }
      const events = filter.kinds.includes(33301) ? [source.bundleEvent] : filter.authors?.includes(source.controlEvents[0].pubkey) ? source.controlEvents : source.chatEvent ? [source.chatEvent] : [];
      for (const event of events) this.emit(['EVENT', frame[1], event]);
      this.emit(['EOSE', frame[1]]);
    });
    if (frame[0] === 'EVENT') queueMicrotask(() => this.emit(['OK', frame[1].id, FixtureSocket.acceptPublications, '']));
  }
  push(event: typeof fixture.bundleEvent) { for (const [id, filter] of this.requests) if (this.readyState === 1 && filter.authors?.includes(event.pubkey)) this.emit(['EVENT', id, event]); }
  close() { this.readyState = 3; this.onclose?.(); }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); FixtureSocket.data = fixture; FixtureSocket.instances = []; FixtureSocket.acceptPublications = false; FixtureSocket.refuseNextChannelRead = false; });
const sk = generateSecretKey();
const signer = { signEvent: async (template: Parameters<typeof finalizeEvent>[0]) => finalizeEvent(template, sk) };

describe('real community page', () => {
  it('loads bridge channels and history and retains a refused send draft', async () => {
    vi.stubGlobal('WebSocket', FixtureSocket);
    render(<MemoryRouter><CommunityChatPage inviteUrl={fixture.inviteUrl} signer={signer} pubkey={getPublicKey(sk)} communityId={fixture.expected.communityId} channelId={fixture.expected.channels[0].id} /></MemoryRouter>);
    expect(await screen.findByText('Synthetic relay message', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'general' })).toHaveAttribute('href', `/chat/${fixture.expected.communityId}/${fixture.expected.channels[0].id}`);
    expect(screen.queryByText('Divine test community')).not.toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: 'preserve this message' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Message was not sent. Your draft is still here.')).toBeInTheDocument();
    expect(input).toHaveValue('preserve this message');
  }, 15000);
  it('shows a failed real invite without demo communities or posting', async () => {
    render(<MemoryRouter><CommunityChatPage inviteUrl="invalid" signer={signer} pubkey={getPublicKey(sk)} /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('Divine test community')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
  });
});

it.each(['query', 'subscription', 'disconnect'])('backs off before rebootstrapping after a channel %s failure', async failure => {
  vi.stubGlobal('WebSocket', FixtureSocket);
  const { result } = renderHook(() => useCommunityChat(fixture.inviteUrl, signer, fixture.expected.channels[0].id));
  await waitFor(() => expect(result.current.channelReady).toBe(true), { timeout: 10000 });
  vi.useFakeTimers();
  if (failure === 'query') {
    FixtureSocket.refuseNextChannelRead = true;
    await act(async () => { result.current.reconnect(); });
  } else {
    await act(async () => {
      for (const socket of FixtureSocket.instances) {
        if (failure === 'disconnect') socket.close();
        else for (const id of socket.requests.keys()) socket.emit(['CLOSED', id, 'restricted: channel unavailable']);
      }
    });
  }
  const bootstrapReads = () => FixtureSocket.instances.flatMap(socket => socket.frames)
    .filter(frame => frame[0] === 'REQ' && (frame[2] as { kinds: number[] }).kinds.includes(33301)).length;
  const expectedReads = failure === 'query' ? 2 : 1;
  expect(bootstrapReads()).toBe(expectedReads);
  expect(result.current.channelReady).toBe(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
  expect(bootstrapReads()).toBe(expectedReads);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(bootstrapReads()).toBe(expectedReads + 1);
}, 15000);

async function makeTestCommunity() {
  const ownerKey = generateSecretKey(); const owner = getPublicKey(ownerKey);
  const { community, generalChannelId } = mintCommunity('Safety community', owner, ['wss://relay.example']);
  const ownerSigner = { signEvent: async (template: Parameters<typeof finalizeEvent>[0]) => finalizeEvent(template, ownerKey) };
  const options = { actorPubkey: owner, version: 1n };
  const control = currentControlWriteGroup(community);
  const events = await Promise.all([
    sealEdition(buildMetadataEdition(community.id, { name: community.name, relays: community.relays }, options), control, ownerSigner),
    sealEdition(buildChannelEdition(generalChannelId, { name: 'general', private: false }, options), control, ownerSigner),
  ]);
  const token = generateSecretKey().slice(0, 16); const linkKey = generateSecretKey();
  const inviteUrl = buildInviteUrl('https://chat.example', getPublicKey(linkKey), token, community.relays);
  const bundleEvent = buildBundleEvent({ community_id: community.idHex, owner, owner_salt: bytesToHex(community.ownerSalt), community_root: bytesToHex(community.root), root_epoch: 0, control_pk: community.controlPk, channels: [], relays: community.relays, name: community.name }, token, linkKey);
  FixtureSocket.data = { inviteUrl, bundleEvent, controlEvents: events };
  return { community, generalChannelId, owner, ownerSigner, inviteUrl, events, control };
}

it('closes sends on authenticated dissolution while an account signer is answering, preserving the draft', async () => {
  const { community, generalChannelId, owner, ownerSigner, inviteUrl } = await makeTestCommunity();
  vi.stubGlobal('WebSocket', FixtureSocket);
  let resume: (() => void) | undefined;
  const delayedSigner = { signEvent: async (template: Parameters<typeof finalizeEvent>[0]) => { await new Promise<void>(resolve => { resume = resolve; }); return finalizeEvent(template, sk); } };
  render(<MemoryRouter><CommunityChatPage inviteUrl={inviteUrl} signer={delayedSigner} pubkey={getPublicKey(sk)} communityId={community.idHex} channelId={bytesToHex(generalChannelId)} /></MemoryRouter>);
  const input = screen.getByRole('textbox', { name: 'Message' });
  await waitFor(() => expect(input).not.toBeDisabled(), { timeout: 10000 });
  fireEvent.change(input, { target: { value: 'do not send after closure' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(resume).toBeDefined());
  const dissolved = await sealDissolved(community.id, owner, ownerSigner);
  await act(async () => { for (const socket of FixtureSocket.instances) socket.push(dissolved); });
  expect(await screen.findByText('This community has closed.')).toBeInTheDocument();
  await act(async () => { resume!(); });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled());
  expect(input).toHaveValue('do not send after closure');
  expect(FixtureSocket.instances.flatMap(socket => socket.frames).filter(frame => frame[0] === 'EVENT')).toEqual([]);
}, 15000);

it.each(['ban', 'channel removal'])('blocks a pending seal immediately on signed %s before React renders', async change => {
  const { community, generalChannelId, owner, ownerSigner, inviteUrl, events, control } = await makeTestCommunity();
  vi.stubGlobal('WebSocket', FixtureSocket); FixtureSocket.acceptPublications = true;
  let resumeSeal: (() => void) | undefined; let seals = 0;
  const delayedSigner = { signEvent: async (template: Parameters<typeof finalizeEvent>[0]) => {
    if (template.kind === 20013 && ++seals === 2) await new Promise<void>(resolve => { resumeSeal = resolve; });
    return finalizeEvent(template, sk);
  } };
  const { result } = renderHook(() => useCommunityChat(inviteUrl, delayedSigner, bytesToHex(generalChannelId)));
  await waitFor(() => expect(result.current.channelReady).toBe(true), { timeout: 10000 });
  const rumor = messageRumor({ author: getPublicKey(sk), channelId: bytesToHex(generalChannelId), epoch: 0, body: 'must not publish', createdAt: Math.floor(Date.now() / 1000), ms: 0 });
  let outcome = '';
  const pending = result.current.send(rumor).then(() => { outcome = 'accepted'; }, () => { outcome = 'refused'; });
  await waitFor(() => expect(resumeSeal).toBeDefined());
  const head = foldCommunity(community, events).heads.get(bytesToHex(generalChannelId))!;
  const edition = change === 'ban'
    ? buildBanlistEdition(community.id, [getPublicKey(sk)], { actorPubkey: owner, version: 1n })
    : buildChannelEdition(generalChannelId, { name: 'general', private: false, deleted: true }, { actorPubkey: owner, version: 2n, prevHash: head.hash });
  const update = await sealEdition(edition, control, ownerSigner);
  await act(async () => {
    for (const socket of FixtureSocket.instances) socket.push(update);
    resumeSeal!();
    await pending;
  });
  expect(outcome).toBe('refused');
  expect(FixtureSocket.instances.flatMap(socket => socket.frames).filter(frame => frame[0] === 'EVENT')).toHaveLength(1); // Only the earlier acknowledged Join.
}, 15000);
