/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Lazy /chat routes — community/channel/thread/invite in one POC shell page.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LoginArea } from '@/components/auth/LoginArea';
import { ChatShell } from '@/components/chat/ChatShell';
import { useChatSession } from '@/hooks/useChatSession';
import { canPostToChat, foldChatRumors, foldControlEditions, heldStream, type Rumor } from '@/lib/chat/protocol';
import { channelRumors, ConcordRelayClient, pocStreamKey } from '@/lib/chat/relay';
import { CONCORD_RELAY_URL } from '@/lib/chat/store';

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
  // A held channel also fixes the canonical channel id and epoch its rumors carry.
  const held = useMemo(
    () => (channelId ? heldStream(store?.listDoc?.entries ?? [], communityId, channelId) : null),
    [communityId, channelId, store],
  );
  const stream = useMemo(() => (held ? held.key : channelId ? pocStreamKey(channelId) : null), [held, channelId]);
  const binding = useMemo(
    () => (held ? { channelId: held.channelId, epoch: held.epoch } : channelId ? { channelId, epoch: 0 } : undefined),
    [held, channelId],
  );
  useEffect(() => {
    if (!relay || !channelId || !stream) return;
    let off: (() => void) | undefined;
    void relay.connect().then(() => {
      off = relay.subscribeSealed(stream, (r) => setRumors((m) => (m.some((x) => x.id === r.id) ? m : [...m, r])));
    }).catch(() => { /* shell shows reconnecting via online/offline state */ });
    return () => { off?.(); relay.close(); };
  }, [relay, channelId, stream]);
  if (isResolvingJwt) return <p role="status">Loading chat…</p>;
  // /invite/<naddr> renders outside the app layout, whose LoginArea is what mounts the
  // login dialog, so the page brings its own; its button also reopens a dismissed dialog.
  if (!isLoggedIn) {
    return (
      <div>
        <p role="status">Log in to join the conversation. We opened the login for you.</p>
        <LoginArea />
      </div>
    );
  }
  const control = user ? foldControlEditions(user.pubkey, []) : null;
  const live = foldChatRumors(binding ? channelRumors(rumors, binding.channelId) : []);
  return (
    <main>
      <h1>Chat</h1>
      {/* Keyed so the timeline and draft reset per account, community, channel and thread. */}
      <ChatShell key={`${user?.pubkey}:${communityId}:${channelId}:${threadId}`} communityId={communityId} channelId={channelId} threadId={threadId}
        authorPubkey={user?.pubkey} binding={binding}
        liveMessages={relay ? live : undefined}
        onSendLive={relay && stream ? (r) => { setRumors((m) => [...m, r]); relay.publishSealed(r, stream).catch(() => setRumors((m) => m.filter((x) => x.id !== r.id))); } : undefined}
        canPost={control && user ? canPostToChat(control, user.pubkey) : true} />
    </main>
  );
}
export function ChatInvitePage() { return <ChatPage />; }
