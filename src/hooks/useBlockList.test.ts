import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MUTE_LIST_KIND } from '@/hooks/useModeration';
import { addBlockProvenance } from '@/lib/blockProvenance';
import { useBlockUser, useUnblockUser } from './useBlockList';

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock('@/lib/followListCache', () => ({
  followListCache: {
    invalidate: vi.fn(),
  },
}));

vi.mock('@/config/relays', () => ({
  PRIMARY_RELAY: { url: 'wss://relay.divine.video' },
}));

const mockNostrQuery = vi.fn();
const mockNostrReq = vi.fn();
const mockPublishEvent = vi.fn();
const mockUserPubkey = 'aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344';
const mockTargetPubkey = '11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd';

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
      req: mockNostrReq,
    },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: mockUserPubkey },
  }),
}));

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: mockPublishEvent,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeMuteEvent(tags: string[][], content = 'nip44-ciphertext'): NostrEvent {
  return {
    id: 'mute-list',
    pubkey: mockUserPubkey,
    created_at: 1,
    kind: MUTE_LIST_KIND,
    tags,
    content,
    sig: 'sig',
  };
}

function makeContactListEvent(pubkeys: string[]): NostrEvent {
  return {
    id: 'contact-list',
    pubkey: mockUserPubkey,
    created_at: 1,
    kind: 3,
    tags: pubkeys.map(pubkey => ['p', pubkey, '', '']),
    content: JSON.stringify({ 'wss://relay.divine.video': { read: true, write: true } }),
    sig: 'sig',
  };
}

function installLocalStorageMock() {
  const storage = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
  });
}

describe('useBlockUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installLocalStorageMock();
    mockPublishEvent.mockResolvedValue({});
    mockNostrReq.mockImplementation(async function* () {
      yield ['EVENT', 'subscription', makeContactListEvent([mockTargetPubkey, 'b'.repeat(64)])];
      yield ['EOSE', 'subscription'];
    });
  });

  it('publishes kind 10000 p-tag while preserving foreign tags and encrypted content', async () => {
    mockNostrQuery.mockResolvedValue([
      makeMuteEvent([
        ['a', '34236:somepub:vid-1'],
        ['p', 'existing-muted'],
        ['client', 'divine-web'],
      ]),
    ]);

    const { result } = renderHook(() => useBlockUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ targetPubkey: mockTargetPubkey });
    });

    expect(mockPublishEvent.mock.calls[0][0]).toEqual({
      kind: MUTE_LIST_KIND,
      content: 'nip44-ciphertext',
      tags: [
        ['a', '34236:somepub:vid-1'],
        ['p', 'existing-muted'],
        ['client', 'divine-web'],
        ['p', mockTargetPubkey],
      ],
    });
  });

  it('republishes kind 3 once without the blocked pubkey when target is followed', async () => {
    mockNostrQuery.mockResolvedValue([makeMuteEvent([])]);

    const { result } = renderHook(() => useBlockUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ targetPubkey: mockTargetPubkey });
    });

    expect(mockPublishEvent).toHaveBeenCalledTimes(2);
    const contactListPublish = mockPublishEvent.mock.calls[1][0];
    expect(contactListPublish.kind).toBe(3);
    expect(contactListPublish.tags).toEqual([['p', 'b'.repeat(64), '', '']]);
  });
});

describe('useUnblockUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installLocalStorageMock();
    mockPublishEvent.mockResolvedValue({});
  });

  it('removes explicit block p-tag from kind 10000 without touching kind 3', async () => {
    addBlockProvenance(mockUserPubkey, mockTargetPubkey);
    mockNostrQuery.mockResolvedValue([
      makeMuteEvent([
        ['p', mockTargetPubkey],
        ['p', 'keep-muted'],
        ['t', 'nsfw'],
      ]),
    ]);

    const { result } = renderHook(() => useUnblockUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ targetPubkey: mockTargetPubkey });
    });

    expect(mockPublishEvent).toHaveBeenCalledOnce();
    expect(mockPublishEvent.mock.calls[0][0]).toEqual({
      kind: MUTE_LIST_KIND,
      content: 'nip44-ciphertext',
      tags: [
        ['p', 'keep-muted'],
        ['t', 'nsfw'],
      ],
    });
    expect(mockNostrReq).not.toHaveBeenCalled();
  });

  it('does not remove ordinary mutes that lack local block provenance', async () => {
    mockNostrQuery.mockResolvedValue([makeMuteEvent([['p', mockTargetPubkey]])]);

    const { result } = renderHook(() => useUnblockUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ targetPubkey: mockTargetPubkey });
    });

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('keeps mute and block distinct in the exposed blocked set', async () => {
    addBlockProvenance(mockUserPubkey, mockTargetPubkey);
    mockNostrQuery.mockResolvedValue([
      makeMuteEvent([
        ['p', mockTargetPubkey],
        ['p', 'ordinary-muted'],
      ]),
    ]);

    const { useBlockedPubkeys } = await import('./useBlockList');
    const { result } = renderHook(() => useBlockedPubkeys(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current).toEqual(new Set([mockTargetPubkey]));
    });
  });
});
