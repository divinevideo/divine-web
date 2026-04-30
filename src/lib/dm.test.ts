import { describe, expect, it, vi } from 'vitest';
import type { NostrSigner } from '@nostrify/nostrify';

import {
  buildDmSharePayloadFromVideo,
  buildDmShareQueryString,
  createRecipientGiftWraps,
  createSelfGiftWrap,
  decodeConversationId,
  encodeConversationId,
  getDmMessagePreview,
  groupDmConversations,
  parseDmShareQuery,
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

// Note: real-crypto round-trip tests for these functions are blocked by
// src/test/setup.ts overriding global TextEncoder with node:util's
// TextEncoder, which produces a Uint8Array from a different realm than
// @noble/hashes' instance check accepts. The failure-path tests below run
// entirely on mock signers, so they're unaffected.

describe('createSelfGiftWrap', () => {
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
});
