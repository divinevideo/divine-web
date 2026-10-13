/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Lazy /chat routes — community/channel/thread/invite in one POC shell page.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChatShell } from '@/components/chat/ChatShell';
import { useChatSession } from '@/hooks/useChatSession';
import { canPostToChat, foldChatRumors, foldControlEditions, type Rumor } from '@/lib/chat/protocol';
import { channelRumors, ConcordRelayClient, pocStreamKey } from '@/lib/chat/relay';
import { CONCORD_RELAY_URL } from '@/lib/chat/store';
import { streamKeyFromListEntry } from '@/lib/chat/protocol';

export default function ChatPage() {
  const { communityId, channelId, threadId } = useParams();
  const { isLoggedIn, isResolvingJwt, user, signer, store } = useChatSession();
  const [rumors, setRumors] = useState<Rumor[]>([]);
  const relay = useMemo(() => {
    if (!signer || !channelId) return null;
    return new ConcordRelayClient(CONCORD_RELAY_URL, signer as never);
  }, [signer, channelId]);
  // Held kind-33302 keys win (private channels especially); the labeled POC
  // key is only the fallback for communities the list does not hold yet.
  const stream = useMemo(() => {
    if (!channelId) return null;
    const entry = store?.listDoc?.entries[0];
    const heldChannel = entry?.current.channels.find((c) => c.name === channelId || c.id === channelId);
    const held = entry && heldChannel ? streamKeyFromListEntry(entry as never, heldChannel.id) : null;
    return held ?? pocStreamKey(channelId);
  }, [channelId, store]);
  useEffect(() => {
    if (!relay || !channelId || !stream) return;
    let off: (() => void) | undefined;
    void relay.connect().then(() => {
      off = relay.subscribeSealed(stream, (r) => setRumors((m) => (m.some((x) => x.id === r.id) ? m : [...m, r])));
    }).catch(() => { /* shell shows reconnecting via online/offline state */ });
    return () => { off?.(); relay.close(); };
  }, [relay, channelId, stream]);
  if (isResolvingJwt) return <p role="status">Loading chat…</p>;
  if (!isLoggedIn) return <p role="status">Log in to join the conversation. We opened the login for you.</p>;
  const control = user ? foldControlEditions(user.pubkey, []) : null;
  const live = foldChatRumors(channelId ? channelRumors(rumors, channelId) : []);
  return (
    <main>
      <h1>Chat</h1>
      {/* Keyed so the timeline and draft reset per account, community, channel and thread. */}
      <ChatShell key={`${user?.pubkey}:${communityId}:${channelId}:${threadId}`} communityId={communityId} channelId={channelId} threadId={threadId}
        authorPubkey={user?.pubkey}
        liveMessages={relay ? live : undefined}
        onSendLive={relay && stream ? (r) => { setRumors((m) => [...m, r]); relay.publishSealed(r, stream).catch(() => setRumors((m) => m.filter((x) => x.id !== r.id))); } : undefined}
        canPost={control && user ? canPostToChat(control, user.pubkey) : true} />
    </main>
  );
}
export function ChatInvitePage() { return <ChatPage />; }
