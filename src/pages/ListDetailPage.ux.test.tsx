// ABOUTME: Tests the public video-list detail hierarchy and list-aware video navigation

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';

import ListDetailPage from './ListDetailPage';

const OWNER = 'a'.repeat(64);
const mockShare = vi.fn();
let mockListName = 'Six seconds of joy';
let mockAuthorName = 'Loop Lover';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number; name?: string }) => {
      const translations: Record<string, string> = {
        'listDetailPage.backToCreatorLists': `All lists by ${values?.name ?? ''}`,
        'listDetailPage.videoList': 'Video list',
        'listDetailPage.untitledVideoList': 'Untitled video list',
        'listDetailPage.byCreator': `By ${values?.name ?? ''}`,
        'listDetailPage.videoCount': `${values?.count ?? 0} videos`,
        'listDetailPage.playOrderChronological': 'Oldest First',
        'listDetailPage.share': 'Share',
        'listDetailPage.videosInList': 'Videos in this list',
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: vi.fn() } }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'list-detail') {
      return {
        data: {
          id: 'favorites',
          name: mockListName,
          description: 'Tiny loops worth another look.',
          pubkey: OWNER,
          createdAt: 1_700_000_000,
          members: [
            { coordinate: `34236:${'b'.repeat(64)}:one` },
            { coordinate: `34236:${'c'.repeat(64)}:two` },
          ],
          memberCount: 2,
          public: true,
          playOrder: 'chronological',
        },
        isLoading: false,
      };
    }

    return {
      data: [
        {
          id: 'video-1',
          pubkey: 'b'.repeat(64),
          kind: 34236,
          createdAt: 1,
          content: 'First loop',
          videoUrl: 'https://example.com/one.mp4',
          thumbnailUrl: 'https://example.com/one.jpg',
          hashtags: [],
          vineId: 'one',
          reposts: [],
          isVineMigrated: false,
        },
        {
          id: 'video-2',
          pubkey: 'c'.repeat(64),
          kind: 34236,
          createdAt: 2,
          content: 'Second loop',
          videoUrl: 'https://example.com/two.mp4',
          thumbnailUrl: 'https://example.com/two.jpg',
          hashtags: [],
          vineId: 'two',
          reposts: [],
          isVineMigrated: false,
        },
      ],
      isLoading: false,
    };
  },
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: { metadata: { name: mockAuthorName, picture: 'https://example.com/avatar.jpg' } },
  }),
}));

vi.mock('@/hooks/useVideoLists', () => ({
  useRemoveVideoFromList: () => ({ mutateAsync: vi.fn() }),
  useDeleteVideoList: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useShare', () => ({
  useShare: () => ({ share: mockShare }),
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({ config: { relayUrl: 'wss://relay.example.com' } }),
}));

vi.mock('@/hooks/useAdultVerification', () => ({
  useAdultVerification: () => ({ isVerified: false, confirmAdult: vi.fn() }),
  checkMediaAuth: vi.fn().mockResolvedValue({ authorized: true, status: 200 }),
}));

vi.mock('@/hooks/useAuthenticatedMediaUrl', () => ({
  useAuthenticatedMediaUrl: (url: string) => ({ mediaUrl: url, isLoading: false }),
}));

vi.mock('@/contexts/LoginDialogContext', () => ({
  useLoginDialog: () => ({ openLoginDialog: vi.fn() }),
}));

function VideoDestination() {
  const location = useLocation();
  return <p data-testid="video-destination">{`${location.pathname}${location.search}`}</p>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/list/${OWNER}/favorites`]}>
      <Routes>
        <Route path="/list/:pubkey/:listId" element={<ListDetailPage />} />
        <Route path="/video/:id" element={<VideoDestination />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ListDetailPage UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListName = 'Six seconds of joy';
    mockAuthorName = 'Loop Lover';
  });

  it('centers the list title, creator, and creator-list navigation in the header', () => {
    renderPage();

    expect(screen.getByText('Video list')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Six seconds of joy' })).toBeInTheDocument();
    expect(screen.getByText('Tiny loops worth another look.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'By Loop Lover' })).toHaveAttribute(
      'href',
      `/profile/${nip19.npubEncode(OWNER)}`,
    );
    expect(screen.getByRole('link', { name: 'All lists by Loop Lover' })).toHaveAttribute(
      'href',
      `/profile/${nip19.npubEncode(OWNER)}/lists`,
    );
  });

  it('labels the grid with its count and opens videos in this list context', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: '2 videos' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'First loop' }));
    const destination = new URL(screen.getByTestId('video-destination').textContent ?? '', 'https://divine.video');
    expect(destination.pathname).toBe('/video/video-1');
    expect(destination.searchParams.get('source')).toBe('video-list');
    expect(destination.searchParams.get('pubkey')).toBe(OWNER);
    expect(destination.searchParams.get('listId')).toBe('favorites');
    expect(destination.searchParams.get('listName')).toBe('Six seconds of joy');
  });

  it('replaces a raw list id with a useful title', () => {
    mockListName = 'favorites';

    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Untitled video list' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'favorites' })).not.toBeInTheDocument();
  });

  it('replaces a raw creator key with a readable generated name', () => {
    mockAuthorName = OWNER;

    renderPage();

    expect(screen.queryByText(OWNER)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^By (?!a{64}$)/ })).toBeInTheDocument();
  });
});
