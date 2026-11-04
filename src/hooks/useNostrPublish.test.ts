// ABOUTME: Tests for useNostrPublish — sign + relay publish with client tag rules
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockNostrEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const config = vi.hoisted(() => ({ disabledPresetUrls: [] as string[] }));
vi.mock('@/hooks/useAppContext', () => ({ useAppContext: () => ({ config }) }));

const signedEvent = {
  id: 'ab'.repeat(32),
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
    config.disabledPresetUrls = [];
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
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries a timed-out primary with a fresh deadline without signing again', async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), milliseconds);
      return controller.signal;
    });
    let attempts = 0;
    mockNostrEvent.mockImplementation(async (_event, opts) => {
      if (opts?.relays && ++attempts === 1) {
        await new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => reject(opts.signal.reason), { once: true });
        });
      }
    });
    const { result } = renderHook(() => useNostrPublish(), { wrapper: createWrapper() });

    await act(async () => {
      const pending = result.current.mutateAsync({ kind: 30005, tags: [['d', 'saved']], content: '' })
        .then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
      await vi.advanceTimersByTimeAsync(5000);
      expect(attempts).toBe(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect((await pending).error).toBeUndefined();
    });
    expect(attempts).toBe(2);
    expect(mockSignEvent).toHaveBeenCalledTimes(1);
  });

  it('retries primary list publication with the same signed event before reporting success', async () => {
    vi.useFakeTimers();
    mockNostrEvent.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValue(undefined);
    const { result } = renderHook(() => useNostrPublish(), { wrapper: createWrapper() });

    await act(async () => {
      const pending = result.current.mutateAsync({ kind: 30005, tags: [['d', 'saved']], content: '' })
        .then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
      await vi.advanceTimersByTimeAsync(1000);
      expect((await pending).error).toBeUndefined();
    });

    const attempts = mockNostrEvent.mock.calls.filter(([, opts]) => opts?.relays?.includes('wss://relay.divine.video'));
    expect(attempts).toHaveLength(2);
    expect(attempts[0][0]).toBe(attempts[1][0]);
    expect(attempts[0][1].signal).not.toBe(attempts[1][1].signal);
    expect(mockSignEvent).toHaveBeenCalledTimes(1);
  });

  it('fails after three primary attempts even when a backup would accept the list', async () => {
    vi.useFakeTimers();
    mockNostrEvent.mockImplementation(async (_event, opts) => {
      if (opts?.relays?.includes('wss://relay.divine.video')) throw new Error('Network unavailable');
    });
    const { result } = renderHook(() => useNostrPublish(), { wrapper: createWrapper() });

    await act(async () => {
      const pending = result.current.mutateAsync({ kind: 30005, tags: [['d', 'saved']], content: '' })
        .then(() => undefined, error => error);
      await vi.advanceTimersByTimeAsync(3000);
      expect(await pending).toEqual(expect.objectContaining({ message: 'Network unavailable' }));
    });
    expect(mockNostrEvent).toHaveBeenCalledTimes(3);
    expect(mockSignEvent).toHaveBeenCalledTimes(1);
  });

  it('keeps a primary-acknowledged save successful when background replication fails', async () => {
    mockNostrEvent.mockImplementation(async (_event, opts) => {
      if (!opts?.relays) throw new Error('Backup unavailable');
    });
    const { result } = renderHook(() => useNostrPublish(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(result.current.mutateAsync({ kind: 30005, tags: [['d', 'saved']], content: '' }))
        .resolves.toEqual(expect.objectContaining({ id: signedEvent.id }));
    });
  });

  it('fails before signing when the Divine primary is disabled', async () => {
    config.disabledPresetUrls = ['wss://relay.divine.video'];
    const { result } = renderHook(() => useNostrPublish(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(result.current.mutateAsync({ kind: 30005, tags: [['d', 'saved']], content: '' }))
        .rejects.toThrow('primary relay');
    });
    expect(mockSignEvent).not.toHaveBeenCalled();
    expect(mockNostrEvent).not.toHaveBeenCalled();
  });

  it.each([30000, 30001, 30005, 5])('requires the primary for list publication kind %i', async (kind) => {
    const { result } = renderHook(() => useNostrPublish(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ kind, tags: [['k', '30005'], ['d', 'saved']], content: '' });
    });

    expect(mockNostrEvent.mock.calls[0][1].relays).toEqual(['wss://relay.divine.video']);
  });

  it.each([false, true])('does not retry a permanent primary rejection (pooled: %s)', async (pooled) => {
    vi.useFakeTimers();
    const cause = new Error('invalid: malformed event');
    mockNostrEvent.mockRejectedValue(pooled ? Object.assign(new Error('All promises were rejected'), { errors: [cause] }) : cause);
    const { result } = renderHook(() => useNostrPublish(), { wrapper: createWrapper() });

    await act(async () => {
      const pending = result.current.mutateAsync({ kind: 30005, tags: [['d', 'saved']], content: '' })
        .then(() => undefined, error => error);
      await vi.advanceTimersByTimeAsync(3000);
      expect(await pending).toBeInstanceOf(Error);
    });
    expect(mockNostrEvent).toHaveBeenCalledTimes(1);
    expect(mockSignEvent).toHaveBeenCalledTimes(1);
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
