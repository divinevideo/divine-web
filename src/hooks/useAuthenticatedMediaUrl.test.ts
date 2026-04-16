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
  });

  it('does not fall back to the raw protected URL when authenticated fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as typeof fetch;

    const { result } = renderHook(() =>
      useAuthenticatedMediaUrl('https://media.divine.video/protected-thumbnail.jpg'),
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
