// ABOUTME: Tests for useNostrPublish — sign + relay publish with client tag rules
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockNostrEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const signedEvent = {
  id: '01' + 'ab'.repeat(32),
  pubkey: 'c1' + 'ab'.repeat(31),
  sig: 'ff'.repeat(64),
  kind: 1,
  tags: [] as string[][],
  content: 'hello',
  created_at: 1_700_000_000,
};

const mockSignEvent = vi.hoisted(() => vi.fn());

const getCurrentUser = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    user: { pubkey: 'a'.repeat(64) },
    signer: { signEvent: mockSignEvent },
  })
);

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      event: mockNostrEvent,
    },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => getCurrentUser(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useNostrPublish', () => {
  let useNostrPublish: typeof import('./useNostrPublish').useNostrPublish;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockNostrEvent.mockResolvedValue(undefined);
    mockSignEvent.mockImplementation(async (partial: {
      kind: number;
      content?: string;
      tags?: string[][];
      created_at?: number;
    }) => ({
      id: signedEvent.id,
      pubkey: signedEvent.pubkey,
      sig: signedEvent.sig,
      kind: partial.kind,
      content: partial.content ?? '',
      tags: partial.tags ?? [],
      created_at: partial.created_at ?? signedEvent.created_at,
    }));
    getCurrentUser.mockReturnValue({
      user: { pubkey: 'a'.repeat(64) },
      signer: { signEvent: mockSignEvent },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.stubGlobal('location', {
      protocol: 'https:',
      hostname: 'unit.test',
    } as Location);

    const mod = await import('./useNostrPublish');
    useNostrPublish = mod.useNostrPublish;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('throws when user or signer is missing', async () => {
    getCurrentUser.mockReturnValue({ user: null, signer: null });

    const { result } = renderHook(() => useNostrPublish(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          kind: 1,
          content: '',
          tags: [],
        })
      ).rejects.toThrow('User is not logged in');
    });

    expect(mockSignEvent).not.toHaveBeenCalled();
    expect(mockNostrEvent).not.toHaveBeenCalled();
  });

  it('signs and publishes on relay with timeout signal', async () => {
    const { result } = renderHook(() => useNostrPublish(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        kind: 1,
        content: 'hello',
        tags: [['e', 'eventhex']],
      });
    });

    expect(mockSignEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 1,
        content: 'hello',
        tags: expect.arrayContaining([
          ['e', 'eventhex'],
          ['client', 'unit.test'],
        ]),
      })
    );

    expect(mockNostrEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: signedEvent.id }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('does not add hostname client tag when one already exists', async () => {
    const existingTags = [
      ['client', 'divine-web'],
      ['e', 'x'],
    ];
    mockSignEvent.mockImplementation(async (partial) => ({
      ...signedEvent,
      tags: partial.tags,
    }));

    const { result } = renderHook(() => useNostrPublish(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        kind: 1,
        content: '',
        tags: existingTags,
      });
    });

    const signArg = mockSignEvent.mock.calls[0]![0];
    const clientTags = signArg.tags.filter((t: string[]) => t[0] === 'client');
    expect(clientTags).toEqual([['client', 'divine-web']]);
  });

  it('skips hostname client tag when not on https', async () => {
    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: 'localhost',
    } as Location);

    const { result } = renderHook(() => useNostrPublish(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        kind: 5,
        content: '',
        tags: [['e', 'del']],
      });
    });

    const signArg = mockSignEvent.mock.calls[0]![0];
    expect(signArg.tags.some((t: string[]) => t[0] === 'client')).toBe(false);
  });

  it('surfaces relay errors from nostr.event', async () => {
    mockNostrEvent.mockRejectedValueOnce(new Error('relay unavailable'));

    const { result } = renderHook(() => useNostrPublish(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(result.current.mutateAsync({ kind: 1, content: '', tags: [] })).rejects.toThrow(
        'relay unavailable'
      );
    });
  });
});
