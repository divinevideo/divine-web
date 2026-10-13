/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Live relay client for Concord chat — existing signer only, no new login or token store.
// ABOUTME: The page's transport is kind 1059 wraps around 20013 seals (built in protocol.ts); publishRumor/subscribeChannel are the unused plaintext path.
import { groupKey, hexToBytes, isExpiredRumor, openWrap, sealRumor, sha256Bytes, verifyChatRumor, wrapSeal, type GroupKey, type Nip44Cipher, type Rumor, type SignerLike } from './protocol';
import { verifyEvent, type Event as NostrEvent } from 'nostr-tools';

/** POC stream key until kind-33302-held community keys are loaded: deterministic per channel, public by construction. Real private channels must use held channel keys instead. */
export function pocStreamKey(channelId: string): GroupKey {
  const secret = sha256Bytes(new TextEncoder().encode(`concord-poc-stream:${channelId}`));
  return groupKey('concord/channel', secret, hexToBytes('0'.repeat(64)), 0);
}

export interface SocketLike {
  send(data: string): void;
  close(): void;
  onmessage: ((e: { data: string }) => void) | null;
  onopen: (() => void) | null;
  onclose?: (() => void) | null;
  readyState: number;
}

export function signerCipher(signer: SignerLike): Nip44Cipher {
  if (!signer.nip44) throw new Error('concord: signer lacks nip44; envelopes unavailable');
  return signer.nip44;
}

const CHAT_KINDS = [9, 1111, 7, 3302, 5, 1740];

/** Rumors bound to one channel; a page's timeline must not carry another channel's messages. */
export const channelRumors = (rumors: Rumor[], channelId: string): Rumor[] =>
  rumors.filter((r) => r.tags.some((t) => t[0] === 'channel' && t[1] === channelId));

export class ConcordRelayClient {
  private socket: SocketLike | null = null;
  private handlers = new Map<string, (r: Rumor) => void>();
  private opened: Promise<void> | null = null;
  private rejectOpen: (() => void) | null = null;
  constructor(
    private url: string,
    private signer: SignerLike & { signEvent(e: never): Promise<{ id?: string; sig?: string }> },
    private makeSocket: (url: string) => SocketLike = (u) => new WebSocket(u) as unknown as SocketLike,
  ) {}

  connect(): Promise<void> {
    this.socket = this.makeSocket(this.url);
    this.socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as unknown[];
        if (msg[0] !== 'EVENT') return;
        const subId = msg[1] as string;
        const ev = msg[2] as Rumor & { sig?: string };
        const handler = this.handlers.get(subId);
        if (!handler || !ev) return;
        if (!verifyEvent(ev as unknown as NostrEvent)) return;
        if (ev.kind === 1059) { handler(ev); return; }
        const channelId = ev.tags?.find((t) => t[0] === 'channel')?.[1] ?? '';
        const epoch = Number(ev.tags?.find((t) => t[0] === 'epoch')?.[1] ?? 0);
        if (verifyChatRumor(ev, { channelId, epoch }) !== null) return;
        if (isExpiredRumor(ev, Math.floor(Date.now() / 1000))) return;
        handler(ev);
      } catch { /* ignore malformed relay frames */ }
    };
    const socket = this.socket;
    this.opened = socket.readyState === 1 ? Promise.resolve() : new Promise((resolve, reject) => {
      socket.onopen = () => resolve();
      // A refused handshake or a close before OPEN settles the attempt, so waiting sends reject.
      // Each socket settles only its own attempt: a replaced socket that finishes closing late must not fail the next one.
      const fail = () => reject(new Error('concord: relay closed'));
      this.rejectOpen = fail;
      socket.onclose = fail;
    });
    this.opened.catch(() => undefined);
    return this.opened;
  }

  /** Publish only on an open socket; a closed client rejects so the caller can drop its optimistic echo. */
  private async sendEvent(event: unknown): Promise<void> {
    if (this.opened) await this.opened;
    if (!this.socket || this.socket.readyState !== 1) throw new Error('concord: relay closed');
    this.socket.send(JSON.stringify(['EVENT', event]));
  }

  subscribeChannel(channelId: string, onRumor: (r: Rumor) => void, subId = `chat-${channelId}`): () => void {
    this.handlers.set(subId, onRumor);
    this.socket?.send(JSON.stringify(['REQ', subId, { kinds: CHAT_KINDS, '#channel': [channelId] }]));
    return () => { this.handlers.delete(subId); this.socket?.send(JSON.stringify(['CLOSE', subId])); };
  }

  async publishRumor(rumor: Rumor): Promise<void> {
    const signed = await this.signer.signEvent(rumor as never) as unknown as Record<string, unknown>;
    await this.sendEvent({ ...rumor, ...signed });
  }

  /** Live transport is now the sealed plane: seal with the author signer, wrap under the stream key, publish kind 1059. */
  async publishSealed(rumor: Rumor, stream: GroupKey): Promise<void> {
    const seal = await sealRumor(rumor, 20013, stream, (t) => this.signer.signEvent(t as never) as Promise<NostrEvent>);
    const wrap = wrapSeal(seal, stream);
    await this.sendEvent(wrap);
  }

  subscribeSealed(stream: GroupKey, onRumor: (r: Rumor) => void, subId = `sealed-${stream.pubkey.slice(0, 12)}`): () => void {
    const handler = (ev: Rumor) => {
      try {
        const opened = openWrap(ev as unknown as NostrEvent, stream);
        if (isExpiredRumor(opened.rumor, Math.floor(Date.now() / 1000))) return;
        onRumor(opened.rumor);
      } catch { /* reject unverifiable wraps */ }
    };
    this.handlers.set(subId, handler as (r: Rumor) => void);
    this.socket?.send(JSON.stringify(['REQ', subId, { kinds: [1059], authors: [stream.pubkey] }]));
    return () => { this.handlers.delete(subId); this.socket?.send(JSON.stringify(['CLOSE', subId])); };
  }

  close(): void {
    for (const subId of this.handlers.keys()) this.socket?.send(JSON.stringify(['CLOSE', subId]));
    this.handlers.clear();
    this.rejectOpen?.();
    this.rejectOpen = null;
    this.socket?.close();
    this.socket = null;
    this.opened = null;
  }
}
