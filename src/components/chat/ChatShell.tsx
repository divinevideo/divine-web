/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Chat UI shell — lists, timeline, composer, all POC states. Phosphor icons, brand rules.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChatCircle, Hash, PaperPlaneTilt, WarningCircle, WifiSlash } from '@phosphor-icons/react';
import { messageRumor, type Rumor } from '@/lib/chat/protocol';

export type ChatViewState = 'loading' | 'ready' | 'empty' | 'reconnecting' | 'failure' | 'denied';
const DEMO_COMMUNITIES = [{ id: 'demo-community', name: 'Divine test community', channels: ['general', 'introductions'] }];

export function ChatShell({ communityId, channelId, threadId, canPost = true, initialState = 'empty', liveMessages, onSendLive, authorPubkey, binding, communities = DEMO_COMMUNITIES, connectionState, onRetry, onReportLive }: {
  communityId?: string; channelId?: string; threadId?: string; canPost?: boolean; initialState?: ChatViewState;
  liveMessages?: Rumor[]; onSendLive?: (rumor: Rumor) => void | Promise<void>; authorPubkey?: string;
  /** Channel id and epoch that outgoing rumors carry; defaults to the route channel at epoch 0. */
  binding?: { channelId: string; epoch: number };
  communities?: { id: string; name: string; channels: (string | { id: string; name: string })[] }[];
  connectionState?: ChatViewState; onRetry?: () => void;
  onReportLive?: (rumorId: string, reason: string) => Promise<string>;
}) {
  const [state, setState] = useState<ChatViewState>(initialState);
  const [localMessages, setMessages] = useState<Rumor[]>([]);
  const messages = liveMessages ?? localMessages;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const viewState = connectionState ?? state;
  const [reportTarget, setReportTarget] = useState<string>();
  const [reportReason, setReportReason] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [reporting, setReporting] = useState(false);
  const displayCommunity = communities.find(community => community.id === communityId);
  const displayChannel = displayCommunity?.channels.find(channel => typeof channel === 'string' ? channel === channelId : channel.id === channelId);
  const channelLabel = typeof displayChannel === 'string' ? displayChannel : displayChannel?.name ?? channelId;
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { composerRef.current?.focus(); }, [channelId]);
  useEffect(() => {
    const off = () => setState((s) => s === 'ready' || s === 'empty' ? 'reconnecting' : s);
    const on = () => setState((s) => s === 'reconnecting' ? 'empty' : s);
    window.addEventListener('offline', off); window.addEventListener('online', on);
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on); };
  }, []);

  if (viewState === 'denied') return <p role="alert">You do not have permission to post here.</p>;

  const send = async () => {
    const body = draft.trim(); if (!body || !canPost || sending) return;
    const now = Date.now();
    const rumor = messageRumor({ author: authorPubkey ?? 'you', channelId: binding?.channelId ?? channelId ?? 'general', epoch: binding?.epoch ?? 0, body, createdAt: Math.floor(now / 1000), ms: now % 1000 });
    setSendError(false); setSending(true);
    try {
      if (onSendLive) { const result = onSendLive(rumor); if (result) await result; } else setMessages((m) => [...m, rumor]);
      setDraft(current => current === draft ? '' : current); setState('ready');
    } catch { setSendError(true); } finally { setSending(false); }
  };
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <nav aria-label="Communities">
        <h2>Communities</h2>
        <ul>{communities.map((c) => (
          <li key={c.id}><Link to={`/chat/${c.id}`}>{c.name}</Link>
            <ul>{c.channels.map((ch) => { const id = typeof ch === 'string' ? ch : ch.id; const name = typeof ch === 'string' ? ch : ch.name; return <li key={id}><Link to={`/chat/${c.id}/${id}`}><Hash aria-hidden /> {name}</Link></li>; })}</ul>
          </li>))}
        </ul>
      </nav>
      <section aria-label="Channel timeline" style={{ flex: 1 }}>
        <h2><ChatCircle aria-hidden /> {channelLabel ?? 'Pick a channel'}{communityId ? ` in ${displayCommunity?.name ?? communityId}` : ''}{threadId ? ` · thread ${threadId}` : ''}</h2>
        {viewState === 'reconnecting' && <p role="status"><WifiSlash aria-hidden /> Reconnecting…</p>}
        {viewState === 'loading' && <p role="status">Loading chat…</p>}
        {viewState === 'failure' && <div role="alert"><WarningCircle aria-hidden /> Could not load this community. <button type="button" onClick={onRetry ?? (() => setState('empty'))}>Try again</button></div>}
        {sendError && <p role="alert">Message was not sent. Your draft is still here.</p>}
        {messages.length === 0 ? <p>Nothing looping yet. Go find your people.</p> : (
          <ol>{messages.map((m) => <li key={m.id}><strong>{m.pubkey}:</strong> {m.content}{onReportLive && m.id && <button type="button" onClick={() => { setReportTarget(m.id); setReportStatus(''); }}>Report message</button>}</li>)}</ol>
        )}
        {reportTarget && onReportLive && <form onSubmit={async event => {
          event.preventDefault(); if (reporting || !reportReason.trim()) return;
          setReporting(true); setReportStatus('');
          try { const caseId = await onReportLive(reportTarget, reportReason); setReportStatus(`Report received. Case ${caseId}`); setReportTarget(undefined); setReportReason(''); }
          catch { setReportStatus('Report was not sent. Your reason is still here.'); }
          finally { setReporting(false); }
        }}>
          <label htmlFor="room-report-reason">Why are you reporting this message?</label>
          <textarea id="room-report-reason" maxLength={2048} value={reportReason} onChange={event => setReportReason(event.target.value)} />
          <button type="submit" disabled={reporting || !reportReason.trim()}>Submit report</button>
          <button type="button" disabled={reporting} onClick={() => setReportTarget(undefined)}>Cancel</button>
        </form>}
        {reportStatus && <p role="status">{reportStatus}</p>}
        <div>
          <label htmlFor="chat-composer">Message</label>
          <textarea id="chat-composer" ref={composerRef} value={draft} disabled={!canPost}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button type="button" onClick={send} disabled={!canPost || sending || !draft.trim()}>
            <PaperPlaneTilt aria-hidden /> Send
          </button>
          {!canPost && <p role="alert">You do not have permission to post here.</p>}
        </div>
      </section>
    </div>
  );
}
