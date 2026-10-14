import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MUTE_LIST_KIND } from '@/hooks/useModeration';
import { addBlockProvenance, getExplicitBlockedPubkeys } from '@/lib/moderationProvenance';
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

function mockReq({ muteEvents = [makeMuteEvent([])], contactPubkeys = [mockTargetPubkey, 'b'.repeat(64)] }: {
  muteEvents?: NostrEvent[];
  contactPubkeys?: string[];
} = {}) {
  mockNostrReq.mockImplementation(async function* (filters) {
    const kinds = filters[0]?.kinds ?? [];
    if (kinds.includes(MUTE_LIST_KIND)) {
      for (const event of muteEvents) {
        yield ['EVENT', 'subscription', event];
      }
      yield ['EOSE', 'subscription'];
      return;
    }
    if (kinds.includes(3)) {
      yield ['EVENT', 'subscription', makeContactListEvent(contactPubkeys)];
      yield ['EOSE', 'subscription'];
    }
  });
}

function mockColdMuteListReq() {
  mockNostrReq.mockImplementation(async function* (filters) {
    const kinds = filters[0]?.kinds ?? [];
    if (kinds.includes(MUTE_LIST_KIND)) {
      yield ['EVENT', 'subscription', makeMuteEvent([['p', 'existing-muted']])];
      return;
    }
    if (kinds.includes(3)) {
      yield ['EVENT', 'subscription', makeContactListEvent([mockTargetPubkey])];
      yield ['EOSE', 'subscription'];
    }
  });
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
    mockReq();
  });

  it('publishes kind 10000 p-tag while preserving foreign tags and encrypted content', async () => {
    mockReq({
      muteEvents: [makeMuteEvent([
        ['a', '34236:somepub:vid-1'],
        ['p', 'existing-muted'],
        ['client', 'divine-web'],
      ])],
    });

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
    mockReq();

    const { result } = renderHook(() => useBlockUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ targetPubkey: mockTargetPubkey });
    });

    expect(mockPublishEvent).toHaveBeenCalledTimes(2);
    const contactListPublish = mockPublishEvent.mock.calls[1][0];
    expect(contactListPublish.kind).toBe(3);
    expect(contactListPublish.tags).toEqual([['p', 'b'.repeat(64), '', '']]);
  });

  it('does not republish the mute list when the target is already muted', async () => {
    mockReq({ muteEvents: [makeMuteEvent([['p', mockTargetPubkey]])] });

    const { result } = renderHook(() => useBlockUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ targetPubkey: mockTargetPubkey });
    });

    // Already muted ⇒ no redundant kind-10000 republish; the kind-3 strip still runs.
    const publishedKinds = mockPublishEvent.mock.calls.map(call => call[0].kind);
    expect(publishedKinds).not.toContain(MUTE_LIST_KIND);
    expect(publishedKinds).toContain(3);
  });

  it('does not publish or record provenance when the mute-list relay read misses EOSE', async () => {
    mockColdMuteListReq();

    const { result } = renderHook(() => useBlockUser(), { wrapper: createWrapper() });

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ targetPubkey: mockTargetPubkey });
      } catch (e) {
        error = e;
      }
    });

    expect(error).toBeInstanceOf(Error);
    expect(mockPublishEvent).not.toHaveBeenCalled();
    expect(getExplicitBlockedPubkeys(mockUserPubkey, [mockTargetPubkey])).toEqual(new Set());
  });

  it('keeps the block successful when follow-list cleanup fails after the mute-list publish', async () => {
    mockNostrReq.mockImplementation(async function* (filters) {
      const kinds = filters[0]?.kinds ?? [];
      if (kinds.includes(MUTE_LIST_KIND)) {
        yield ['EOSE', 'subscription'];
      }
    });

    const { result } = renderHook(() => useBlockUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ targetPubkey: mockTargetPubkey });
    });

    expect(mockPublishEvent).toHaveBeenCalledOnce();
    expect(mockPublishEvent.mock.calls[0][0].kind).toBe(MUTE_LIST_KIND);
    expect(getExplicitBlockedPubkeys(mockUserPubkey, [mockTargetPubkey])).toEqual(new Set([mockTargetPubkey]));
  });
});

describe('useUnblockUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installLocalStorageMock();
    mockPublishEvent.mockResolvedValue({});
    mockReq();
  });

  it('removes explicit block p-tag from kind 10000 without touching kind 3', async () => {
    addBlockProvenance(mockUserPubkey, mockTargetPubkey);
    mockReq({
      muteEvents: [makeMuteEvent([
        ['p', mockTargetPubkey],
        ['p', 'keep-muted'],
        ['t', 'nsfw'],
      ])],
    });

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
    expect(mockNostrReq).toHaveBeenCalledOnce();
  });

  it('does not remove ordinary mutes that lack local block provenance', async () => {
    mockReq({ muteEvents: [makeMuteEvent([['p', mockTargetPubkey]])] });

    const { result } = renderHook(() => useUnblockUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ targetPubkey: mockTargetPubkey });
    });

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('keeps block provenance when the block p-tag was not published', async () => {
    addBlockProvenance(mockUserPubkey, mockTargetPubkey);
    mockReq({ muteEvents: [makeMuteEvent([])] });

    const { result } = renderHook(() => useUnblockUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ targetPubkey: mockTargetPubkey });
    });

    expect(mockPublishEvent).not.toHaveBeenCalled();
    expect(getExplicitBlockedPubkeys(mockUserPubkey, [mockTargetPubkey])).toEqual(new Set([mockTargetPubkey]));
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
