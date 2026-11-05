// ABOUTME: Real owner-rooted community entry; never substitutes demo channels when verification fails.
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatShell } from '@/components/chat/ChatShell';
import { useCommunityChat } from '@/hooks/useCommunityChat';
import { submitRoomReport } from '@/lib/chat/reports';
import type { CommunitySigner } from '@/lib/chat/communityRelay';

export function CommunityChatPage({ inviteUrl, signer, pubkey, communityId, channelId, threadId, onVerified }: {
  inviteUrl: string; signer: CommunitySigner; pubkey: string; communityId?: string; channelId?: string; threadId?: string; onVerified?: (communityId: string) => void;
}) {
  const navigate = useNavigate();
  const reporting = useRef<AbortController>();
  useEffect(() => { const controller = new AbortController(); reporting.current = controller; return () => controller.abort(); }, [pubkey]);
  const chat = useCommunityChat(inviteUrl, signer, channelId);
  const id = chat.session?.community.idHex;
  const mismatch = Boolean(id && communityId && communityId !== id);
  useEffect(() => { if (chat.session && chat.status === 'ready' && !mismatch) onVerified?.(chat.session.community.idHex); }, [chat.session, chat.status, mismatch, onVerified]);
  useEffect(() => {
    if (id && !communityId) navigate(`/chat/${id}`, { replace: true });
  }, [id, communityId, navigate]);
  const channels = chat.channels.map(channel => ({ id: channel.idHex, name: channel.name }));
  const unavailable = mismatch || Boolean(channelId && chat.status === 'ready' && !chat.channel);
  return <main><h1>Chat</h1>
    {chat.error && <p role="status">{chat.error}</p>}
    {threadId && <p role="status">Thread replies are not available here yet.</p>}
    {unavailable && <p role="alert">This community or channel is unavailable.</p>}
    <ChatShell key={`${pubkey}:${communityId}:${channelId}:${threadId}`} communityId={id ?? communityId} channelId={channelId} threadId={threadId}
      communities={id && chat.session ? [{ id, name: chat.session.control.metadata?.name ?? chat.session.community.name, channels }] : []}
      connectionState={chat.status === 'ready' ? 'ready' : chat.status} onRetry={chat.reconnect}
      authorPubkey={pubkey} liveMessages={unavailable ? [] : chat.messages}
      binding={chat.channel ? { channelId: chat.channel.idHex, epoch: Number(chat.channel.current.epoch) } : undefined}
      canPost={!unavailable && !threadId && chat.status === 'ready' && chat.channelReady && !!chat.channel && !chat.session?.control.banned.has(pubkey)}
      onReportLive={id && chat.channel && !unavailable ? (rumorId, reason) => submitRoomReport(
        import.meta.env.VITE_CONCORD_REPORTS_URL || 'https://chat-reports.divine.video/v1/reports', signer,
        { communityId: id, channelId: chat.channel!.idHex, rumorId }, reason, undefined, reporting.current?.signal) : undefined}
      onSendLive={chat.send} />
  </main>;
}
