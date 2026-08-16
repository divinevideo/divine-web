import { describe, expect, it, vi } from 'vitest';
import { NSecSigner, type NostrEvent, type NostrSigner } from '@nostrify/nostrify';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

// fetchDmMessages builds its own NPool internally, so the relay is stubbed at
// the module boundary. Everything inside — unwrapping, verification, NIP-44
// decryption — stays real.
const relayStub = vi.hoisted(() => ({ events: [] as unknown[] }));

vi.mock('@nostrify/nostrify', async () => {
  const actual = await vi.importActual<typeof import('@nostrify/nostrify')>('@nostrify/nostrify');
  return {
    ...actual,
    NRelay1: class {},
    NPool: class {
      async query() {
        return relayStub.events;
      }

      async close() {}
    },
  };
});

import {
  buildDmRumor,
  createRecipientGiftWraps,
  createSelfGiftWrap,
  decodeConversationId,
  DM_GIFT_WRAP_KIND,
  DM_RUMOR_KIND,
  encodeConversationId,
  fetchDmMessages,
  getDmMessagePreview,
  groupDmConversations,
  probeBunkerNip44,
  unwrapDmGiftWrap,
} from '@/lib/dm';

describe('dm utilities', () => {
  it('round-trips conversation ids', () => {
    const pubkeys = [
      'f'.repeat(64),
      'a'.repeat(64),
      'b'.repeat(64),
      'a'.repeat(64),
    ];

    const conversationId = encodeConversationId(pubkeys);

    expect(decodeConversationId(conversationId)).toEqual([
      'a'.repeat(64),
      'b'.repeat(64),
      'f'.repeat(64),
    ]);
  });

  it('prefers share titles in conversation previews when there is no text body', () => {
    const preview = getDmMessagePreview({
      conversationId: 'conversation-1',
      wrapId: 'wrap-1',
      rumorId: 'rumor-1',
      senderPubkey: 'a'.repeat(64),
      participantPubkeys: ['a'.repeat(64), 'b'.repeat(64)],
      peerPubkeys: ['b'.repeat(64)],
      content: '',
      createdAt: 1,
      isOutgoing: true,
      share: {
        url: 'https://divine.video/video/stable-vine-id',
        title: 'Loop of the day',
        videoId: 'video-event-id',
        videoPubkey: 'a'.repeat(64),
        vineId: 'stable-vine-id',
      },
    });

    expect(preview).toBe('Shared Loop of the day');
  });

  it('groups conversations and counts unread incoming messages only', () => {
    const conversationA = encodeConversationId(['a'.repeat(64)]);
    const conversationB = encodeConversationId(['b'.repeat(64)]);

    const conversations = groupDmConversations([
      {
        conversationId: conversationA,
        wrapId: 'wrap-1',
        rumorId: 'rumor-1',
        senderPubkey: 'a'.repeat(64),
        participantPubkeys: ['a'.repeat(64), 'c'.repeat(64)],
        peerPubkeys: ['a'.repeat(64)],
        content: 'first',
        createdAt: 10,
        isOutgoing: false,
      },
      {
        conversationId: conversationA,
        wrapId: 'wrap-2',
        rumorId: 'rumor-2',
        senderPubkey: 'c'.repeat(64),
        participantPubkeys: ['a'.repeat(64), 'c'.repeat(64)],
        peerPubkeys: ['a'.repeat(64)],
        content: 'reply',
        createdAt: 20,
        isOutgoing: true,
      },
      {
        conversationId: conversationB,
        wrapId: 'wrap-3',
        rumorId: 'rumor-3',
        senderPubkey: 'b'.repeat(64),
        participantPubkeys: ['b'.repeat(64), 'c'.repeat(64)],
        peerPubkeys: ['b'.repeat(64)],
        content: 'unread',
        createdAt: 30,
        isOutgoing: false,
      },
    ], {
      [conversationA]: 15,
    });

    expect(conversations[0].id).toBe(conversationB);
    expect(conversations[0].unreadCount).toBe(1);
    expect(conversations[1].unreadCount).toBe(0);
  });
});

