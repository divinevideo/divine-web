import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useNip05Pubkey } from '@/hooks/useNip05Pubkey';
import { useNip05Validation } from '@/hooks/useNip05Validation';
import { NIP05_STALE_TIME_MS, nip05QueryOptions } from '@/lib/nip05Query';

const PUBKEY = 'a'.repeat(64);
function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('shared NIP-05 lookup', () => {
  it('resolves and validates one identity with one request while preserving name case', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ names: { Alice: PUBKEY } }) });
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => ({
      resolution: useNip05Pubkey('Alice@EXAMPLE.COM'),
      validation: useNip05Validation('Alice@example.com', PUBKEY),
      mismatch: useNip05Validation('Alice@example.com', 'b'.repeat(64)),
    }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.validation.isValid).toBe(true));
    expect(result.current.resolution.data).toBe(PUBKEY);
    expect(result.current.mismatch.isInvalid).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://example.com/.well-known/nostr.json?name=Alice');
  });

  it('updates validators when a failed lookup is explicitly retried', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue({ ok: true, json: async () => ({ names: { alice: PUBKEY } }) });
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => ({
      resolution: useNip05Pubkey('alice@example.com'),
      validation: useNip05Validation('alice@example.com', PUBKEY),
    }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.resolution.isFetched).toBe(true));
    await result.current.resolution.refetch();
    await waitFor(() => expect(result.current.validation.isValid).toBe(true));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(['server error', 'offline'])('stops validating an expired mapping after a refresh fails: %s', async (failure) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const options = nip05QueryOptions('alice@example.com');
    client.setQueryData(options.queryKey, PUBKEY, { updatedAt: Date.now() - NIP05_STALE_TIME_MS - 1000 });
    vi.stubGlobal('fetch', failure === 'offline'
      ? vi.fn().mockRejectedValue(new TypeError('offline'))
      : vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const wrapper = ({ children }: { children: ReactNode }) =>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useNip05Validation('alice@example.com', PUBKEY), { wrapper });
    await waitFor(() => expect(client.getQueryState(options.queryKey)?.status).toBe('error'));
    await waitFor(() => expect(result.current.isValid).toBe(false));
    expect(result.current.isInvalid).toBe(false);
    expect(result.current.state).toBe('idle');
  });

  it('keeps the shared lookup alive when one observer unmounts', async () => {
    let respond!: (response: unknown) => void;
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn((_url, options) => {
      signal = options.signal;
      return new Promise(resolve => { respond = resolve; });
    });
    vi.stubGlobal('fetch', fetcher);
    const wrapper = createWrapper();
    const first = renderHook(() => useNip05Pubkey('alice@example.com'), { wrapper });
    const second = renderHook(() => useNip05Validation('alice@example.com', PUBKEY), { wrapper });
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    first.unmount();
    expect(signal?.aborted).toBe(false);
    respond({ ok: true, json: async () => ({ names: { alice: PUBKEY } }) });
    await waitFor(() => expect(second.result.current.isValid).toBe(true));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
