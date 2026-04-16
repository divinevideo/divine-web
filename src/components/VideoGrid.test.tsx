import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
    mockUseAdultVerification.mockReturnValue({ isVerified: false });
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
});
