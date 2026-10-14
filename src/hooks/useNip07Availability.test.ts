import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectWindowNostr, removeWindowNostr } from '@/lib/bunkerToWindowNostr';

import {
  NIP07_GRACE_MS,
  NIP07_POLL_INTERVAL_MS,
  resetNip07Availability,
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

function settleWithoutProvider() {
  act(() => {
    vi.advanceTimersByTime(NIP07_GRACE_MS + NIP07_POLL_INTERVAL_MS);
  });
}

describe('useNip07Availability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetNostrProvider();
    resetNip07Availability();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    removeWindowNostr();
    resetNostrProvider();
    resetNip07Availability();
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

    settleWithoutProvider();

    expect(result.current).toBe('unavailable');
  });

  it('does not poll when no extension login needs the provider', () => {
    const { result } = renderHook(() => useNip07Availability(false));

    settleWithoutProvider();

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

  // Each caller used to run its own two-second clock, so a component that
  // mounted late kept "checking" after the rest of the app had given up.
  it('runs one grace period for the whole app', () => {
    const first = renderHook(() => useNip07Availability(true));

    act(() => {
      vi.advanceTimersByTime(NIP07_GRACE_MS - 500);
    });
    const late = renderHook(() => useNip07Availability(true));

    act(() => {
      vi.advanceTimersByTime(500 + NIP07_POLL_INTERVAL_MS);
    });

    expect(first.result.current).toBe('unavailable');
    expect(late.result.current).toBe('unavailable');
  });

  it.each([
    ['the tab regains focus', () => window.dispatchEvent(new Event('focus'))],
    ['the page is shown again', () => window.dispatchEvent(new Event('pageshow'))],
    ['the tab becomes visible', () => document.dispatchEvent(new Event('visibilitychange'))],
  ])('picks up an extension that loads after the grace period when %s', (_, signal) => {
    const { result } = renderHook(() => useNip07Availability(true));
    settleWithoutProvider();
    expect(result.current).toBe('unavailable');

    setNostrProvider();
    act(signal);

    expect(result.current).toBe('available');
  });

  it('picks up a late extension for the whole app when another component mounts', () => {
    const early = renderHook(() => useNip07Availability(true));
    settleWithoutProvider();

    setNostrProvider();
    const late = renderHook(() => useNip07Availability(true));

    expect(late.result.current).toBe('available');
    expect(early.result.current).toBe('available');
  });

  it('listens for a late extension once, however many components ask', () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    for (let i = 0; i < 20; i++) {
      renderHook(() => useNip07Availability(true));
    }

    settleWithoutProvider();

    const focusListeners = addListener.mock.calls.filter(([type]) => type === 'focus');
    expect(focusListeners).toHaveLength(1);
  });

  it("does not settle on the app's own hosted signer", () => {
    const { result } = renderHook(() => useNip07Availability(true));

    injectWindowNostr({ getPublicKey: vi.fn(), signEvent: vi.fn() });
    settleWithoutProvider();
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current).toBe('unavailable');
  });
});
