import { describe, expect, it, vi } from 'vitest';
import { NSecSigner, type NostrEvent, type NostrSigner } from '@nostrify/nostrify';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

import {
  buildDmSharePayloadFromVideo,
  buildDmShareQueryString,
  decodeConversationId,
  DM_GIFT_WRAP_KIND,
  encodeConversationId,
  getDmMessagePreview,
  groupDmConversations,
  parseDmShareQuery,
  unwrapDmGiftWrap,
} from '@/lib/dm';
import type { ParsedVideoData } from '@/types/video';

function makeVideo(overrides: Partial<ParsedVideoData> = {}): ParsedVideoData {
  return {
    id: 'video-event-id',
    pubkey: 'a'.repeat(64),
    kind: 34236,
    createdAt: 1,
    content: '',
    videoUrl: 'https://cdn.divine.video/videos/test.mp4',
    hashtags: [],
    vineId: 'stable-vine-id',
    isVineMigrated: false,
    reposts: [],
    ...overrides,
  };
}

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

  it('round-trips share payloads through query params', () => {
    const share = buildDmSharePayloadFromVideo(makeVideo({
      title: 'Loop of the day',
    }));

    const parsedShare = parseDmShareQuery(new URLSearchParams(buildDmShareQueryString(share)));

    expect(parsedShare).toEqual(share);
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

function createTestSigner(): { signer: NSecSigner; pubkey: string } {
  const sk = generateSecretKey();
  return { signer: new NSecSigner(sk), pubkey: getPublicKey(sk) };
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
    const wrap: NostrEvent = {
      id: 'a'.repeat(64),
      pubkey: 'b'.repeat(64),
      kind: DM_GIFT_WRAP_KIND,
      created_at: 1,
      tags: [['p', recipient.pubkey]],
      content: 'unreadable-ciphertext',
      sig: 'c'.repeat(128),
    };

    const cause = new Error('bunker rejected nip44_decrypt');
    const flakySigner: NostrSigner = {
      getPublicKey: vi.fn().mockResolvedValue(recipient.pubkey),
      signEvent: vi.fn(),
      nip44: {
        encrypt: vi.fn().mockRejectedValue(cause),
        decrypt: vi.fn().mockRejectedValue(cause),
      },
    };

    const result = await unwrapDmGiftWrap(wrap, flakySigner);

    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'decrypt-failed') {
      expect(result.cause).toBe(cause);
    } else {
      expect.fail(`expected decrypt-failed, got ${JSON.stringify(result)}`);
    }
  });

  it('returns malformed when the decrypted seal is not valid JSON', async () => {
    const recipient = createTestSigner();
    const wrap: NostrEvent = {
      id: 'a'.repeat(64),
      pubkey: 'b'.repeat(64),
      kind: DM_GIFT_WRAP_KIND,
      created_at: 1,
      tags: [['p', recipient.pubkey]],
      content: 'whatever',
      sig: 'c'.repeat(128),
    };

    const garbageSigner: NostrSigner = {
      getPublicKey: vi.fn().mockResolvedValue(recipient.pubkey),
      signEvent: vi.fn(),
      nip44: {
        encrypt: vi.fn(),
        decrypt: vi.fn().mockResolvedValue('not valid json {[}'),
      },
    };

    const result = await unwrapDmGiftWrap(wrap, garbageSigner);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('malformed');
    }
  });

  it('returns malformed when the decrypted seal has the wrong kind', async () => {
    const recipient = createTestSigner();
    const wrap: NostrEvent = {
      id: 'a'.repeat(64),
      pubkey: 'b'.repeat(64),
      kind: DM_GIFT_WRAP_KIND,
      created_at: 1,
      tags: [['p', recipient.pubkey]],
      content: 'whatever',
      sig: 'c'.repeat(128),
    };

    const wrongKindSeal = JSON.stringify({
      kind: 9999,
      pubkey: 'a'.repeat(64),
      created_at: 1,
      tags: [],
      content: 'inner',
      id: 'd'.repeat(64),
      sig: 'e'.repeat(128),
    });
    const wrongKindSigner: NostrSigner = {
      getPublicKey: vi.fn().mockResolvedValue(recipient.pubkey),
      signEvent: vi.fn(),
      nip44: {
        encrypt: vi.fn(),
        decrypt: vi.fn().mockResolvedValue(wrongKindSeal),
      },
    };

    const result = await unwrapDmGiftWrap(wrap, wrongKindSigner);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('malformed');
    }
  });
});
