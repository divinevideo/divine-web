import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_PUBKEY = 'a'.repeat(64);
const RECIPIENT_PUBKEY = 'b'.repeat(64);

const mockResolveDmReadRelays = vi.fn();
const mockResolveDmWriteRelays = vi.fn();
const mockFetchDmMessages = vi.fn();
const mockCreateDmGiftWraps = vi.fn();
const mockPublishDmMessages = vi.fn();
const mockToast = vi.fn();

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

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
    resolveDmReadRelays: (...args: unknown[]) => mockResolveDmReadRelays(...args),
    resolveDmWriteRelays: (...args: unknown[]) => mockResolveDmWriteRelays(...args),
    fetchDmMessages: (...args: unknown[]) => mockFetchDmMessages(...args),
    createDmGiftWraps: (...args: unknown[]) => mockCreateDmGiftWraps(...args),
    publishDmMessages: (...args: unknown[]) => mockPublishDmMessages(...args),
  };
});

import { encodeConversationId } from '@/lib/dm';
import { readDmOutbox, writeDmOutbox } from '@/lib/dmOutbox';
import { useDmConversation, useDmSend } from './useDirectMessages';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useDirectMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockResolveDmReadRelays.mockResolvedValue(['wss://relay.example']);
    mockResolveDmWriteRelays.mockResolvedValue(['wss://relay.example']);
    mockFetchDmMessages.mockResolvedValue([]);
    mockCreateDmGiftWraps.mockResolvedValue([
      {
        id: 'self-wrap-id',
        created_at: 1_234_567_890,
        tags: [['p', TEST_PUBKEY]],
      },
      {
        id: 'recipient-wrap-id',
        created_at: 1_234_567_890,
        tags: [['p', RECIPIENT_PUBKEY]],
      },
    ]);
    mockPublishDmMessages.mockResolvedValue(undefined);
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('includes persisted sending outbox messages in the DM message cache', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);

    writeDmOutbox(TEST_PUBKEY, [{
      clientId: 'local-1',
      ownerPubkey: TEST_PUBKEY,
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
      createdAt: 1_234_567_890,
      lastAttemptAt: 1_234_567_890,
      deliveryState: 'sending',
      retryCount: 0,
    }]);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(
      () => useDmConversation(encodeConversationId([RECIPIENT_PUBKEY])),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      expect.objectContaining({
        clientId: 'local-1',
        content: 'hello',
        deliveryState: 'sending',
        isOptimistic: true,
      }),
    ]);
  });

  it('removes an optimistic outbox row when a matching fetched DM arrives', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);

    writeDmOutbox(TEST_PUBKEY, [{
      clientId: 'local-1',
      ownerPubkey: TEST_PUBKEY,
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
      createdAt: 1_234_567_890,
      lastAttemptAt: 1_234_567_890,
      deliveryState: 'sending',
      retryCount: 0,
    }]);

    mockFetchDmMessages.mockResolvedValue([{
      conversationId: encodeConversationId([RECIPIENT_PUBKEY]),
      wrapId: 'remote-wrap-id',
      rumorId: 'remote-rumor-id',
      senderPubkey: TEST_PUBKEY,
      participantPubkeys: [RECIPIENT_PUBKEY, TEST_PUBKEY].sort(),
      peerPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
      createdAt: 1_234_567_892,
      isOutgoing: true,
    }]);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(
      () => useDmConversation(encodeConversationId([RECIPIENT_PUBKEY])),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      expect.objectContaining({
        wrapId: 'remote-wrap-id',
        rumorId: 'remote-rumor-id',
        content: 'hello',
      }),
    ]);
    expect(readDmOutbox(TEST_PUBKEY)).toEqual([]);
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
