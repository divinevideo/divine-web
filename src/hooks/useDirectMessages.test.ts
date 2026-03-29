import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_PUBKEY = 'a'.repeat(64);
const RECIPIENT_PUBKEY = 'b'.repeat(64);

const mockResolveDmWriteRelays = vi.fn();
const mockCreateDmGiftWraps = vi.fn();
const mockPublishDmMessages = vi.fn();
const mockToast = vi.fn();

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: TEST_PUBKEY },
    signer: { nip44: {} },
  }),
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: {
      relayUrl: 'wss://relay.example',
      relayUrls: ['wss://relay.example'],
    },
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock('@/lib/dm', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dm')>('@/lib/dm');
  return {
    ...actual,
    resolveDmWriteRelays: (...args: unknown[]) => mockResolveDmWriteRelays(...args),
    createDmGiftWraps: (...args: unknown[]) => mockCreateDmGiftWraps(...args),
    publishDmMessages: (...args: unknown[]) => mockPublishDmMessages(...args),
  };
});

import { encodeConversationId } from '@/lib/dm';
import { useDmSend } from './useDirectMessages';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useDmSend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveDmWriteRelays.mockResolvedValue(['wss://relay.example']);
    mockCreateDmGiftWraps.mockResolvedValue([
      {
        id: 'self-wrap-id',
        created_at: 1234567890,
        tags: [['p', TEST_PUBKEY]],
      },
      {
        id: 'recipient-wrap-id',
        created_at: 1234567890,
        tags: [['p', RECIPIENT_PUBKEY]],
      },
    ]);
    mockPublishDmMessages.mockResolvedValue(undefined);
  });

  it('adds the outgoing message to existing DM message caches immediately after a successful send', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(['dm', 'messages', TEST_PUBKEY, 300], []);

    const { result } = renderHook(() => useDmSend(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        participantPubkeys: [RECIPIENT_PUBKEY],
        content: 'hi support',
      });
    });

    expect(queryClient.getQueryData(['dm', 'messages', TEST_PUBKEY, 300])).toEqual([
      expect.objectContaining({
        conversationId: encodeConversationId([RECIPIENT_PUBKEY]),
        wrapId: 'self-wrap-id',
        rumorId: 'self-wrap-id',
        senderPubkey: TEST_PUBKEY,
        participantPubkeys: [RECIPIENT_PUBKEY, TEST_PUBKEY].sort(),
        peerPubkeys: [RECIPIENT_PUBKEY],
        content: 'hi support',
        isOutgoing: true,
      }),
    ]);
    expect(mockToast).not.toHaveBeenCalled();
  });
});
