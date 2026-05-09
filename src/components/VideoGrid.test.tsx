import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VideoGrid } from './VideoGrid';
import type { ParsedVideoData } from '@/types/video';

const mockNavigate = vi.fn();
const mockOpenLoginDialog = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseAdultVerification = vi.fn();

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/contexts/LoginDialogContext', () => ({
  useLoginDialog: () => ({
    openLoginDialog: mockOpenLoginDialog,
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock('@/hooks/useAdultVerification', () => ({
  useAdultVerification: () => mockUseAdultVerification(),
  fetchWithAuth: vi.fn(async (url: string, authHeader: string | null) => fetch(url, {
    headers: authHeader ? { Authorization: authHeader } : {},
  })),
}));

function makeVideo(overrides: Partial<ParsedVideoData> = {}): ParsedVideoData {
  return {
    id: 'video-1',
    pubkey: 'f'.repeat(64),
    kind: 34236,
    createdAt: 1700000000,
    content: 'Test video',
    videoUrl: 'https://media.divine.video/video-1',
    thumbnailUrl: 'https://media.divine.video/video-1.jpg',
    hashtags: [],
    vineId: 'vine-id-1',
    reposts: [],
    isVineMigrated: false,
    ...overrides,
  };
}

describe('VideoGrid age-restricted gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentUser.mockReturnValue({ user: null });
    mockUseAdultVerification.mockReturnValue({ isVerified: false, confirmAdult: vi.fn(), getAuthHeader: vi.fn() });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['thumb'], { type: 'image/jpeg' }),
    }) as typeof fetch;
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:grid-thumb');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a logged-out gated tile without mounting restricted media elements', () => {
    render(
      <VideoGrid
        videos={[
          makeVideo({
            id: 'restricted-video',
            title: 'Constructive criticism',
            ageRestricted: true,
          }),
        ]}
      />
    );

    expect(screen.getByText('Log in to view')).toBeInTheDocument();
    expect(screen.getByText('Age-restricted')).toBeInTheDocument();
    expect(screen.queryByTestId('video-thumbnail-restricted-video')).not.toBeInTheDocument();
    expect(screen.queryByTestId('video-player-restricted-video')).not.toBeInTheDocument();
  });

  it('opens the login dialog when the gated tile is clicked', () => {
    render(
      <VideoGrid
        videos={[
          makeVideo({
            id: 'restricted-video',
            ageRestricted: true,
          }),
        ]}
      />
    );

    fireEvent.click(screen.getByTestId('video-grid-item'));

    expect(mockOpenLoginDialog).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders unrestricted videos with their thumbnail media as before', () => {
    render(
      <VideoGrid
        videos={[
          makeVideo({
            id: 'public-video',
            ageRestricted: false,
          }),
        ]}
      />
    );

    expect(screen.getByTestId('video-thumbnail-public-video')).toBeInTheDocument();
    expect(screen.queryByText('Log in to view')).not.toBeInTheDocument();
  });

  it('fetches protected thumbnails with auth for verified viewers', async () => {
    mockUseCurrentUser.mockReturnValue({ user: { pubkey: 'a'.repeat(64) } });
    mockUseAdultVerification.mockReturnValue({
      isVerified: true,
      confirmAdult: vi.fn(),
      getAuthHeader: vi.fn().mockResolvedValue('Nostr grid-auth-header'),
    });

    render(
      <VideoGrid
        videos={[
          makeVideo({
            id: 'verified-restricted-video',
            ageRestricted: true,
            thumbnailUrl: 'https://media.divine.video/verified-restricted-video.jpg',
          }),
        ]}
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://media.divine.video/verified-restricted-video.jpg',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Nostr grid-auth-header',
          }),
        }),
      );
    });

    expect(screen.getByTestId('video-thumbnail-verified-restricted-video')).toHaveAttribute('src', 'blob:grid-thumb');
  });
});
