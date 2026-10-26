import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgeRestrictedPreference } from './useAgeRestrictedPreference';

describe('useAgeRestrictedPreference', () => {
  beforeEach(() => localStorage.clear());

  it('keeps storage listeners registered across unrelated rerenders', () => {
    const { rerender } = renderHook(() => useAgeRestrictedPreference());
    const removeListener = vi.spyOn(window, 'removeEventListener');
    rerender();
    expect(removeListener).not.toHaveBeenCalled();
    removeListener.mockRestore();
  });

  it('saves the hide choice and shares it with other mounted views', async () => {
    const first = renderHook(() => useAgeRestrictedPreference());
    const second = renderHook(() => useAgeRestrictedPreference());

    act(() => first.result.current.setHideAgeRestricted(true));
    await waitFor(() => expect(second.result.current.hideAgeRestricted).toBe(true));

    first.unmount();
    second.unmount();
    const reopened = renderHook(() => useAgeRestrictedPreference());
    expect(reopened.result.current.hideAgeRestricted).toBe(true);

    act(() => reopened.result.current.setHideAgeRestricted(false));
    expect(reopened.result.current.hideAgeRestricted).toBe(false);
  });

  it('remembers an age-restricted video discovered through a media rejection', () => {
    const { result, unmount } = renderHook(() => useAgeRestrictedPreference());
    act(() => {
      result.current.markAgeRestricted('video-discovered');
      result.current.setHideAgeRestricted(true);
    });

    expect(result.current.shouldHideVideo({ id: 'video-discovered' })).toBe(true);
    expect(result.current.shouldHideVideo({ id: 'video-public' })).toBe(false);
    unmount();

    const reopened = renderHook(() => useAgeRestrictedPreference());
    expect(reopened.result.current.shouldHideVideo({ id: 'video-discovered' })).toBe(true);
  });

  it('keeps discoveries made by two media players in the same render cycle', () => {
    const first = renderHook(() => useAgeRestrictedPreference());
    const second = renderHook(() => useAgeRestrictedPreference());

    act(() => {
      first.result.current.markAgeRestricted('video-a');
      second.result.current.markAgeRestricted('video-b');
    });

    expect(first.result.current.shouldHideVideo({ id: 'video-a' })).toBe(false);
    act(() => first.result.current.setHideAgeRestricted(true));
    expect(first.result.current.shouldHideVideo({ id: 'video-a' })).toBe(true);
    expect(first.result.current.shouldHideVideo({ id: 'video-b' })).toBe(true);
  });
});
