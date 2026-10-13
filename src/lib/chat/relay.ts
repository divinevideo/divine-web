/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Live relay client for Concord chat — existing signer only, no new login or token store.
// ABOUTME: Public-channel POC transport is signed rumor kinds 9/1111/7/3302/5; private sealing stays in protocol.ts.
import { isExpiredRumor, verifyChatRumor, type Nip44Cipher, type Rumor, type SignerLike } from './protocol';

export interface SocketLike {
  send(data: string): void;
  close(): void;
  onmessage: ((e: { data: string }) => void) | null;
  onopen: (() => void) | null;
  readyState: number;
}

export function signerCipher(signer: SignerLike): Nip44Cipher {
  if (!signer.nip44) throw new Error('concord: signer lacks nip44; envelopes unavailable');
  return signer.nip44;
}

const CHAT_KINDS = [9, 1111, 7, 3302, 5, 1740];

export class ConcordRelayClient {
  private socket: SocketLike | null = null;
  private handlers = new Map<string, (r: Rumor) => void>();
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
        const channelId = ev.tags?.find((t) => t[0] === 'channel')?.[1] ?? '';
        const epoch = Number(ev.tags?.find((t) => t[0] === 'epoch')?.[1] ?? 0);
        if (verifyChatRumor(ev, { channelId, epoch }) !== null) return;
        if (isExpiredRumor(ev, Math.floor(Date.now() / 1000))) return;
        handler(ev);
      } catch { /* ignore malformed relay frames */ }
    };
    if (this.socket.readyState === 1) return Promise.resolve();
    return new Promise((resolve) => { this.socket!.onopen = () => resolve(); });
  }

  subscribeChannel(channelId: string, onRumor: (r: Rumor) => void, subId = `chat-${channelId}`): () => void {
    this.handlers.set(subId, onRumor);
    this.socket?.send(JSON.stringify(['REQ', subId, { kinds: CHAT_KINDS, '#channel': [channelId] }]));
    return () => { this.handlers.delete(subId); this.socket?.send(JSON.stringify(['CLOSE', subId])); };
  }

  async publishRumor(rumor: Rumor): Promise<void> {
    const signed = await this.signer.signEvent(rumor as never) as unknown as Record<string, unknown>;
    this.socket?.send(JSON.stringify(['EVENT', { ...rumor, ...signed }]));
  }

  close(): void {
    for (const subId of this.handlers.keys()) this.socket?.send(JSON.stringify(['CLOSE', subId]));
    this.handlers.clear();
    this.socket?.close();
    this.socket = null;
  }
}
