import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThumbnailPlayer } from './ThumbnailPlayer';

const mockUseAdultVerification = vi.fn();

vi.mock('@/hooks/useAdultVerification', () => ({
  useAdultVerification: () => mockUseAdultVerification(),
  checkMediaAuth: vi.fn().mockResolvedValue({ authorized: true, status: 200 }),
  fetchWithAuth: vi.fn(async (url: string, authHeader: string | null) =>
    fetch(url, {
      headers: authHeader ? { Authorization: authHeader } : {},
    })
  ),
}));

vi.mock('@/components/AgeVerificationOverlay', () => ({
  AgeVerificationOverlay: () => <div data-testid="age-verification-overlay">Age verification</div>,
}));

vi.mock('@/lib/debug', () => ({
  verboseLog: vi.fn(),
  debugError: vi.fn(),
}));

describe('ThumbnailPlayer', () => {
  beforeEach(async () => {
    const { initializeI18n } = await import('@/lib/i18n');
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });
    await initializeI18n({ force: true, languages: ['en-US'] });
    vi.clearAllMocks();
    mockUseAdultVerification.mockReturnValue({
      isVerified: true,
      getAuthHeader: vi.fn().mockResolvedValue('Nostr signed-auth-header'),
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['thumb'], { type: 'image/jpeg' }),
    }) as typeof fetch;

    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:protected-thumb');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lets the play button start playback without triggering the thumbnail click action', () => {
    const handleThumbnailClick = vi.fn();
    const handlePlayButtonClick = vi.fn();

    render(
      <ThumbnailPlayer
        videoId="video-123"
        src="https://example.com/video.mp4"
        thumbnailUrl="https://example.com/thumb.jpg"
        onClick={handleThumbnailClick}
        onPlayButtonClick={handlePlayButtonClick}
      />
    );

    fireEvent.click(screen.getByLabelText('Play video'));

    expect(handlePlayButtonClick).toHaveBeenCalledTimes(1);
    expect(handleThumbnailClick).not.toHaveBeenCalled();
  });

  it('still delegates container clicks to the thumbnail click action', () => {
    const handleThumbnailClick = vi.fn();

    render(
      <ThumbnailPlayer
        videoId="video-123"
        src="https://example.com/video.mp4"
        thumbnailUrl="https://example.com/thumb.jpg"
        onClick={handleThumbnailClick}
      />
    );

    fireEvent.click(screen.getByTestId('thumbnail-container'));

    expect(handleThumbnailClick).toHaveBeenCalledTimes(1);
  });

  it('fetches protected thumbnail images with auth when the viewer is verified', async () => {
    render(
      <ThumbnailPlayer
        videoId="restricted-video"
        src="https://media.divine.video/restricted-video"
        thumbnailUrl="https://media.divine.video/restricted-video.jpg"
        ageRestricted
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://media.divine.video/restricted-video.jpg',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Nostr signed-auth-header',
          }),
        })
      );
    });

    expect(screen.getByTestId('video-thumbnail')).toHaveAttribute(
      'src',
      'blob:protected-thumb'
    );
  });

  it('renders a real link to the video page when linkTo is provided', () => {
    render(
      <MemoryRouter>
        <ThumbnailPlayer
          videoId="video-123"
          src="https://example.com/video.mp4"
          thumbnailUrl="https://example.com/thumb.jpg"
          linkTo="/video/video-123"
        />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: 'Open video' });
    expect(link).toHaveAttribute('href', '/video/video-123');
  });

  it('does not also fire the thumbnail click action when the link is clicked', () => {
    const handleThumbnailClick = vi.fn();

    render(
      <MemoryRouter>
        <ThumbnailPlayer
          videoId="video-123"
          src="https://example.com/video.mp4"
          thumbnailUrl="https://example.com/thumb.jpg"
          linkTo="/video/video-123"
          onClick={handleThumbnailClick}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link', { name: 'Open video' }));

    expect(handleThumbnailClick).not.toHaveBeenCalled();
  });

  it('keeps the play button outside the link so it does not navigate', () => {
    const handlePlayButtonClick = vi.fn();

    render(
      <MemoryRouter>
        <ThumbnailPlayer
          videoId="video-123"
          src="https://example.com/video.mp4"
          thumbnailUrl="https://example.com/thumb.jpg"
          linkTo="/video/video-123"
          onPlayButtonClick={handlePlayButtonClick}
        />
      </MemoryRouter>
    );

    const playButton = screen.getByLabelText('Play video');
    const link = screen.getByRole('link', { name: 'Open video' });
    expect(link.contains(playButton)).toBe(false);

    fireEvent.click(playButton);
    expect(handlePlayButtonClick).toHaveBeenCalledTimes(1);
  });

  it('does not render a link when linkTo is omitted', () => {
    render(
      <MemoryRouter>
        <ThumbnailPlayer
          videoId="video-123"
          src="https://example.com/video.mp4"
          thumbnailUrl="https://example.com/thumb.jpg"
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
