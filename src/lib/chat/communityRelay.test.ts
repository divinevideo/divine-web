import { describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey } from 'nostr-tools';
import { CommunityRelay } from './communityRelay';
import { channelGroupKey } from './concord-core/derive';
class Socket {
  readyState = 1; sent: unknown[][] = [];
  onopen: (() => void) | null = null; onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; this.onclose?.(); }
  emit(frame: unknown[]) { this.onmessage?.({ data: JSON.stringify(frame) }); }
}
const signer = { signEvent: async (t: Parameters<typeof finalizeEvent>[0]) => finalizeEvent(t, generateSecretKey()) };
describe('real community relay', () => {
  it('settles publication only on matching accepted OK, and refuses a rejected OK', async () => {
    const socket = new Socket(); const relay = new CommunityRelay('wss://relay.example', signer, () => socket);
    await relay.connect();
    const event = finalizeEvent({ kind: 1, tags: [], content: '', created_at: 1 }, generateSecretKey());
    let accepted = false; const pending = relay.publish(event).then(() => { accepted = true; });
    await Promise.resolve(); expect(accepted).toBe(false);
    socket.emit(['OK', event.id, true, '']); await pending; expect(accepted).toBe(true);
    const refused = relay.publish(event); socket.emit(['OK', event.id, false, 'blocked']);
    await expect(refused).rejects.toThrow('refused'); relay.close();
  });
  it('rejects pending publications on disconnect and never replays them', async () => {
    const socket = new Socket(); const relay = new CommunityRelay('wss://relay.example', signer, () => socket);
    await relay.connect(); const event = finalizeEvent({ kind: 1, tags: [], content: '', created_at: 1 }, generateSecretKey());
    const pending = relay.publish(event); socket.close(); await expect(pending).rejects.toThrow('disconnected');
  });
  it('authenticates held stream keys and reissues reads only after their OK', async () => {
    const socket = new Socket(); const relay = new CommunityRelay('wss://relay.example', signer, () => socket);
    const stream = channelGroupKey(new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), 0n);
    relay.register([stream]); await relay.connect();
    const off = relay.subscribe([{ kinds: [1059], authors: [stream.pk] }], () => {});
    socket.emit(['AUTH', 'challenge']); await new Promise(resolve => setTimeout(resolve, 0));
    const auth = socket.sent.filter(f => f[0] === 'AUTH').map(f => f[1] as { id: string; pubkey: string });
    expect(auth.some(e => e.pubkey === stream.pk)).toBe(true);
    const before = socket.sent.filter(f => f[0] === 'REQ').length;
    for (const event of auth) socket.emit(['OK', event.id, true, '']);
    expect(socket.sent.filter(f => f[0] === 'REQ').length).toBeGreaterThan(before);
    off(); relay.close();
  });
});

describe('duplicate inflight carrier', () => {
  it('coalesces identical publications so both callers receive the same acknowledgment', async () => {
    const socket = new Socket(); const relay = new CommunityRelay('wss://relay.example', signer, () => socket);
    await relay.connect();
    const event = finalizeEvent({ kind: 1, tags: [], content: '', created_at: 1 }, generateSecretKey());
    const first = relay.publish(event); const second = relay.publish(event);
    expect(first).toBe(second);
    socket.emit(['OK', event.id, true, '']); await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    expect(socket.sent.filter(frame => frame[0] === 'EVENT')).toHaveLength(1);
    const third = relay.publish(event); const fourth = relay.publish(event); relay.close();
    await expect(third).rejects.toThrow('disconnected'); await expect(fourth).rejects.toThrow('disconnected');
  });
});