describe('fetchDmMessages deduplication', () => {
  it('renders one message when the same rumor arrives in two gift wraps', async () => {
    // #578: NIP-59 mints a fresh ephemeral keypair per wrap, so re-publishing
    // one message produces two kind-1059 events that share nothing on the
    // outside. The rumor id is the only thing that identifies them as one
    // message. Exercised against real NIP-44 encryption end to end.
    const sender = createTestSigner();
    const recipient = createTestSigner();

    const rumor = buildDmRumor({
      senderPubkey: sender.pubkey,
      recipientPubkeys: [recipient.pubkey],
      content: 'sent once, published twice',
    });

    const wraps = [
      ...(await createRecipientGiftWraps({
        signer: sender.signer,
        senderPubkey: sender.pubkey,
        recipientPubkeys: [recipient.pubkey],
        content: rumor.content,
        rumor,
      })),
      ...(await createRecipientGiftWraps({
        signer: sender.signer,
        senderPubkey: sender.pubkey,
        recipientPubkeys: [recipient.pubkey],
        content: rumor.content,
        rumor,
      })),
    ];

    expect(wraps).toHaveLength(2);
    expect(wraps[0].id).not.toBe(wraps[1].id);
    expect(wraps[0].pubkey).not.toBe(wraps[1].pubkey);

    const result = await fetchWithStubbedRelay(wraps, recipient);

    expect(result.fetchedCount).toBe(2);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].rumorId).toBe(rumor.id);
    expect(result.malformedCount).toBe(0);
  });

  it('keeps two distinct messages that happen to share their text', async () => {
    // The collapse must key on identity, not content — sending "ok" twice on
    // purpose is two messages.
    const sender = createTestSigner();
    const recipient = createTestSigner();

    const wraps: NostrEvent[] = [];
    for (const createdAt of [1_700_000_000, 1_700_000_060]) {
      vi.spyOn(Date, 'now').mockReturnValue(createdAt * 1000);
      wraps.push(...(await createRecipientGiftWraps({
        signer: sender.signer,
        senderPubkey: sender.pubkey,
        recipientPubkeys: [recipient.pubkey],
        content: 'ok',
      })));
    }
    vi.restoreAllMocks();

    const result = await fetchWithStubbedRelay(wraps, recipient);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].rumorId).not.toBe(result.messages[1].rumorId);
  });
});

describe('createSelfGiftWrap', () => {
  it('wraps the rumor it is given, so the self copy shares the recipient copy id', async () => {
    // NIP-59: a single rumor may be wrapped and addressed for each recipient
    // individually — including the author's own copy. Two rumors would leave
    // the sender holding a different message from the one they sent.
    const sender = createTestSigner();
    const recipient = createTestSigner();

    const rumor = buildDmRumor({
      senderPubkey: sender.pubkey,
      recipientPubkeys: [recipient.pubkey],
      content: 'hi',
    });

    const selfWrap = await createSelfGiftWrap({
      signer: sender.signer,
      senderPubkey: sender.pubkey,
      recipientPubkeys: [recipient.pubkey],
      content: 'hi',
      rumor,
    });

    expect(selfWrap).not.toBeNull();
    const unwrapped = await unwrapDmGiftWrap(selfWrap!, sender.signer);
    expect(unwrapped.ok).toBe(true);
    if (unwrapped.ok) {
      expect(unwrapped.rumor.id).toBe(rumor.id);
    }
  });

  it('returns null and warns when signer.nip44.encrypt rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cause = new Error('bunker rejected encrypt-to-self');
    const signer: NostrSigner = {
      getPublicKey: vi.fn().mockResolvedValue('a'.repeat(64)),
      signEvent: vi.fn(),
      nip44: {
        encrypt: vi.fn().mockRejectedValue(cause),
        decrypt: vi.fn(),
      },
    };

    const result = await createSelfGiftWrap({
      signer,
      senderPubkey: 'a'.repeat(64),
      recipientPubkeys: ['b'.repeat(64)],
      content: 'hi',
    });

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Self-wrap creation failed'),
      cause,
    );
  });
});

