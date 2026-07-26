// ABOUTME: Tests the public filterable gallery of a profile's lists

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import ProfileListsPage from './ProfileListsPage';

const OWNER = 'a'.repeat(64);
const mockUsePeopleLists = vi.fn();
const mockUseVideoLists = vi.fn();

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
    });
    mockUseVideoLists.mockReturnValue({
      data: [{ id: 'videos', name: 'My videos', pubkey: OWNER, createdAt: 10, videoCoordinates: [], public: true }],
      isLoading: false,
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
});
