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
  it('ends restoring after 30 seconds and stops polling for a missing extension', () => {
    vi.useFakeTimers();
    resetNostrProvider();
    const { result } = renderHook(() => useNip07Availability(true));
    act(() => { vi.advanceTimersByTime(30000); });
    expect(result.current.isRestoring).toBe(false);
    expect(result.current.isAvailable).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['focus', 'pageshow', 'visibilitychange'])('recovers on %s after the restoring deadline', (event) => {
    vi.useFakeTimers();
    resetNostrProvider();
    const { result } = renderHook(() => useNip07Availability(true));
    act(() => { vi.advanceTimersByTime(30000); });
    expect(result.current.isRestoring).toBe(false);
    act(() => {
      setNostrProvider();
      (event === 'visibilitychange' ? document : window).dispatchEvent(new Event(event));
    });
    expect(result.current.isAvailable).toBe(true);
    expect(result.current.isRestoring).toBe(false);
  });

  it('does not restart an unbounded restoring state if a recovered provider disappears', () => {
    vi.useFakeTimers();
    resetNostrProvider();
    const { result } = renderHook(() => useNip07Availability(true));
    act(() => { setNostrProvider(); vi.advanceTimersByTime(200); });
    expect(result.current.isAvailable).toBe(true);
    act(() => { resetNostrProvider(); window.dispatchEvent(new Event('focus')); });
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.isRestoring).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports an already injected provider without polling', () => {
    vi.useFakeTimers();
    setNostrProvider();
    const { result } = renderHook(() => useNip07Availability(true));
    expect(result.current).toEqual({ isAvailable: true, isRestoring: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not poll when no extension login needs the provider', () => {
    vi.useFakeTimers();
    resetNostrProvider();
    const { result } = renderHook(() => useNip07Availability(false));
    expect(result.current).toEqual({ isAvailable: false, isRestoring: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts a bounded wait when an extension login becomes needed and stops when removed', () => {
    vi.useFakeTimers();
    resetNostrProvider();
    const { result, rerender, unmount } = renderHook(({ needed }) => useNip07Availability(needed), { initialProps: { needed: false } });
    rerender({ needed: true });
    expect(result.current.isRestoring).toBe(true);
    rerender({ needed: false });
    expect(result.current.isRestoring).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    rerender({ needed: true });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

});
