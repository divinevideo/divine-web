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
const mockProbeBunkerNip44 = vi.fn();
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
    probeBunkerNip44: (...args: unknown[]) => mockProbeBunkerNip44(...args),
  };
});

import { encodeConversationId } from '@/lib/dm';
import { readDmOutbox, writeDmOutbox } from '@/lib/dmOutbox';
import { useDmCapability, useDmConversation, useDmSend } from './useDirectMessages';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useDirectMessages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
    mockProbeBunkerNip44.mockResolvedValue(true);
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

  it('keeps fetched messages visible when outbox persistence fails', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);
    vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    mockFetchDmMessages.mockResolvedValue([{
      conversationId: encodeConversationId([RECIPIENT_PUBKEY]),
      wrapId: 'remote-wrap-id',
      rumorId: 'remote-rumor-id',
      senderPubkey: RECIPIENT_PUBKEY,
      participantPubkeys: [RECIPIENT_PUBKEY, TEST_PUBKEY].sort(),
      peerPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
      createdAt: 1_234_567_892,
      isOutgoing: false,
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
        content: 'hello',
        isOutgoing: false,
      }),
    ]);
  });

  it('adds an optimistic sending message before publish resolves', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);

    let resolvePublish: (() => void) | undefined;
    mockPublishDmMessages.mockImplementation(() => new Promise<void>((resolve) => {
      resolvePublish = resolve;
    }));

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
      result.current.mutate({
        participantPubkeys: [RECIPIENT_PUBKEY],
        content: 'hi support',
      });
    });

    expect(queryClient.getQueryData(['dm', 'messages', TEST_PUBKEY, 300])).toEqual([
      expect.objectContaining({
        content: 'hi support',
        deliveryState: 'sending',
        isOptimistic: true,
      }),
    ]);

    await act(async () => {
      resolvePublish?.();
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(['dm', 'messages', TEST_PUBKEY, 300])).toEqual([
        expect.objectContaining({
          content: 'hi support',
          deliveryState: 'sent',
          isOptimistic: true,
        }),
      ]);
    });
    expect(readDmOutbox(TEST_PUBKEY)).toEqual([
      expect.objectContaining({
        content: 'hi support',
        deliveryState: 'sent',
      }),
    ]);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('keeps the optimistic row as failed when publish rejects', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);

    mockPublishDmMessages.mockRejectedValue(new Error('signal has been aborted'));

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
      await expect(result.current.mutateAsync({
        participantPubkeys: [RECIPIENT_PUBKEY],
        content: 'hi support',
      })).rejects.toThrow('signal has been aborted');
    });

    expect(queryClient.getQueryData(['dm', 'messages', TEST_PUBKEY, 300])).toEqual([
      expect.objectContaining({
        content: 'hi support',
        deliveryState: 'failed',
        errorMessage: 'signal has been aborted',
        isOptimistic: true,
      }),
    ]);
    expect(readDmOutbox(TEST_PUBKEY)).toEqual([
      expect.objectContaining({
        content: 'hi support',
        deliveryState: 'failed',
        errorMessage: 'signal has been aborted',
      }),
    ]);
    expect(mockToast).toHaveBeenCalled();
  });

  it('retries a failed message by reusing the same optimistic row', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);

    let resolvePublish: (() => void) | undefined;
    mockPublishDmMessages.mockImplementation(() => new Promise<void>((resolve) => {
      resolvePublish = resolve;
    }));

    writeDmOutbox(TEST_PUBKEY, [{
      clientId: 'local-1',
      ownerPubkey: TEST_PUBKEY,
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'retry me',
      createdAt: 1_234_567_890,
      lastAttemptAt: 1_234_567_890,
      deliveryState: 'failed',
      errorMessage: 'signal has been aborted',
      retryCount: 0,
    }]);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(['dm', 'messages', TEST_PUBKEY, 300], [
      {
        conversationId: encodeConversationId([RECIPIENT_PUBKEY]),
        wrapId: 'optimistic:local-1',
        rumorId: 'optimistic:local-1',
        senderPubkey: TEST_PUBKEY,
        participantPubkeys: [RECIPIENT_PUBKEY, TEST_PUBKEY].sort(),
        peerPubkeys: [RECIPIENT_PUBKEY],
        content: 'retry me',
        createdAt: 1_234_567_890,
        isOutgoing: true,
        clientId: 'local-1',
        deliveryState: 'failed' as const,
        errorMessage: 'signal has been aborted',
        isOptimistic: true,
      },
    ]);

    const { result } = renderHook(() => useDmSend(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        clientId: 'local-1',
        participantPubkeys: [RECIPIENT_PUBKEY],
        content: 'retry me',
      });
    });

    expect(queryClient.getQueryData(['dm', 'messages', TEST_PUBKEY, 300])).toEqual([
      expect.objectContaining({
        clientId: 'local-1',
        content: 'retry me',
        deliveryState: 'sending',
        errorMessage: undefined,
        isOptimistic: true,
      }),
    ]);
    expect(readDmOutbox(TEST_PUBKEY)).toEqual([
      expect.objectContaining({
        clientId: 'local-1',
        deliveryState: 'sending',
        retryCount: 1,
      }),
    ]);

    await act(async () => {
      resolvePublish?.();
    });
  });

  it('marks the optimistic row as sent after a successful send', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);

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
        content: 'hi support',
        deliveryState: 'sent',
        isOptimistic: true,
      }),
    ]);
    expect(readDmOutbox(TEST_PUBKEY)).toEqual([
      expect.objectContaining({
        content: 'hi support',
        deliveryState: 'sent',
      }),
    ]);
    expect(mockToast).not.toHaveBeenCalled();
  });
});

describe('useDmCapability with bunker healthcheck', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('reports canUseDirectMessages=true when the probe succeeds', async () => {
    mockProbeBunkerNip44.mockResolvedValue(true);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useDmCapability(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isCheckingDmCapability).toBe(false));
    expect(result.current.canUseDirectMessages).toBe(true);
    expect(result.current.isLoggedIn).toBe(true);
  });

  it('reports canUseDirectMessages=false when the probe fails', async () => {
    mockProbeBunkerNip44.mockResolvedValue(false);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useDmCapability(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isCheckingDmCapability).toBe(false));
    expect(result.current.canUseDirectMessages).toBe(false);
    expect(result.current.isLoggedIn).toBe(true);
  });

  it('reports isCheckingDmCapability=true while the probe is in flight', async () => {
    let resolveProbe: ((value: boolean) => void) | undefined;
    mockProbeBunkerNip44.mockImplementation(() => new Promise<boolean>((resolve) => {
      resolveProbe = resolve;
    }));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useDmCapability(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isCheckingDmCapability).toBe(true));
    expect(result.current.canUseDirectMessages).toBe(false);

    await act(async () => {
      resolveProbe?.(true);
    });

    await waitFor(() => expect(result.current.isCheckingDmCapability).toBe(false));
    expect(result.current.canUseDirectMessages).toBe(true);
  });
});
