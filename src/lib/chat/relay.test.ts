/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { describe, expect, it, vi } from 'vitest';
import { channelRumors, ConcordRelayClient, pocStreamKey, signerCipher } from './relay';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { messageRumor, sealRumor, withId, wrapSeal, type Rumor } from './protocol';

class FakeSocket {
  sent: string[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 1;
  send(d: string) { this.sent.push(d); }
  close() { /* noop */ }
  emit(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
}

describe('channelRumors', () => {
  it('keeps only the rumors bound to the open channel', () => {
    const a = messageRumor({ author: 'a'.repeat(64), channelId: 'general', epoch: 0, body: 'g', createdAt: 1, ms: 1 });
    const b = messageRumor({ author: 'a'.repeat(64), channelId: 'introductions', epoch: 0, body: 'i', createdAt: 2, ms: 1 });
    expect(channelRumors([a, b], 'introductions')).toEqual([b]);
  });
});

describe('ConcordRelayClient', () => {
  it('rejects a send that is waiting for the handshake when the socket fails or the client closes', async () => {
    const signer = { getPublicKey: async () => 'a'.repeat(64), signEvent: async (e: object) => ({ ...(e as object), sig: 's'.repeat(128) }) };
    const rumor = messageRumor({ author: 'a'.repeat(64), channelId: 'chan1', epoch: 0, body: 'hi', createdAt: 1700000000, ms: 1 });
    const refused = new FakeSocket(); refused.readyState = 0;
    const a = new ConcordRelayClient('ws://127.0.0.1:7777', signer as never, () => refused as never);
    void a.connect().catch(() => undefined);
    const pendingA = a.publishRumor(rumor);
    refused.readyState = 3; refused.onclose?.();
    await expect(pendingA).rejects.toThrow('relay closed');
    const cancelled = new FakeSocket(); cancelled.readyState = 0;
    const b = new ConcordRelayClient('ws://127.0.0.1:7777', signer as never, () => cancelled as never);
    void b.connect().catch(() => undefined);
    const pendingB = b.publishRumor(rumor);
    b.close();
    await expect(pendingB).rejects.toThrow('relay closed');
    expect(cancelled.sent.some((f) => (JSON.parse(f) as unknown[])[0] === 'EVENT')).toBe(false);
  });
  it('drops sealed wraps whose outer event signature does not verify', async () => {
    const sock = new FakeSocket();
    const client = new ConcordRelayClient('ws://127.0.0.1:7777', {} as never, () => sock as never);
    await client.connect();
    const stream = pocStreamKey('chan1');
    const sk = generateSecretKey(); const pk = getPublicKey(sk);
    const rumor = messageRumor({ author: pk, channelId: 'chan1', epoch: 0, body: 'sealed', createdAt: 1700000000, ms: 1 });
    const wrap = wrapSeal(await sealRumor(rumor, 20013, stream, async (t) => finalizeEvent(t, sk)), stream);
    const seen: string[] = [];
    client.subscribeSealed(stream, (r) => seen.push(r.id ?? ''), 'sealed1');
    sock.emit(['EVENT', 'sealed1', { ...wrap, sig: '0'.repeat(128) }]);
    sock.emit(['EVENT', 'sealed1', wrap]);
    expect(seen).toEqual([rumor.id]);
  });
  it('waits for the socket to open before publishing, and rejects once closed', async () => {
    const sock = new FakeSocket(); sock.readyState = 0;
    const signer = { getPublicKey: async () => 'a'.repeat(64), signEvent: async (e: object) => ({ ...(e as object), sig: 's'.repeat(128) }) };
    const client = new ConcordRelayClient('ws://127.0.0.1:7777', signer as never, () => sock as never);
    void client.connect();
    const rumor = messageRumor({ author: 'a'.repeat(64), channelId: 'chan1', epoch: 0, body: 'hi', createdAt: 1700000000, ms: 1 });
    const sent = client.publishRumor(rumor);
    await Promise.resolve();
    expect(sock.sent).toEqual([]);
    sock.readyState = 1; sock.onopen?.();
    await sent;
    expect(sock.sent.map((f) => (JSON.parse(f) as unknown[])[0])).toEqual(['EVENT']);
    client.close();
    await expect(client.publishRumor(rumor)).rejects.toThrow('relay closed');
  });

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
    // Inbound events must carry a valid signature, not only a matching id.
    const sk = generateSecretKey(); const pk = getPublicKey(sk);
    const signedIn = (r: Rumor) => finalizeEvent({ kind: r.kind, tags: r.tags, content: r.content, created_at: r.created_at }, sk);
    const valid = signedIn(messageRumor({ author: pk, channelId: 'chan1', epoch: 0, body: 'hi', createdAt: 1700000000, ms: 1 }));
    const forged = { ...withId({ kind: 9, pubkey: pk, content: 'forged', tags: valid.tags, created_at: valid.created_at }), sig: valid.sig };
    const expired = signedIn(messageRumor({ author: pk, channelId: 'chan1', epoch: 0, body: 'old', createdAt: 1700000000, ms: 1, expirationSec: 1 }));
    sock.emit(['EVENT', 'sub1', valid]);
    sock.emit(['EVENT', 'sub1', forged]);
    sock.emit(['EVENT', 'sub1', { ...rumor, sig: 'x' }]);
    sock.emit(['EVENT', 'sub1', expired]);
    expect(seen).toEqual([valid.id]);
    const cipher = signerCipher(signer as never);
    await expect(cipher.encrypt('b'.repeat(64), 'hello')).resolves.toBe('enc:hello');
    await expect(cipher.decrypt('b'.repeat(64), 'enc:hello')).resolves.toBe('hello');
    client.close();
    expect(sock.sent.map((s) => JSON.parse(s) as unknown[]).some((f) => f[0] === 'CLOSE')).toBe(true);
    void vi;
  });
});
