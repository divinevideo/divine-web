import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NostrEvent } from '@nostrify/nostrify';

const mockQuery = vi.fn();
const mockClose = vi.fn();
let warnSpy: ReturnType<typeof vi.spyOn> | undefined;

vi.mock('@nostrify/nostrify', () => ({
  NPool: vi.fn().mockImplementation(() => ({
    query: mockQuery,
    close: mockClose,
  })),
  NRelay1: vi.fn(),
}));

function relayListEvent(pubkey: string, relays: string[]): NostrEvent {
  return {
    id: `${pubkey.slice(0, 8)}${'0'.repeat(56)}`,
    pubkey,
    created_at: 1_700_000_000,
    kind: 10050,
    tags: relays.map((relay) => ['r', relay]),
    content: '',
    sig: '0'.repeat(128),
  };
}

describe('DM relay admission', () => {
  let resolveDmReadRelays: typeof import('@/lib/dm').resolveDmReadRelays;
  let resolveDmWriteRelays: typeof import('@/lib/dm').resolveDmWriteRelays;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const dm = await import('@/lib/dm');
    resolveDmReadRelays = dm.resolveDmReadRelays;
    resolveDmWriteRelays = dm.resolveDmWriteRelays;
  });

  afterEach(() => {
    warnSpy?.mockRestore();
    warnSpy = undefined;
  });

  it('rejects private and non-wss recipient relays from DM write routing', async () => {
    const recipient = 'a'.repeat(64);
    mockQuery.mockResolvedValue([
      relayListEvent(recipient, [
        'ws://192.168.1.10',
        'wss://127.0.0.1',
        'wss://recipient.example',
      ]),
    ]);

    const relays = await resolveDmWriteRelays({
      appRelayUrls: ['wss://app.example'],
      recipientPubkeys: [recipient],
    });

    expect(relays).toContain('wss://recipient.example');
    expect(relays).not.toContain('ws://192.168.1.10');
    expect(relays).not.toContain('wss://127.0.0.1');
  });

  it('caps each recipient relay list at eight entries', async () => {
    const recipient = 'b'.repeat(64);
    const remoteRelays = Array.from(
      { length: 40 },
      (_, index) => `wss://recipient-${index}.example`,
    );
    mockQuery.mockResolvedValue([relayListEvent(recipient, remoteRelays)]);

    const relays = await resolveDmWriteRelays({
      appRelayUrls: ['wss://app.example'],
      recipientPubkeys: [recipient],
    });

    expect(relays.filter((relay) => relay.startsWith('wss://recipient-'))).toEqual(remoteRelays.slice(0, 8));
  });

  it('applies the cap per recipient rather than across the group', async () => {
    const recipients = ['c'.repeat(64), 'd'.repeat(64), 'e'.repeat(64)];
    mockQuery.mockResolvedValue(
      recipients.map((recipient, recipientIndex) => relayListEvent(
        recipient,
        Array.from(
          { length: 10 },
          (_, relayIndex) => `wss://recipient-${recipientIndex}-${relayIndex}.example`,
        ),
      )),
    );

    const relays = await resolveDmWriteRelays({
      appRelayUrls: ['wss://app.example'],
      recipientPubkeys: recipients,
    });

    expect(relays.filter((relay) => relay.startsWith('wss://recipient-'))).toHaveLength(24);
    for (const recipientIndex of [0, 1, 2]) {
      expect(relays.filter((relay) => relay.startsWith(`wss://recipient-${recipientIndex}-`))).toHaveLength(8);
    }
  });

  it('keeps loopback relays from the signed-in user relay list for DM reads', async () => {
    const currentUser = 'f'.repeat(64);
    mockQuery.mockResolvedValue([
      relayListEvent(currentUser, [
        'ws://localhost:7777',
        'wss://reader.example',
      ]),
    ]);

    const relays = await resolveDmReadRelays({
      appRelayUrls: ['wss://app.example'],
      currentUserPubkey: currentUser,
    });

    expect(relays).toContain('ws://localhost:7777');
    expect(relays).toContain('wss://reader.example');
  });
});
