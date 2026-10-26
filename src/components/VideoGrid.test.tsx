import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { VideoGrid } from './VideoGrid';
import type { ParsedVideoData } from '@/types/video';
import { initializeI18n } from '@/lib/i18n';

function renderGrid(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

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
  checkMediaAuth: vi.fn().mockResolvedValue({ authorized: true, status: 200 }),
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
  beforeEach(async () => {
    await initializeI18n({ force: true, languages: ['en-US'] });
    vi.clearAllMocks();
    localStorage.clear();
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
    renderGrid(
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
    renderGrid(
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

  it('lets a viewer hide age-restricted tiles from the feed', () => {
    renderGrid(<VideoGrid videos={[makeVideo({ id: 'restricted-video', ageRestricted: true })]} />);

    fireEvent.click(screen.getByRole('button', { name: /don't show me these videos/i }));

    expect(localStorage.getItem('hide-age-restricted-videos')).toBe('true');
    expect(mockOpenLoginDialog).not.toHaveBeenCalled();
    expect(screen.queryByText('Age-restricted')).not.toBeInTheDocument();
  });

  it('honors the browser preference when a standalone grid is opened', () => {
    localStorage.setItem('hide-age-restricted-videos', 'true');
    localStorage.setItem('discovered-age-restricted-video-ids', JSON.stringify(['discovered-video']));
    renderGrid(<VideoGrid videos={[
      makeVideo({ id: 'restricted-video', ageRestricted: true }),
      makeVideo({ id: 'discovered-video' }),
      makeVideo({ id: 'public-video', content: 'Public video' }),
    ]} navigationContext={{ source: 'profile', pubkey: 'f'.repeat(64) }} />);

    expect(screen.queryByText('Age-restricted')).not.toBeInTheDocument();
    expect(screen.queryByTestId('video-thumbnail-discovered-video')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Public video' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Public video' }).getAttribute('href')).toContain('index=2');
  });

  it.each(['Enter', ' '])('does not confirm adulthood when %s is pressed on the hide button', (key) => {
    const confirmAdult = vi.fn();
    mockUseCurrentUser.mockReturnValue({ user: { pubkey: 'a'.repeat(64) } });
    mockUseAdultVerification.mockReturnValue({ isVerified: false, confirmAdult, getAuthHeader: vi.fn() });
    renderGrid(<VideoGrid videos={[makeVideo({ ageRestricted: true })]} />);

    fireEvent.keyDown(screen.getByRole('button', { name: /don't show me these videos/i }), { key });

    expect(confirmAdult).not.toHaveBeenCalled();
  });

  it('explains a refused age confirmation rather than silently doing nothing', () => {
    mockUseCurrentUser.mockReturnValue({ user: { pubkey: 'a'.repeat(64) } });
    mockUseAdultVerification.mockReturnValue({ isVerified: false, confirmAdult: vi.fn(() => false), getAuthHeader: vi.fn() });
    renderGrid(<VideoGrid videos={[makeVideo({ ageRestricted: true })]} />);
    fireEvent.click(screen.getByRole('button', { name: /verify age to view/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't confirm/i);
  });

  it('disables protected-minor confirmation and guards tile activation too', () => {
    const confirmAdult = vi.fn();
    mockUseCurrentUser.mockReturnValue({ user: { pubkey: 'a'.repeat(64) } });
    mockUseAdultVerification.mockReturnValue({ isVerified: false, isProtectedMinor: true, confirmAdult, getAuthHeader: vi.fn() });
    renderGrid(<VideoGrid videos={[makeVideo({ ageRestricted: true })]} />);
    expect(screen.getByRole('button', { name: /verify age to view/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/aren't available/i);
    fireEvent.keyDown(screen.getByTestId('video-grid-item'), { key: 'Enter' });
    expect(confirmAdult).not.toHaveBeenCalled();
  });

  it('shows the age-restricted gate when a thumbnail media error probes as 401', async () => {
    const { checkMediaAuth } = await import('@/hooks/useAdultVerification');
    (checkMediaAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      authorized: false,
      status: 401,
    });

    renderGrid(
      <VideoGrid
        videos={[
          makeVideo({
            id: 'unknown-restricted-video',
            ageRestricted: false,
          }),
        ]}
      />
    );

    fireEvent.error(screen.getByTestId('video-thumbnail-unknown-restricted-video'));

    await waitFor(() => {
      expect(screen.getByText('Log in to view')).toBeInTheDocument();
    });

    expect(JSON.parse(localStorage.getItem('discovered-age-restricted-video-ids') ?? '[]')).toContain('unknown-restricted-video');

    expect(screen.getByText('Age-restricted')).toBeInTheDocument();
    expect(screen.queryByTestId('video-thumbnail-unknown-restricted-video')).not.toBeInTheDocument();
    expect(screen.queryByTestId('video-player-unknown-restricted-video')).not.toBeInTheDocument();
  });

  it('renders unrestricted videos with their thumbnail media as before', () => {
    renderGrid(
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

    renderGrid(
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

describe('VideoGrid native link navigation', () => {
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

  it('renders unrestricted tiles as real links to the video page', () => {
    renderGrid(
      <VideoGrid videos={[makeVideo({ id: 'public-video' })]} />
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/video/public-video');
  });

  it('builds the link href from the navigation context when provided', () => {
    renderGrid(
      <VideoGrid
        videos={[makeVideo({ id: 'ctx-video' })]}
        navigationContext={{ source: 'profile', pubkey: 'f'.repeat(64) }}
      />
    );

    const href = screen.getByRole('link').getAttribute('href') ?? '';
    expect(href).toContain('/video/ctx-video');
    expect(href).toContain('source=profile');
    expect(href).toContain('index=0');
  });

  it('preserves people-list navigation context in tile links', () => {
    const owner = 'a'.repeat(64);
    renderGrid(
      <VideoGrid
        videos={[makeVideo({ id: 'ctx-video' })]}
        navigationContext={{ source: 'people-list', pubkey: owner, listId: 'friends' }}
      />
    );

    const href = screen.getByRole('link').getAttribute('href') ?? '';
    expect(href).toContain('/video/ctx-video');
    expect(href).toContain('source=people-list');
    expect(href).toContain(`pubkey=${owner}`);
    expect(href).toContain('listId=friends');
    expect(href).toContain('index=0');
  });

  it('does not render a link for age-gated tiles', () => {
    renderGrid(
      <VideoGrid
        videos={[makeVideo({ id: 'restricted-video', ageRestricted: true })]}
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('VideoGrid playback count badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentUser.mockReturnValue({ user: null });
    mockUseAdultVerification.mockReturnValue({ isVerified: false, confirmAdult: vi.fn(), getAuthHeader: vi.fn() });
  });

  it('shows native video playback counts without adding view starts and loops together', () => {
    renderGrid(
      <VideoGrid
        videos={[
          makeVideo({
            id: 'native-video',
            loopCount: 11,
            divineViewCount: 20,
            isVineMigrated: false,
          }),
        ]}
      />
    );

    expect(screen.getByText('20 loops')).toBeInTheDocument();
    expect(screen.queryByText('11 loops')).not.toBeInTheDocument();
    expect(screen.queryByText('31 loops')).not.toBeInTheDocument();
  });
});
