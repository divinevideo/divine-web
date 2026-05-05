// ABOUTME: Tests for the ProfilePage Tabs integration
// ABOUTME: Verifies default tab is Videos and that #lists hash selects the Lists tab

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProfilePage } from './ProfilePage';

// ---- stub all hooks ProfilePage depends on ----------------------------------

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/hooks/useFunnelcakeProfile', () => ({
  useFunnelcakeProfile: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/hooks/useVideoProvider', () => ({
  useVideoProvider: () => ({
    data: { pages: [] },
    isLoading: false,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
  }),
}));

vi.mock('@/hooks/useFollowRelationship', () => ({
  useFollowRelationship: () => ({ data: null, isLoading: false }),
  useFollowUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnfollowUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  FollowRaceError: class FollowRaceError extends Error {},
}));

vi.mock('@/hooks/useFollowListSafetyCheck', () => ({
  useFollowListSafetyCheck: () => ({ data: null }),
}));

vi.mock('@/hooks/useProfileJoinedDate', () => ({
  useProfileJoinedDate: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/hooks/useClassicVineArchiveStats', () => ({
  useClassicVineArchiveStats: () => ({ data: null }),
}));

vi.mock('@/hooks/useSubdomainUser', () => ({
  getSubdomainUser: () => null,
}));

vi.mock('@/hooks/useResolveSubdomainPubkey', () => ({
  useResolveSubdomainPubkey: () => ({ isResolved: false, isSearching: false, npub: null }),
}));

vi.mock('@/hooks/useNip05Pubkey', () => ({
  useNip05Pubkey: () => ({ data: null, isLoading: false, isFetched: false }),
}));

vi.mock('@/hooks/useNip05Validation', () => ({
  useNip05Validation: () => ({ isValid: false }),
}));

vi.mock('@/hooks/useRssFeedAvailable', () => ({
  useRssFeedAvailable: () => false,
}));

vi.mock('@/contexts/LoginDialogContext', () => ({
  useLoginDialog: () => ({ openLoginDialog: vi.fn() }),
}));

vi.mock('@/hooks/useToast', () => ({
  toast: vi.fn(),
}));

vi.mock('@unhead/react', () => ({
  useHead: vi.fn(),
  useSeoMeta: vi.fn(),
}));

// ---- stub heavy child components so the test stays unit-scoped --------------

vi.mock('@/components/ProfileHeader', () => ({
  ProfileHeader: () => <div data-testid="profile-header" />,
}));

vi.mock('@/components/EditProfileDialog', () => ({
  EditProfileDialog: () => null,
}));

vi.mock('@/components/FollowListSafetyDialog', () => ({
  FollowListSafetyDialog: () => null,
}));

vi.mock('@/components/PinnedVideosSection', () => ({
  PinnedVideosSection: () => null,
}));

vi.mock('@/components/VideoGrid', () => ({
  VideoGrid: () => <div data-testid="video-grid" />,
}));

vi.mock('@/components/VideoFeed', () => ({
  VideoFeed: () => <div data-testid="video-feed" />,
}));

vi.mock('@/components/ProfileListsTab', () => ({
  ProfileListsTab: ({ pubkey }: { pubkey: string; isOwn: boolean }) => (
    <div data-testid="profile-lists-tab">lists for {pubkey}</div>
  ),
}));

vi.mock('react-infinite-scroll-component', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ---- test helpers -----------------------------------------------------------

// A 64-char hex pubkey — ProfilePage accepts this directly without nip19 decode
const HEX_PUBKEY = 'a'.repeat(64);

function renderProfilePage(hash = '') {
  const route = `/profile/${HEX_PUBKEY}${hash}`;
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/profile/:npub" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ---- tests ------------------------------------------------------------------

describe('ProfilePage Tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to the Videos tab — Lists tab content is not visible', () => {
    renderProfilePage();

    // The Videos tab trigger must be present
    expect(screen.getByRole('tab', { name: 'Videos' })).toBeInTheDocument();
    // The Lists tab trigger must be present
    expect(screen.getByRole('tab', { name: 'Lists' })).toBeInTheDocument();

    // Lists tab content should not be rendered by default (Radix hides inactive content)
    expect(screen.queryByTestId('profile-lists-tab')).not.toBeInTheDocument();
  });

  it('selects the Lists tab on initial render when URL hash is #lists', () => {
    renderProfilePage('#lists');

    // Lists tab content should be visible
    expect(screen.getByTestId('profile-lists-tab')).toBeInTheDocument();
  });
});
