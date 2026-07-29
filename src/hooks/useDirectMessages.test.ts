import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_PUBKEY = 'a'.repeat(64);
const RECIPIENT_PUBKEY = 'b'.repeat(64);

const mockResolveDmReadRelays = vi.fn();
const mockResolveDmWriteRelays = vi.fn();
const mockFetchDmMessages = vi.fn();
const mockCreateRecipientGiftWraps = vi.fn();
const mockCreateSelfGiftWrap = vi.fn();
const mockPublishDmMessages = vi.fn();
const mockProbeBunkerNip44 = vi.fn();
const mockToast = vi.fn();

let mockLogins: Array<{ id: string; pubkey: string }> = [
  { id: 'login-default', pubkey: TEST_PUBKEY },
];

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

vi.mock('@nostrify/react/login', () => ({
  useNostrLogin: () => ({ logins: mockLogins }),
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

// Mutable protected-minor state (#176) so enforcement tests can flip protection
// and the approved set. Defaults preserve every existing test's non-protected
// behavior. The real dmSendGuard / dmInboundFilter run against this stub service.
const pm = vi.hoisted(() => ({
  state: 'not_protected' as 'protected' | 'not_protected' | 'unknown',
  approved: new Set<string>(),
}));

vi.mock('@/hooks/useProtectedMinorStatus', () => ({
  useProtectedMinorStatus: () => ({
    state: pm.state,
    isKnown: pm.state !== 'unknown',
    verifiedMinorAt: null,
  }),
}));

vi.mock('@/lib/officialAccounts', async (orig) => ({
  ...(await orig<typeof import('@/lib/officialAccounts')>()),
  officialAccountsService: {
    isApprovedMinorDmRecipientSync: (pk: string) => pm.approved.has(pk),
    isApprovedMinorDmRecipient: async (pk: string) => pm.approved.has(pk),
    onVerdictChanged: () => () => {},
  },
}));

vi.mock('@/lib/dm', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dm')>('@/lib/dm');
  return {
    ...actual,
    resolveDmReadRelays: (...args: unknown[]) => mockResolveDmReadRelays(...args),
    resolveDmWriteRelays: (...args: unknown[]) => mockResolveDmWriteRelays(...args),
    fetchDmMessages: (...args: unknown[]) => mockFetchDmMessages(...args),
    createRecipientGiftWraps: (...args: unknown[]) => mockCreateRecipientGiftWraps(...args),
    createSelfGiftWrap: (...args: unknown[]) => mockCreateSelfGiftWrap(...args),
    publishDmMessages: (...args: unknown[]) => mockPublishDmMessages(...args),
    probeBunkerNip44: (...args: unknown[]) => mockProbeBunkerNip44(...args),
  };
});

import { encodeConversationId } from '@/lib/dm';
import { DmSendBlockedError } from '@/lib/dmSendGuard';
import { readDmOutbox, writeDmOutbox } from '@/lib/dmOutbox';
import { useDmCapability, useDmConversation, useDmConversations, useDmInboxStatus, useDmSend } from './useDirectMessages';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useDirectMessages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    pm.state = 'not_protected';
    pm.approved.clear();
    localStorageMock.clear();
    mockResolveDmReadRelays.mockResolvedValue(['wss://relay.example']);
    mockResolveDmWriteRelays.mockResolvedValue(['wss://relay.example']);
    mockFetchDmMessages.mockResolvedValue({
      messages: [],
      fetchedCount: 0,
      decryptFailures: 0,
      malformedCount: 0,
    });
    mockCreateRecipientGiftWraps.mockResolvedValue([
      {
        id: 'recipient-wrap-id',
        created_at: 1_234_567_890,
        tags: [['p', RECIPIENT_PUBKEY]],
      },
    ]);
    mockCreateSelfGiftWrap.mockResolvedValue({
      id: 'self-wrap-id',
      created_at: 1_234_567_890,
      tags: [['p', TEST_PUBKEY]],
    });
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

    mockFetchDmMessages.mockResolvedValue({
      messages: [{
        conversationId: encodeConversationId([RECIPIENT_PUBKEY]),
        wrapId: 'remote-wrap-id',
        rumorId: 'remote-rumor-id',
        senderPubkey: TEST_PUBKEY,
        participantPubkeys: [RECIPIENT_PUBKEY, TEST_PUBKEY].sort(),
        peerPubkeys: [RECIPIENT_PUBKEY],
        content: 'hello',
        createdAt: 1_234_567_892,
        isOutgoing: true,
      }],
      fetchedCount: 1,
      decryptFailures: 0,
      malformedCount: 0,
    });

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

    mockFetchDmMessages.mockResolvedValue({
      messages: [{
        conversationId: encodeConversationId([RECIPIENT_PUBKEY]),
        wrapId: 'remote-wrap-id',
        rumorId: 'remote-rumor-id',
        senderPubkey: RECIPIENT_PUBKEY,
        participantPubkeys: [RECIPIENT_PUBKEY, TEST_PUBKEY].sort(),
        peerPubkeys: [RECIPIENT_PUBKEY],
        content: 'hello',
        createdAt: 1_234_567_892,
        isOutgoing: false,
      }],
      fetchedCount: 1,
      decryptFailures: 0,
      malformedCount: 0,
    });

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

    // Recipient publish is the only call we want stuck for this test —
    // the self-wrap publish (second call) resolves immediately so the
    // mutation can reach onSuccess after the test resolves the first.
    let resolvePublish: (() => void) | undefined;
    mockPublishDmMessages
      .mockImplementationOnce(() => new Promise<void>((resolve) => { resolvePublish = resolve; }))
      .mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(['dm', 'messages', TEST_PUBKEY, 300], {
      messages: [],
      fetchedCount: 0,
      decryptFailures: 0,
      malformedCount: 0,
    });

    const { result } = renderHook(() => useDmSend(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        participantPubkeys: [RECIPIENT_PUBKEY],
        content: 'hi support',
      });
    });

    expect(queryClient.getQueryData(['dm', 'messages', TEST_PUBKEY, 300])).toEqual(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            content: 'hi support',
            deliveryState: 'sending',
            isOptimistic: true,
          }),
        ],
      }),
    );

    await act(async () => {
      resolvePublish?.();
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(['dm', 'messages', TEST_PUBKEY, 300])).toEqual(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              content: 'hi support',
              deliveryState: 'sent',
              isOptimistic: true,
            }),
          ],
        }),
      );
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

    queryClient.setQueryData(['dm', 'messages', TEST_PUBKEY, 300], {
      messages: [],
      fetchedCount: 0,
      decryptFailures: 0,
      malformedCount: 0,
    });

    const { result } = renderHook(() => useDmSend(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({
        participantPubkeys: [RECIPIENT_PUBKEY],
        content: 'hi support',
      })).rejects.toThrow('signal has been aborted');
    });

    expect(queryClient.getQueryData(['dm', 'messages', TEST_PUBKEY, 300])).toEqual(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            content: 'hi support',
            deliveryState: 'failed',
            errorMessage: 'signal has been aborted',
            isOptimistic: true,
          }),
        ],
      }),
    );
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

    queryClient.setQueryData(['dm', 'messages', TEST_PUBKEY, 300], {
      messages: [
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
      ],
      fetchedCount: 0,
      decryptFailures: 0,
      malformedCount: 0,
    });

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

    expect(queryClient.getQueryData(['dm', 'messages', TEST_PUBKEY, 300])).toEqual(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            clientId: 'local-1',
            content: 'retry me',
            deliveryState: 'sending',
            errorMessage: undefined,
            isOptimistic: true,
          }),
        ],
      }),
    );
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

    queryClient.setQueryData(['dm', 'messages', TEST_PUBKEY, 300], {
      messages: [],
      fetchedCount: 0,
      decryptFailures: 0,
      malformedCount: 0,
    });

    const { result } = renderHook(() => useDmSend(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        participantPubkeys: [RECIPIENT_PUBKEY],
        content: 'hi support',
      });
    });

    expect(queryClient.getQueryData(['dm', 'messages', TEST_PUBKEY, 300])).toEqual(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            content: 'hi support',
            deliveryState: 'sent',
            isOptimistic: true,
          }),
        ],
      }),
    );
    expect(readDmOutbox(TEST_PUBKEY)).toEqual([
      expect.objectContaining({
        content: 'hi support',
        deliveryState: 'sent',
      }),
    ]);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('resolves the send mutation when only the self-wrap step fails', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Recipient wrap created and published normally; self-wrap creation
    // returns null (e.g. bunker rejected encrypt-to-self) — recipient
    // delivery already succeeded, so the mutation must still resolve.
    mockCreateSelfGiftWrap.mockResolvedValueOnce(null);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { result } = renderHook(() => useDmSend(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        participantPubkeys: [RECIPIENT_PUBKEY],
        content: 'recipient gets it even when self-wrap fails',
      });
    });

    // Recipient publish happened; self publish did NOT (no wrap to publish).
    expect(mockPublishDmMessages).toHaveBeenCalledTimes(1);
    expect(readDmOutbox(TEST_PUBKEY)).toEqual([
      expect.objectContaining({
        content: 'recipient gets it even when self-wrap fails',
        deliveryState: 'sent',
      }),
    ]);
    expect(mockToast).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('rejects the send mutation when the recipient wrap fails', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);

    const cause = new Error('bunker rejected encrypt');
    mockCreateRecipientGiftWraps.mockRejectedValueOnce(cause);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { result } = renderHook(() => useDmSend(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({
        participantPubkeys: [RECIPIENT_PUBKEY],
        content: 'should fail loudly',
      })).rejects.toThrow('bunker rejected encrypt');
    });

    expect(mockPublishDmMessages).not.toHaveBeenCalled();
    expect(readDmOutbox(TEST_PUBKEY)).toEqual([
      expect.objectContaining({
        content: 'should fail loudly',
        deliveryState: 'failed',
      }),
    ]);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Message failed',
        variant: 'destructive',
      }),
    );
  });

  describe('protected-minor enforcement wiring (#176)', () => {
    it('blocks a protected minor from sending to a non-approved recipient and publishes nothing', async () => {
      pm.state = 'protected'; // RECIPIENT_PUBKEY is NOT in pm.approved

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const { result } = renderHook(() => useDmSend(), {
        wrapper: createWrapper(queryClient),
      });

      await expect(
        result.current.mutateAsync({
          participantPubkeys: [RECIPIENT_PUBKEY],
          content: 'trying to reach a stranger',
        }),
      ).rejects.toThrow(DmSendBlockedError);

      // The gate runs before any wrap build or publish — nothing leaks.
      expect(mockCreateRecipientGiftWraps).not.toHaveBeenCalled();
      expect(mockPublishDmMessages).not.toHaveBeenCalled();
    });

    it('allows a protected minor to send to an approved official recipient', async () => {
      pm.state = 'protected';
      pm.approved.add(RECIPIENT_PUBKEY);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const { result } = renderHook(() => useDmSend(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          participantPubkeys: [RECIPIENT_PUBKEY],
          content: 'hi support',
        });
      });

      expect(mockPublishDmMessages).toHaveBeenCalled();
    });

    it('blocks a group send when any recipient is non-approved (all-or-nothing), publishing nothing', async () => {
      const APPROVED = 'c'.repeat(64);
      pm.state = 'protected';
      pm.approved.add(APPROVED); // RECIPIENT_PUBKEY stays non-approved

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const { result } = renderHook(() => useDmSend(), {
        wrapper: createWrapper(queryClient),
      });

      await expect(
        result.current.mutateAsync({
          participantPubkeys: [APPROVED, RECIPIENT_PUBKEY],
          content: 'group with one stranger',
        }),
      ).rejects.toThrow(DmSendBlockedError);

      expect(mockPublishDmMessages).not.toHaveBeenCalled();
    });

    it('clears a thread with a non-approved peer for a protected minor', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);
      pm.state = 'protected'; // RECIPIENT_PUBKEY not approved

      // A persisted outbox message to the non-approved peer would otherwise
      // surface in the thread; the inbound filter must clear it.
      writeDmOutbox(TEST_PUBKEY, [{
        clientId: 'local-1',
        ownerPubkey: TEST_PUBKEY,
        participantPubkeys: [RECIPIENT_PUBKEY],
        content: 'history that must not show',
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
      expect(result.current.data).toEqual([]);
    });

    it('fails closed on unknown: blocks a send to a non-approved recipient with retriable copy', async () => {
      pm.state = 'unknown'; // RECIPIENT_PUBKEY not approved

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const { result } = renderHook(() => useDmSend(), {
        wrapper: createWrapper(queryClient),
      });

      await expect(
        result.current.mutateAsync({
          participantPubkeys: [RECIPIENT_PUBKEY],
          content: 'sent before the status check resolved',
        }),
      ).rejects.toThrow();

      // Nothing is built or published, exactly like the protected block.
      expect(mockCreateRecipientGiftWraps).not.toHaveBeenCalled();
      expect(mockPublishDmMessages).not.toHaveBeenCalled();

      // The user-facing copy is the retriable "couldn't verify" framing, NOT
      // the definitive official-accounts-only copy (wrong for an adult whose
      // status check merely failed).
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: expect.stringContaining("couldn't verify your account"),
          }),
        ),
      );
    });

    it('still allows a send to an approved official while unknown', async () => {
      pm.state = 'unknown';
      pm.approved.add(RECIPIENT_PUBKEY);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const { result } = renderHook(() => useDmSend(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          participantPubkeys: [RECIPIENT_PUBKEY],
          content: 'hi support, before my status resolved',
        });
      });

      expect(mockPublishDmMessages).toHaveBeenCalled();
    });

    it('fails closed on unknown: filters a non-approved conversation from the list', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);
      pm.state = 'unknown'; // RECIPIENT_PUBKEY not approved

      writeDmOutbox(TEST_PUBKEY, [{
        clientId: 'local-unknown-list',
        ownerPubkey: TEST_PUBKEY,
        participantPubkeys: [RECIPIENT_PUBKEY],
        content: 'conversation that must not list',
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

      const { result } = renderHook(() => useDmConversations(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it('fails closed on unknown: clears a thread with a non-approved peer', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);
      pm.state = 'unknown'; // RECIPIENT_PUBKEY not approved

      writeDmOutbox(TEST_PUBKEY, [{
        clientId: 'local-unknown-thread',
        ownerPubkey: TEST_PUBKEY,
        participantPubkeys: [RECIPIENT_PUBKEY],
        content: 'history that must not show',
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
      expect(result.current.data).toEqual([]);
    });
  });
});

describe('useDmCapability with bunker healthcheck', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    localStorageMock.clear();
    mockLogins = [{ id: 'login-default', pubkey: TEST_PUBKEY }];
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

  it('re-runs the probe when the active login id changes for the same pubkey', async () => {
    mockLogins = [{ id: 'login-A', pubkey: TEST_PUBKEY }];
    mockProbeBunkerNip44.mockResolvedValue(false);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result, rerender } = renderHook(() => useDmCapability(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isCheckingDmCapability).toBe(false));
    expect(result.current.canUseDirectMessages).toBe(false);
    expect(mockProbeBunkerNip44).toHaveBeenCalledTimes(1);

    mockLogins = [{ id: 'login-B', pubkey: TEST_PUBKEY }];
    mockProbeBunkerNip44.mockResolvedValue(true);

    rerender();

    await waitFor(() => expect(result.current.canUseDirectMessages).toBe(true));
    expect(mockProbeBunkerNip44).toHaveBeenCalledTimes(2);
  });
});

