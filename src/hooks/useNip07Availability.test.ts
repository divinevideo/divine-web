import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NIP07_GRACE_MS,
  NIP07_POLL_INTERVAL_MS,
  useNip07Availability,
} from './useNip07Availability';

const originalNostrDescriptor = Object.getOwnPropertyDescriptor(window, 'nostr');

function resetNostrProvider() {
  if (originalNostrDescriptor) {
    Object.defineProperty(window, 'nostr', originalNostrDescriptor);
    return;
  }

  delete (window as Window & { nostr?: unknown }).nostr;
}

function setNostrProvider(value: unknown = { getPublicKey: vi.fn() }) {
  Object.defineProperty(window, 'nostr', {
    value,
    writable: true,
    configurable: true,
  });
}

describe('useNip07Availability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetNostrProvider();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetNostrProvider();
  });

  it('reports available immediately when the provider is already injected', () => {
    setNostrProvider();

    const { result } = renderHook(() => useNip07Availability(true));

    expect(result.current).toBe('available');
  });

  it('reports checking, then available once the provider injects within the grace period', () => {
    const { result } = renderHook(() => useNip07Availability(true));

    expect(result.current).toBe('checking');

    act(() => {
      vi.advanceTimersByTime(NIP07_POLL_INTERVAL_MS * 3);
    });
    expect(result.current).toBe('checking');

    setNostrProvider();
    act(() => {
      vi.advanceTimersByTime(NIP07_POLL_INTERVAL_MS);
    });

    expect(result.current).toBe('available');
  });

  it('reports unavailable once the grace period elapses without a provider', () => {
    const { result } = renderHook(() => useNip07Availability(true));

    act(() => {
      vi.advanceTimersByTime(NIP07_GRACE_MS + NIP07_POLL_INTERVAL_MS);
    });

    expect(result.current).toBe('unavailable');
  });

  it('does not poll when no extension login needs the provider', () => {
    const { result } = renderHook(() => useNip07Availability(false));

    act(() => {
      vi.advanceTimersByTime(NIP07_GRACE_MS + NIP07_POLL_INTERVAL_MS);
    });

    // Without a consumer there is nothing to wait for; the status stays
    // "checking" and no timer flips it to a misleading terminal state.
    expect(result.current).toBe('checking');
  });

  it('recovers a provider that injects even when polling started before it was needed', () => {
    const { result, rerender } = renderHook(
      ({ needed }: { needed: boolean }) => useNip07Availability(needed),
      { initialProps: { needed: false } },
    );

    expect(result.current).toBe('checking');

    setNostrProvider();
    rerender({ needed: true });
    act(() => {
      vi.advanceTimersByTime(NIP07_POLL_INTERVAL_MS);
    });

    expect(result.current).toBe('available');
  });
});
