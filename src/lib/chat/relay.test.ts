/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { describe, expect, it, vi } from 'vitest';
import { ConcordRelayClient, signerCipher } from './relay';
import { messageRumor } from './protocol';

class FakeSocket {
  sent: string[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  readyState = 1;
  send(d: string) { this.sent.push(d); }
  close() { /* noop */ }
  emit(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
}

describe('ConcordRelayClient', () => {
  it('publishes a signed rumor and delivers subscribed rumors, dropping expired', async () => {
    const sock = new FakeSocket();
    const signer = {
      getPublicKey: async () => 'a'.repeat(64),
      signEvent: async (e: object) => ({ ...(e as object), id: 'signed-id', sig: 's'.repeat(128) }),
      nip44: { encrypt: async (_p: string, t: string) => `enc:${t}`, decrypt: async (_p: string, c: string) => c.slice(4) },
    };
    const client = new ConcordRelayClient('ws://127.0.0.1:7777', signer as never, () => sock as never);
    const seen: string[] = [];
    await client.connect();
    client.subscribeChannel('chan1', (r) => seen.push(r.id ?? ''), 'sub1');
    const rumor = messageRumor({ author: 'a'.repeat(64), channelId: 'chan1', epoch: 0, body: 'hi', createdAt: 1700000000, ms: 1 });
    await client.publishRumor(rumor);
    const frames = sock.sent.map((s) => JSON.parse(s) as unknown[]);
    expect(frames.some((f) => f[0] === 'REQ')).toBe(true);
    expect(frames.some((f) => f[0] === 'EVENT' && (f[1] as { sig?: string }).sig === 's'.repeat(128))).toBe(true);
    sock.emit(['EVENT', 'sub1', { ...rumor, id: rumor.id, sig: 'x' }]);
    sock.emit(['EVENT', 'sub1', { ...rumor, id: 'expired1', tags: [...rumor.tags, ['expiration', '1']] }]);
    expect(seen).toEqual([rumor.id]);
    const cipher = signerCipher(signer as never);
    await expect(cipher.encrypt('b'.repeat(64), 'hello')).resolves.toBe('enc:hello');
    await expect(cipher.decrypt('b'.repeat(64), 'enc:hello')).resolves.toBe('hello');
    client.close();
    expect(sock.sent.map((s) => JSON.parse(s) as unknown[]).some((f) => f[0] === 'CLOSE')).toBe(true);
    void vi;
  });
});
