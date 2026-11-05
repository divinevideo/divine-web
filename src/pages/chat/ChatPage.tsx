/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Lazy /chat routes — community/channel/thread/invite in one POC shell page.
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { ChatInviteContext } from '@/contexts/ChatInviteContext';
import { LoginArea } from '@/components/auth/LoginArea';
import { ChatShell } from '@/components/chat/ChatShell';
import { useChatSession } from '@/hooks/useChatSession';
import { canPostToChat, foldChatRumors, foldControlEditions, heldStream, type Rumor } from '@/lib/chat/protocol';
import { channelRumors, ConcordRelayClient, pocStreamKey } from '@/lib/chat/relay';
import { CONCORD_RELAY_URL } from '@/lib/chat/store';
import { CommunityChatPage } from './CommunityChatPage';
import { consumeInvite, peekInvite, parseInviteUrl, resumeInviteUrl } from '@/lib/chat/invite';

export default function ChatPage() {
  const { communityId, channelId, threadId } = useParams();
  const { key: routeKey } = useLocation();
  const { isLoggedIn, isAuthPending, user, signer, store } = useChatSession();
  const [rumors, setRumors] = useState<Rumor[]>([]);
  const configuredInvite = import.meta.env.VITE_CONCORD_INVITE_URL as string | undefined;
  const account = user?.pubkey;
  const retained = useContext(ChatInviteContext);
  const captureInvitation = () => {
    const captured = parseInviteUrl(window.location.pathname, window.location.hash);
    const explicit = window.location.pathname.startsWith('/invite/naddr1');
    const held = retained?.account === account && (communityId ? retained?.selection?.communityId === communityId : !configuredInvite)
      ? retained?.selection?.invite ?? null : null;
    const invite = captured ?? (explicit ? null : peekInvite() ?? held);
    return { routeKey, account, invite, real: explicit || Boolean(resumeInviteUrl(invite)), invalid: explicit && !resumeInviteUrl(captured) };
  };
  const [invitation, setInvitation] = useState(captureInvitation);
  if (invitation.routeKey !== routeKey) setInvitation(captureInvitation());
  else if (invitation.account !== account) {
    setInvitation({ ...invitation, account, invite: invitation.account ? null : invitation.invite });
  }
  const invite = invitation.account === account ? invitation.invite : null;
  const clearPendingInvite = useCallback(() => {
    const pending = peekInvite();
    if (invite?.naddr && pending?.naddr === invite.naddr && pending.tokenHex === invite.tokenHex) consumeInvite();
  }, [invite]);
  useEffect(() => () => { if (invitation.account) clearPendingInvite(); }, [invitation.account, clearPendingInvite]);
  const inviteUrl = invitation.invalid ? undefined : resumeInviteUrl(invite) ?? configuredInvite;
  const pocEnabled = import.meta.env.DEV || import.meta.env.VITE_CHAT_POC_ENABLED === 'true';
  const needsInvite = !inviteUrl && (invitation.real || !pocEnabled);
  const verified = useCallback((verifiedCommunityId: string) => {
    if (invite && account && retained?.account === account) retained.retain(verifiedCommunityId, invite);
    clearPendingInvite();
  }, [invite, account, retained, clearPendingInvite]);
  const relay = useMemo(() => {
    if (inviteUrl || needsInvite || !signer || !channelId) return null;
    return new ConcordRelayClient(CONCORD_RELAY_URL, signer as never);
  }, [signer, channelId, inviteUrl, needsInvite]);
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
    }).catch(() => { /* a failed connect is not shown; the shell only tracks the browser's online/offline state */ });
    return () => { off?.(); relay.close(); };
  }, [relay, channelId, stream]);
  if (invitation.invalid) return <p role="alert">This community invite is invalid or incomplete. Open the complete invite link.</p>;
  if (isAuthPending) return <p role="status">Loading chat…</p>;
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
  if (needsInvite) return <p role="alert">Open a community invite to use chat with this account.</p>;
  if (inviteUrl && !signer) return <p role="alert">Your account signer is unavailable. Reconnect your account to use chat.</p>;
  if (inviteUrl && signer && user) return <CommunityChatPage key={user.pubkey} inviteUrl={inviteUrl} signer={signer as never} pubkey={user.pubkey} communityId={communityId} channelId={channelId} threadId={threadId} onVerified={verified} />;
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