describe('useDmInboxStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    localStorageMock.clear();
    mockResolveDmReadRelays.mockResolvedValue(['wss://relay.example']);
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it("returns 'unavailable' when relays returned wraps but every one failed to decrypt", async () => {
    mockFetchDmMessages.mockResolvedValue({
      messages: [],
      fetchedCount: 12,
      decryptFailures: 12,
      malformedCount: 0,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useDmInboxStatus(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current).not.toBe('loading'));
    expect(result.current).toBe('unavailable');
  });

  it("returns 'empty' when relays returned no wraps", async () => {
    mockFetchDmMessages.mockResolvedValue({
      messages: [],
      fetchedCount: 0,
      decryptFailures: 0,
      malformedCount: 0,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useDmInboxStatus(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current).not.toBe('loading'));
    expect(result.current).toBe('empty');
  });

  it("returns 'ok' when at least one message is visible", async () => {
    mockFetchDmMessages.mockResolvedValue({
      messages: [{
        conversationId: encodeConversationId([RECIPIENT_PUBKEY]),
        wrapId: 'remote-wrap-id',
        rumorId: 'remote-rumor-id',
        senderPubkey: RECIPIENT_PUBKEY,
        participantPubkeys: [RECIPIENT_PUBKEY, TEST_PUBKEY].sort(),
        peerPubkeys: [RECIPIENT_PUBKEY],
        content: 'hi',
        createdAt: 1_234_567_892,
        isOutgoing: false,
      }],
      fetchedCount: 1,
      decryptFailures: 0,
      malformedCount: 0,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useDmInboxStatus(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current).toBe('ok'));
  });
});
