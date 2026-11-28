import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRssFeedAvailable } from './useRssFeedAvailable';

describe('useRssFeedAvailable', () => {
  it('returns true when enabled without firing a HEAD /feed/latest network probe', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useRssFeedAvailable());

    expect(result.current).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('returns false when disabled', () => {
    const { result } = renderHook(() => useRssFeedAvailable(false));
    expect(result.current).toBe(false);
  });
});
