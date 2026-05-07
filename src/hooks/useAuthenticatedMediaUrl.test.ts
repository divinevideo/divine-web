import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthenticatedMediaUrl } from './useAuthenticatedMediaUrl';

const mockUseAdultVerification = vi.fn();

vi.mock('@/hooks/useAdultVerification', () => ({
  useAdultVerification: () => mockUseAdultVerification(),
  fetchWithAuth: vi.fn(async (url: string, authHeader: string | null) => fetch(url, {
    headers: authHeader ? { Authorization: authHeader } : {},
  })),
}));

describe('useAuthenticatedMediaUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdultVerification.mockReturnValue({
      isVerified: true,
      getAuthHeader: vi.fn().mockResolvedValue('Nostr signed-auth-header'),
    });
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:authenticated');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('sends auth for verified user on unknown-status protected media', async () => {
    const mockBlob = new Blob(['image'], { type: 'image/jpeg' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    }) as typeof fetch;
    const { result } = renderHook(() =>
      useAuthenticatedMediaUrl('https://media.divine.video/thumb.jpg', {
        ageRestricted: undefined,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://media.divine.video/thumb.jpg',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Nostr signed-auth-header',
        }),
      }),
    );
    expect(result.current.mediaUrl).toBe('blob:authenticated');
  });

  it('skips auth for explicitly safe protected media', async () => {
    const { result } = renderHook(() =>
      useAuthenticatedMediaUrl('https://media.divine.video/thumb.jpg', {
        ageRestricted: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.mediaUrl).toBe('https://media.divine.video/thumb.jpg');
  });

  it('does not fall back to the raw protected URL when authenticated fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as typeof fetch;

    const { result } = renderHook(() =>
      useAuthenticatedMediaUrl('https://media.divine.video/protected-thumbnail.jpg', {
        ageRestricted: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.mediaUrl).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://media.divine.video/protected-thumbnail.jpg',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Nostr signed-auth-header',
        }),
      }),
    );
  });
});
