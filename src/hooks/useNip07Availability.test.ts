import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNip07Availability } from './useNip07Availability';

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
  afterEach(() => {
    vi.useRealTimers();
    resetNostrProvider();
  });

  it('reports auth restoring while extension provider is unavailable', () => {
    resetNostrProvider();

    const { result } = renderHook(() => useNip07Availability(true));

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.isRestoring).toBe(true);
  });

  it('recovers after provider appears beyond the initial retry window', () => {
    vi.useFakeTimers();
    resetNostrProvider();

    const { result } = renderHook(() => useNip07Availability(true));

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.isRestoring).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.isRestoring).toBe(true);

    act(() => {
      setNostrProvider();
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isAvailable).toBe(true);
    expect(result.current.isRestoring).toBe(false);
  });
});