describe('createRecipientGiftWraps', () => {
  it('throws when signer.nip44.encrypt rejects (primary path must surface failures)', async () => {
    const cause = new Error('bunker rejected encrypt');
    const signer: NostrSigner = {
      getPublicKey: vi.fn().mockResolvedValue('a'.repeat(64)),
      signEvent: vi.fn(),
      nip44: {
        encrypt: vi.fn().mockRejectedValue(cause),
        decrypt: vi.fn(),
      },
    };

    await expect(createRecipientGiftWraps({
      signer,
      senderPubkey: 'a'.repeat(64),
      recipientPubkeys: ['b'.repeat(64)],
      content: 'hi',
    })).rejects.toThrow('bunker rejected encrypt');
  });

  it('throws when given no valid recipients', async () => {
    const signer: NostrSigner = {
      getPublicKey: vi.fn(),
      signEvent: vi.fn(),
      nip44: { encrypt: vi.fn(), decrypt: vi.fn() },
    };

    await expect(createRecipientGiftWraps({
      signer,
      senderPubkey: 'a'.repeat(64),
      recipientPubkeys: [],
      content: 'hi',
    })).rejects.toThrow(/at least one recipient/);
  });

  it('re-wraps a supplied rumor instead of minting a new one', async () => {
    // A retry hands back the first attempt's rumor. Its id is the only thing
    // a receiver can dedupe on, so it must survive the round trip untouched.
    const sender = createTestSigner();
    const recipient = createTestSigner();

    const rumor = buildDmRumor({
      senderPubkey: sender.pubkey,
      recipientPubkeys: [recipient.pubkey],
      content: 'hi',
    });

    const [wrap] = await createRecipientGiftWraps({
      signer: sender.signer,
      senderPubkey: sender.pubkey,
      recipientPubkeys: [recipient.pubkey],
      content: 'hi',
      rumor,
    });

    const unwrapped = await unwrapDmGiftWrap(wrap, recipient.signer);
    expect(unwrapped.ok).toBe(true);
    if (unwrapped.ok) {
      expect(unwrapped.rumor).toEqual(rumor);
    }
  });
});


describe('buildDmRumor', () => {
  const SENDER = 'a'.repeat(64);
  const RECIPIENT = 'b'.repeat(64);

  it('mints a different id once the clock advances', () => {
    // This is why a retry cannot rebuild: created_at is the only varying
    // input to the id hash, and a failed send burns the publish timeout
    // before Retry is reachable.
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const first = buildDmRumor({ senderPubkey: SENDER, recipientPubkeys: [RECIPIENT], content: 'hi' });

    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_011_000);
    const second = buildDmRumor({ senderPubkey: SENDER, recipientPubkeys: [RECIPIENT], content: 'hi' });

    expect(second.id).not.toBe(first.id);
    expect(second.content).toBe(first.content);
  });

  it('tags the sender and every recipient as participants', () => {
    const rumor = buildDmRumor({
      senderPubkey: SENDER,
      recipientPubkeys: [RECIPIENT, RECIPIENT, 'not-a-pubkey'],
      content: 'hi',
    });

    expect(rumor.kind).toBe(DM_RUMOR_KIND);
    expect(rumor.pubkey).toBe(SENDER);
    expect(rumor.tags).toEqual([['p', SENDER], ['p', RECIPIENT]]);
  });

  it('throws when given no valid recipients', () => {
    expect(() => buildDmRumor({
      senderPubkey: SENDER,
      recipientPubkeys: ['not-a-pubkey'],
      content: 'hi',
    })).toThrow(/at least one recipient/);
  });
});

