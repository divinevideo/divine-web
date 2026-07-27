// ABOUTME: Tests the public filterable gallery of a profile's lists

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import ProfileListsPage from './ProfileListsPage';

const OWNER = 'a'.repeat(64);
const mockUsePeopleLists = vi.fn();
const mockUseVideoLists = vi.fn();
const mockRefetchPeople = vi.fn();
const mockRefetchVideos = vi.fn();

vi.mock('@/hooks/usePeopleLists', () => ({
  usePeopleLists: (...args: unknown[]) => mockUsePeopleLists(...args),
}));
vi.mock('@/hooks/useVideoLists', () => ({
  useVideoLists: (...args: unknown[]) => mockUseVideoLists(...args),
}));

function renderPage(identifier: string = nip19.npubEncode(OWNER)) {
  return render(
    <MemoryRouter initialEntries={[`/profile/${identifier}/lists`]}>
      <Routes>
        <Route path="/profile/:npub/lists" element={<ProfileListsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProfileListsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePeopleLists.mockReturnValue({
      data: [{ id: 'people', name: 'My people', pubkey: OWNER, createdAt: 20, memberPubkeys: [] }],
      isLoading: false,
      isError: false,
      refetch: mockRefetchPeople,
    });
    mockUseVideoLists.mockReturnValue({
      data: [{ id: 'videos', name: 'My videos', pubkey: OWNER, createdAt: 10, videoCoordinates: [], public: true }],
      isLoading: false,
      isError: false,
      refetch: mockRefetchVideos,
    });
  });

  it('shows mixed lists by default and filters by type', () => {
    renderPage();
    expect(screen.getByText('My people')).toBeInTheDocument();
    expect(screen.getByText('My videos')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'People' }));
    fireEvent.click(screen.getByRole('tab', { name: 'People' }));
    expect(screen.getByText('My people')).toBeInTheDocument();
    expect(screen.queryByText('My videos')).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Videos' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Videos' }));
    expect(screen.queryByText('My people')).not.toBeInTheDocument();
    expect(screen.getByText('My videos')).toBeInTheDocument();
  });

  it('rejects invalid identifiers without querying another user or global lists', () => {
    renderPage('not-a-pubkey');
    expect(screen.getByText('That profile link is not valid.')).toBeInTheDocument();
    expect(mockUsePeopleLists).not.toHaveBeenCalled();
    expect(mockUseVideoLists).not.toHaveBeenCalled();
  });

  it('shows a retryable error when both list queries fail', () => {
    mockUsePeopleLists.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetchPeople,
    });
    mockUseVideoLists.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetchVideos,
    });

    renderPage();

    expect(screen.getByText('Lists did not load.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mockRefetchPeople).toHaveBeenCalledTimes(1);
    expect(mockRefetchVideos).toHaveBeenCalledTimes(1);
  });

  it('preserves successful lists and offers retry when one query fails', () => {
    mockUsePeopleLists.mockReturnValue({
      data: [{ id: 'people', name: 'My people', pubkey: OWNER, createdAt: 20, memberPubkeys: [] }],
      isLoading: false,
      isError: false,
      refetch: mockRefetchPeople,
    });
    mockUseVideoLists.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetchVideos,
    });

    renderPage();

    expect(screen.getByText('My people')).toBeInTheDocument();
    expect(screen.getByText('Some lists did not load.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mockRefetchPeople).not.toHaveBeenCalled();
    expect(mockRefetchVideos).toHaveBeenCalledTimes(1);
  });
});
