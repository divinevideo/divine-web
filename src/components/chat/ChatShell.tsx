/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Chat UI shell — lists, timeline, composer, all POC states. Phosphor icons, brand rules.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChatCircle, Hash, PaperPlaneTilt, WarningCircle, WifiSlash } from '@phosphor-icons/react';
import { messageRumor, type Rumor } from '@/lib/chat/protocol';

export type ChatViewState = 'loading' | 'ready' | 'empty' | 'reconnecting' | 'failure' | 'denied';
const DEMO_COMMUNITIES = [{ id: 'demo-community', name: 'Divine test community', channels: ['general', 'introductions'] }];

export function ChatShell({ communityId, channelId, threadId, canPost = true, initialState = 'empty', liveMessages, onSendLive, authorPubkey }: {
  communityId?: string; channelId?: string; threadId?: string; canPost?: boolean; initialState?: ChatViewState;
  liveMessages?: Rumor[]; onSendLive?: (rumor: Rumor) => void; authorPubkey?: string;
}) {
  const [state, setState] = useState<ChatViewState>(initialState);
  const [localMessages, setMessages] = useState<Rumor[]>([]);
  const messages = liveMessages ?? localMessages;
  const [draft, setDraft] = useState('');
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { composerRef.current?.focus(); }, [channelId]);
  useEffect(() => {
    const off = () => setState((s) => s === 'ready' || s === 'empty' ? 'reconnecting' : s);
    const on = () => setState((s) => s === 'reconnecting' ? 'empty' : s);
    window.addEventListener('offline', off); window.addEventListener('online', on);
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on); };
  }, []);

  if (state === 'loading') return <p role="status">Loading chat…</p>;
  if (state === 'failure') return <div role="alert"><WarningCircle aria-hidden /> Something broke on our end. <button type="button" onClick={() => setState('empty')}>Try again</button></div>;
  if (state === 'denied') return <p role="alert">You do not have permission to post here.</p>;

  const send = () => {
    const body = draft.trim(); if (!body || !canPost) return;
    const rumor = messageRumor({ author: authorPubkey ?? 'you', channelId: channelId ?? 'general', epoch: 0, body, createdAt: Math.floor(Date.now()/1000), ms: Date.now()%1000 });
    if (onSendLive) onSendLive(rumor); else setMessages((m) => [...m, rumor]);
    setDraft(''); setState('ready');
  };
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <nav aria-label="Communities">
        <h2>Communities</h2>
        <ul>{DEMO_COMMUNITIES.map((c) => (
          <li key={c.id}><Link to={`/chat/${c.id}`}>{c.name}</Link>
            <ul>{c.channels.map((ch) => <li key={ch}><Link to={`/chat/${c.id}/${ch}`}><Hash aria-hidden /> {ch}</Link></li>)}</ul>
          </li>))}
        </ul>
      </nav>
      <section aria-label="Channel timeline" style={{ flex: 1 }}>
        <h2><ChatCircle aria-hidden /> {channelId ?? 'Pick a channel'}{communityId ? ` in ${communityId}` : ''}{threadId ? ` · thread ${threadId}` : ''}</h2>
        {state === 'reconnecting' && <p role="status"><WifiSlash aria-hidden /> Reconnecting…</p>}
        {messages.length === 0 ? <p>Nothing looping yet. Go find your people.</p> : (
          <ol>{messages.map((m) => <li key={m.id}><strong>{m.pubkey}:</strong> {m.content}</li>)}</ol>
        )}
        <div>
          <label htmlFor="chat-composer">Message</label>
          <textarea id="chat-composer" ref={composerRef} value={draft} disabled={!canPost}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button type="button" onClick={send} disabled={!canPost || !draft.trim()}>
            <PaperPlaneTilt aria-hidden /> Send
          </button>
          {!canPost && <p role="alert">You do not have permission to post here.</p>}
        </div>
      </section>
    </div>
  );
}
