// ABOUTME: Tests for useShare hook — verifies Web Share API, clipboard fallback, and error handling
// ABOUTME: Mocks navigator.share and navigator.clipboard to test all branches

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShare } from './useShare';

// Mock useToast
const mockToast = vi.fn();
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useShare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset navigator mocks
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('uses navigator.share when available', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: mockShare,
    });

    const { result } = renderHook(() => useShare());

    await act(async () => {
      await result.current.share({ url: 'https://divine.video/video/abc' });
    });

    expect(mockShare).toHaveBeenCalledWith({
      url: 'https://divine.video/video/abc',
    });
    // Should not show toast on successful share
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('silently handles AbortError (user cancelled)', async () => {
    const abortError = new Error('User cancelled');
    abortError.name = 'AbortError';
    const mockShare = vi.fn().mockRejectedValue(abortError);
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: mockShare,
    });

    const { result } = renderHook(() => useShare());

    await act(async () => {
      await result.current.share({ url: 'https://divine.video/video/abc' });
    });

    expect(mockShare).toHaveBeenCalled();
    // Should NOT show any toast for cancelled share
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('falls back to clipboard when navigator.share is unavailable', async () => {
    // navigator.share is undefined by default in beforeEach

    const { result } = renderHook(() => useShare());

    await act(async () => {
      await result.current.share({ url: 'https://divine.video/video/abc' });
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://divine.video/video/abc');
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Link copied!',
      description: 'Link has been copied to clipboard',
    });
  });

  it('falls back to clipboard when navigator.share throws non-AbortError', async () => {
    const shareError = new Error('Share failed');
    shareError.name = 'NotAllowedError';
    const mockShare = vi.fn().mockRejectedValue(shareError);
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: mockShare,
    });

    const { result } = renderHook(() => useShare());

    await act(async () => {
      await result.current.share({ url: 'https://divine.video/video/abc' });
    });

    // Should fall through to clipboard
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://divine.video/video/abc');
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Link copied!',
      description: 'Link has been copied to clipboard',
    });
  });

  it('shows error toast when clipboard also fails', async () => {
    // No navigator.share
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard failed')),
      },
    });

    const { result } = renderHook(() => useShare());

    await act(async () => {
      await result.current.share({ url: 'https://divine.video/video/abc' });
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Failed to copy link to clipboard',
      variant: 'destructive',
    });
  });
});
