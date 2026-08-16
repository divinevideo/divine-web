import { describe, expect, it, vi } from 'vitest';
import { NSecSigner, type NostrEvent, type NostrSigner } from '@nostrify/nostrify';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

import {
  buildDmRumor,
  createRecipientGiftWraps,
  createSelfGiftWrap,
  decodeConversationId,
  DM_GIFT_WRAP_KIND,
  DM_RUMOR_KIND,
  encodeConversationId,
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

// Note: real-crypto round-trip tests for these functions are blocked by
// src/test/setup.ts overriding global TextEncoder with node:util's
// TextEncoder, which produces a Uint8Array from a different realm than
// @noble/hashes' instance check accepts. The failure-path tests below run
// entirely on mock signers, so they're unaffected.

describe('createSelfGiftWrap', () => {
  it('wraps the rumor it is given, so the self copy shares the recipient copy id', async () => {
    // NIP-59: a single rumor may be wrapped and addressed for each recipient
    // individually — including the author's own copy. Two rumors would leave
    // the sender holding a different message from the one they sent.
    const { sealed, signer } = createSealCapturingSigner();

    const rumor = buildDmRumor({
      senderPubkey: 'a'.repeat(64),
      recipientPubkeys: ['b'.repeat(64)],
      content: 'hi',
    });

    await createSelfGiftWrap({
      signer,
      senderPubkey: 'a'.repeat(64),
      recipientPubkeys: ['b'.repeat(64)],
      content: 'hi',
      rumor,
    });

    expect(sealed).toHaveLength(1);
    expect(JSON.parse(sealed[0])).toEqual(rumor);
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
    // a receiver can dedupe on, so it must reach the seal untouched.
    //
    // Asserted on the plaintext handed to the signer rather than the returned
    // wrap: the wrap step runs real nip44 encryption, which cannot execute
    // under the jsdom TextEncoder override documented above. Sealing happens
    // first, so an empty `sealed` still fails this test.
    const { sealed, signer } = createSealCapturingSigner();

    const rumor = buildDmRumor({
      senderPubkey: 'a'.repeat(64),
      recipientPubkeys: ['b'.repeat(64)],
      content: 'hi',
    });

    await createRecipientGiftWraps({
      signer,
      senderPubkey: 'a'.repeat(64),
      recipientPubkeys: ['b'.repeat(64)],
      content: 'hi',
      rumor,
    }).catch(() => undefined);

    expect(sealed).toHaveLength(1);
    expect(JSON.parse(sealed[0])).toEqual(rumor);
  });
});

function createSealCapturingSigner(): { sealed: string[]; signer: NostrSigner } {
  const sealed: string[] = [];

  return {
    sealed,
    signer: {
      getPublicKey: vi.fn().mockResolvedValue('a'.repeat(64)),
      signEvent: vi.fn().mockResolvedValue({
        id: 'seal-id',
        pubkey: 'a'.repeat(64),
        kind: 13,
        created_at: 1,
        tags: [],
        content: 'ciphertext',
        sig: 'c'.repeat(128),
      }),
      nip44: {
        encrypt: vi.fn(async (_pubkey: string, plaintext: string) => {
          sealed.push(plaintext);
          return 'ciphertext';
        }),
        decrypt: vi.fn(),
      },
    },
  };
}

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
  // The happy-path round-trip (real NIP-44 encrypt → decrypt) is exercised in
  // useDirectMessages.test.ts which mocks at the import boundary. Here we
  // cannot run real nip44.v2 because src/test/setup.ts overrides global
  // TextEncoder with node:util's TextEncoder, which produces a Uint8Array
  // from a different realm than the @noble/hashes consumer expects, breaking
  // its instance check. Failure-path tests below all run via mocked signers
  // so they're unaffected.

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
