import { describe, expect, it, vi } from 'vitest';
import type { NostrSigner } from '@nostrify/nostrify';

import {
  buildDmSharePayloadFromVideo,
  buildDmShareQueryString,
  decodeConversationId,
  encodeConversationId,
  getDmMessagePreview,
  groupDmConversations,
  parseDmShareQuery,
  probeBunkerNip44,
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