describe('probeBunkerNip44', () => {
  const PROBE_PUBKEY = 'a'.repeat(64);

  function makeSigner(nip44?: NostrSigner['nip44']): NostrSigner {
    return {
      getPublicKey: vi.fn().mockResolvedValue(PROBE_PUBKEY),
      signEvent: vi.fn(),
      nip44,
    };
  }

  it('returns false when the signer has no nip44 surface', async () => {
    expect(await probeBunkerNip44(makeSigner(undefined), PROBE_PUBKEY)).toBe(false);
  });

  it('returns false when nip44.encrypt rejects', async () => {
    const signer = makeSigner({
      encrypt: vi.fn().mockRejectedValue(new Error('bunker rejected')),
      decrypt: vi.fn(),
    });
    expect(await probeBunkerNip44(signer, PROBE_PUBKEY)).toBe(false);
  });

  it('returns false when nip44.decrypt rejects', async () => {
    const signer = makeSigner({
      encrypt: vi.fn().mockResolvedValue('ciphertext'),
      decrypt: vi.fn().mockRejectedValue(new Error('bunker rejected')),
    });
    expect(await probeBunkerNip44(signer, PROBE_PUBKEY)).toBe(false);
  });

  it('returns false when the round-trip plaintext does not match the input', async () => {
    const signer = makeSigner({
      encrypt: vi.fn().mockResolvedValue('ciphertext'),
      decrypt: vi.fn().mockResolvedValue('not the same plaintext'),
    });
    expect(await probeBunkerNip44(signer, PROBE_PUBKEY)).toBe(false);
  });

  it('returns true on a successful round-trip', async () => {
    let probedPlaintext = '';
    const signer = makeSigner({
      encrypt: vi.fn().mockImplementation(async (_pubkey: string, plaintext: string) => {
        probedPlaintext = plaintext;
        return 'ciphertext';
      }),
      decrypt: vi.fn().mockImplementation(async () => probedPlaintext),
    });
    expect(await probeBunkerNip44(signer, PROBE_PUBKEY)).toBe(true);
    expect(signer.nip44!.encrypt).toHaveBeenCalledWith(PROBE_PUBKEY, expect.any(String));
    expect(signer.nip44!.decrypt).toHaveBeenCalledWith(PROBE_PUBKEY, 'ciphertext');
  });
});

function createTestSigner(): { signer: NSecSigner; pubkey: string } {
  const sk = generateSecretKey();
  return { signer: new NSecSigner(sk), pubkey: getPublicKey(sk) };
}

async function fetchWithStubbedRelay(
  wraps: NostrEvent[],
  recipient: { signer: NSecSigner; pubkey: string },
) {
  relayStub.events = wraps;
  try {
    return await fetchDmMessages({
      signer: recipient.signer,
      currentUserPubkey: recipient.pubkey,
      relayUrls: ['wss://relay.example'],
    });
  } finally {
    relayStub.events = [];
  }
}

function createDmTestWrap(recipientPubkey: string): NostrEvent {
  return {
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    kind: DM_GIFT_WRAP_KIND,
    created_at: 1,
    tags: [['p', recipientPubkey]],
    content: 'ciphertext',
    sig: 'c'.repeat(128),
  };
}

function createMockSigner(
  recipientPubkey: string,
  decrypt: NonNullable<NostrSigner['nip44']>['decrypt'],
): NostrSigner {
  return {
    getPublicKey: vi.fn().mockResolvedValue(recipientPubkey),
    signEvent: vi.fn(),
    nip44: {
      encrypt: vi.fn(),
      decrypt,
    },
  };
}

describe('unwrapDmGiftWrap', () => {
  it('returns decrypt-failed when the signer.nip44.decrypt RPC throws', async () => {
    const recipient = createTestSigner();
    const wrap = createDmTestWrap(recipient.pubkey);
    const cause = new Error('bunker rejected nip44_decrypt');
    const signer = createMockSigner(recipient.pubkey, vi.fn().mockRejectedValue(cause));

    const result = await unwrapDmGiftWrap(wrap, signer);

    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'decrypt-failed') {
      expect(result.cause).toBe(cause);
    } else {
      expect.fail(`expected decrypt-failed, got ${JSON.stringify(result)}`);
    }
  });

  it('returns malformed when the decrypted seal is not valid JSON', async () => {
    const recipient = createTestSigner();
    const wrap = createDmTestWrap(recipient.pubkey);
    const signer = createMockSigner(
      recipient.pubkey,
      vi.fn().mockResolvedValue('not valid json {[}'),
    );

    const result = await unwrapDmGiftWrap(wrap, signer);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('malformed');
    }
  });

  it('returns malformed when the decrypted seal has the wrong kind', async () => {
    const recipient = createTestSigner();
    const wrap = createDmTestWrap(recipient.pubkey);
    const wrongKindSeal = JSON.stringify({
      kind: 9999,
      pubkey: 'a'.repeat(64),
      created_at: 1,
      tags: [],
      content: 'inner',
      id: 'd'.repeat(64),
      sig: 'e'.repeat(128),
    });
    const signer = createMockSigner(
      recipient.pubkey,
      vi.fn().mockResolvedValue(wrongKindSeal),
    );

    const result = await unwrapDmGiftWrap(wrap, signer);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('malformed');
    }
  });
});
