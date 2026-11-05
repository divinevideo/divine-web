// ABOUTME: Verified live community state; all decrypted state and sockets belong to one mounted account.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Event as NostrEvent } from 'nostr-tools';
import { CommunityRelay, type CommunitySigner } from '@/lib/chat/communityRelay';
import { controlGroups, decodeCommunityInvite, foldCommunity, parseInviteLink, publicChannels, readCommunityChat, requireCompleteCommunity, type CommunityV2, type FoldedControl } from '@/lib/chat/community';
import { buildJoinRumor, currentGuestbookGroup, sealGuestbook } from '@/lib/chat/concord-core/guestbook';
import { sealRumor, wrapSeal } from '@/lib/chat/concord-core/stream';
import { authorityChangeEvidence, communityWatchKeys, type AuthorityChange } from '@/lib/chat/authorityChanges';
import type { Rumor } from '@/lib/chat/protocol';

type Session = { generation: number; community: CommunityV2; control: FoldedControl; relays: CommunityRelay[]; pause: (change: AuthorityChange) => void; disconnected: () => void; active: () => boolean };
export function useCommunityChat(inviteUrl: string, signer: CommunitySigner, channelRef?: string) {
  const joined = useRef<string>();
  const controlGeneration = useRef(0);
  const fence = useRef({ dissolved: false, rootEpoch: 0n, channels: new Map<string, bigint>() });
  const [channelReady, setChannelReady] = useState(false);
  const [session, setSession] = useState<Session>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'reconnecting' | 'failure'>('loading');
  const [retry, setRetry] = useState(0);
  const [wraps, setWraps] = useState<NostrEvent[]>([]);
  const [error, setError] = useState<string>();
  const reconnect = useCallback(() => setRetry(value => value + 1), []);
  useEffect(() => {
    let disposed = false; let paused = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const clients: CommunityRelay[] = []; const off: (() => void)[] = [];
    setStatus(retry ? 'reconnecting' : 'loading'); setSession(undefined); setWraps([]); setError(undefined);
    const failed = () => {
      if (disposed || paused) return;
      live.current = { session: undefined, channel: undefined, status: 'failure' };
      setChannelReady(false); setStatus('reconnecting'); setError('Chat disconnected. Your draft is still here.');
      if (!timer) timer = setTimeout(reconnect, 3000);
    };
    const pause = (change: AuthorityChange) => {
      if (disposed || paused) return;
      paused = true;
      const prior = change.kind === 'root' ? fence.current.rootEpoch : change.kind === 'channel' ? fence.current.channels.get(change.id) ?? 0n : 0n;
      if (change.kind === 'dissolved') fence.current.dissolved = true;
      if (change.kind === 'root') fence.current.rootEpoch = change.epoch;
      if (change.kind === 'channel') fence.current.channels.set(change.id, change.epoch);
      live.current = { session: undefined, channel: undefined, status: 'failure' };
      setSession(undefined); setWraps([]); setChannelReady(false);
      clients.forEach(client => client.close());
      if (change.kind === 'dissolved' || prior >= change.epoch) {
        setStatus('failure'); setError(change.kind === 'dissolved' ? 'This community has closed.' : 'Community keys changed. A refreshed public invite is required.');
      } else {
        setStatus('reconnecting'); setError('Community keys changed. Verifying the latest invite…');
        timer = setTimeout(reconnect, 0);
      }
    };
    void (async () => {
      if (fence.current.dissolved) throw new Error('Community closed');
      const invite = parseInviteLink(inviteUrl);
      if (!invite) throw new Error('This community invite is invalid.');
      const bootstrap = invite.bootstrapRelays.map(url => new CommunityRelay(url, signer));
      clients.push(...bootstrap);
      let events: NostrEvent[];
      try {
        events = await Promise.any(bootstrap.map(async client => {
          await client.connect(); const events = await client.query([{ kinds: [33301], authors: [invite.linkSigner], '#d': [''], limit: 8 }]);
          if (!events.length) throw new Error('Invite missing'); return events;
        }));
      } finally { bootstrap.forEach(client => client.close()); }
      if (disposed) return;
      const community = decodeCommunityInvite(inviteUrl, events);
      if (community.rootEpoch < fence.current.rootEpoch) throw new Error('The public invite has not caught up to the new epoch');
      const groups = controlGroups(community);
      const watch = communityWatchKeys(community);
      const relays = community.relays.map(url => new CommunityRelay(url, signer, undefined, failed));
      clients.push(...relays);
      relays.forEach(relay => relay.register([...groups, ...watch.map(key => key.group), currentGuestbookGroup(community)]));
      await Promise.all(relays.map(relay => relay.connect()));
      const filters = [{ kinds: [1059], authors: [...groups.map(group => group.pk), ...watch.map(key => key.group.pk)] }];
      const controlWraps = new Map<string, NostrEvent>();
      const batches = await Promise.all(relays.map(relay => relay.query(filters)));
      for (const batch of batches) for (const event of batch) controlWraps.set(event.id, event);
      const refold = () => {
        if (disposed) return;
        // React may batch this fold behind an external signer's response.
        // Fence the old authority synchronously; a rerender is not a write gate.
        controlGeneration.current++;
        live.current = { session: undefined, channel: undefined, status: 'failure' };
        const control = foldCommunity(community, [...controlWraps.values()]);
        requireCompleteCommunity(control);
        const change = authorityChangeEvidence([...controlWraps.values()], watch, community, control);
        if (change) { pause(change); return; }
        setSession({ generation: controlGeneration.current, community, control, relays, pause, disconnected: failed, active: () => !paused && !disposed }); setStatus('ready'); setError(undefined);
      };
      refold();
      if (paused || disposed) return;
      for (const relay of relays) off.push(relay.subscribe(filters, event => {
        if (controlWraps.has(event.id)) return;
        controlWraps.set(event.id, event);
        try { refold(); } catch { failed(); }
      }, undefined, failed));
    })().catch(() => {
      if (disposed || paused) return;
      setStatus('failure'); setError('Could not verify or load this community. Try again.');
    });
    return () => { disposed = true; if (timer) clearTimeout(timer); off.forEach(fn => fn()); clients.forEach(client => client.close()); };
  }, [inviteUrl, signer, retry, reconnect]);
  const channels = useMemo(() => session ? publicChannels(session.community, session.control) : [], [session]);
  const channel = channels.find(channel => channel.idHex === channelRef || channel.name === channelRef);
  useEffect(() => {
    setWraps([]); setChannelReady(false);
    if (!session || !channel) return;
    let disposed = false;
    const groups = channel.streams.map(stream => stream.group);
    const watch = communityWatchKeys(session.community, channel).filter(key => key.scope === channel.idHex);
    const filters = [{ kinds: [1059], authors: groups.map(group => group.pk) }];
    const safetyFilters = [{ kinds: [1059], authors: watch.map(key => key.group.pk) }];
    const off: (() => void)[] = [];
    const failed = () => {
      if (disposed || !session.active()) return;
      session.disconnected();
    };
    void (async () => {
      for (const relay of session.relays) relay.register([...groups, ...watch.map(key => key.group)]);
      const safety = (await Promise.all(session.relays.map(relay => relay.query(safetyFilters)))).flat();
      if (disposed) return;
      const change = authorityChangeEvidence(safety, watch, session.community, session.control);
      if (change) { session.pause(change); return; }
      setChannelReady(true);
      for (const relay of session.relays) {
        off.push(relay.subscribe(safetyFilters, event => {
          if (disposed) return;
          const change = authorityChangeEvidence([event], watch, session.community, session.control);
          if (change) session.pause(change);
        }, undefined, failed));
        off.push(relay.subscribe(filters, event => {
          if (!disposed) setWraps(current => current.some(wrap => wrap.id === event.id) ? current : [...current, event]);
        }, undefined, failed));
      }
    })().catch(failed);
    return () => { disposed = true; off.forEach(fn => fn()); };
  }, [session, channel]);
  const messages = useMemo(() => session && channel ? readCommunityChat(wraps, channel, session.community, session.control) : [], [wraps, channel, session]);
  const live = useRef({ session, channel, status });
  live.current = { session, channel, status };
  useEffect(() => () => { live.current = { session: undefined, channel: undefined, status: 'failure' }; }, []);
  const send = async (rumor: Rumor) => {
    if (!session || session.generation !== controlGeneration.current || !channel || !channelReady || status !== 'ready' || session.control.banned.has(rumor.pubkey)) throw new Error('Chat is not ready to send.');
    const generation = session.generation;
    const group = channel.current.group;
    if (!rumor.id) throw new Error('Message has no event identity');
    const coordinate = `${session.community.idHex}:${session.community.rootEpoch}`;
    if (joined.current !== coordinate) {
      const join = await sealGuestbook(buildJoinRumor(rumor.pubkey, Date.now()), currentGuestbookGroup(session.community), signer);
      if (controlGeneration.current !== generation || live.current.session !== session || live.current.status !== 'ready') throw new Error('Chat changed before joining');
      await Promise.any(session.relays.map(relay => relay.publish(join)));
      joined.current = coordinate;
    }
    const seal = await sealRumor({ ...rumor, id: rumor.id }, 20013, group, signer);
    // The account/channel can change while an external signer is answering.
    // Disposed relays reject instead of queuing a late send on a new session.
    if (controlGeneration.current !== generation || live.current.session !== session || live.current.channel !== channel || live.current.status !== 'ready' || live.current.session.control.banned.has(rumor.pubkey)) throw new Error('Chat changed before this message was sent.');
    const wrap = wrapSeal(seal, group);
    await Promise.any(session.relays.map(relay => relay.publish(wrap)));
    setWraps(current => current.some(item => item.id === wrap.id) ? current : [...current, wrap]);
  };
  return { session, channels, channel, messages, status, error, reconnect, send, channelReady };
}
