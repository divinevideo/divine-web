/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Lazy /chat routes — community/channel/thread/invite in one POC shell page.
import { useParams } from 'react-router-dom';
import { ChatShell } from '@/components/chat/ChatShell';
import { useChatSession } from '@/hooks/useChatSession';
import { canPostToChat, foldControlEditions } from '@/lib/chat/protocol';

export default function ChatPage() {
  const { communityId, channelId, threadId } = useParams();
  const { isLoggedIn, isResolvingJwt, user } = useChatSession();
  if (isResolvingJwt) return <p role="status">Loading chat…</p>;
  if (!isLoggedIn) return <p role="status">Log in to join the conversation. We opened the login for you.</p>;
  const control = user ? foldControlEditions(user.pubkey, []) : null;
  return (
    <main>
      <h1>Chat</h1>
      {/* Keyed so the timeline and draft reset per account, community, channel and thread. */}
      <ChatShell key={`${user?.pubkey}:${communityId}:${channelId}:${threadId}`} communityId={communityId} channelId={channelId} threadId={threadId}
        canPost={control && user ? canPostToChat(control, user.pubkey) : true} />
    </main>
  );
}
export function ChatInvitePage() { return <ChatPage />; }
