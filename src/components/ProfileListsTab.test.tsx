// ABOUTME: Tests for ProfileListsTab — lists section of the profile page
// ABOUTME: Covers card rendering, create button visibility, and empty state

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileListsTab } from './ProfileListsTab';
import type { PeopleList } from '@/types/peopleList';
import type { VideoList } from '@/hooks/useVideoLists';

// ---- mocks ------------------------------------------------------------------

const { mockUseUnifiedLists } = vi.hoisted(() => ({
  mockUseUnifiedLists: vi.fn(),
}));

vi.mock('@/hooks/useUnifiedLists', () => ({
  useUnifiedLists: () => mockUseUnifiedLists(),
}));

// Stub CreatePeopleListDialog so dialog internals don't fire up
vi.mock('./CreatePeopleListDialog', () => ({
  CreatePeopleListDialog: ({
    open,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="create-people-list-dialog">dialog</div>
    ) : null,
}));

// Stub UnifiedListCard to avoid needing full routing + list internals
vi.mock('./UnifiedListCard', () => ({
  UnifiedListCard: ({
    kind,
    list,
  }: {
    kind: number;
    list: { name: string };
  }) => (
    <div data-testid={`list-card-${kind}`}>{list.name}</div>
  ),
}));

vi.mock('@/lib/eventRouting', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eventRouting')>('@/lib/eventRouting');
  return {
    ...actual,
    buildListPath: (pubkey: string, listId: string) => `/list/${pubkey}/${listId}`,
  };
});

// ---- fixtures ---------------------------------------------------------------

const PUBKEY = 'a'.repeat(64);

const PEOPLE_LIST: PeopleList = {
  id: 'friends',
  pubkey: PUBKEY,
  name: 'Friends',
  members: ['b'.repeat(64)],
  createdAt: 1_700_000_100,
};

const VIDEO_LIST: VideoList = {
  id: 'classics',
  name: 'Classic Vines',
  pubkey: PUBKEY,
  createdAt: 1_700_000_000,
  videoCoordinates: ['34236:aaa:1'],
  public: true,
};

function renderTab(props: { pubkey?: string; isOwn?: boolean } = {}) {
  const { pubkey = PUBKEY, isOwn = false } = props;
  return render(
    <MemoryRouter>
      <ProfileListsTab pubkey={pubkey} isOwn={isOwn} />
    </MemoryRouter>,
  );
}

// ---- tests ------------------------------------------------------------------

describe('ProfileListsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders cards for both people and video lists when both have data', () => {
    mockUseUnifiedLists.mockReturnValue({
      people: [PEOPLE_LIST],
      video: [VIDEO_LIST],
      isLoading: false,
      isError: false,
    });

    renderTab();

    expect(screen.getByTestId('list-card-30000')).toBeInTheDocument();
    expect(screen.getByTestId('list-card-30005')).toBeInTheDocument();
    expect(screen.getByText('Friends')).toBeInTheDocument();
    expect(screen.getByText('Classic Vines')).toBeInTheDocument();
  });

  it('shows "+ Create new list" sticker button when isOwn is true', () => {
    mockUseUnifiedLists.mockReturnValue({
      people: [PEOPLE_LIST],
      video: [],
      isLoading: false,
      isError: false,
    });

    renderTab({ isOwn: true });

    expect(
      screen.getByRole('button', { name: /create new list/i }),
    ).toBeInTheDocument();
  });

  it('hides "+ Create new list" button when isOwn is false', () => {
    mockUseUnifiedLists.mockReturnValue({
      people: [PEOPLE_LIST],
      video: [],
      isLoading: false,
      isError: false,
    });

    renderTab({ isOwn: false });

    expect(
      screen.queryByRole('button', { name: /create new list/i }),
    ).not.toBeInTheDocument();
  });

  it('shows empty state when both arrays are empty', () => {
    mockUseUnifiedLists.mockReturnValue({
      people: [],
      video: [],
      isLoading: false,
      isError: false,
    });

    renderTab();

    expect(screen.getByText('No lists yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('list-card-30000')).not.toBeInTheDocument();
    expect(screen.queryByTestId('list-card-30005')).not.toBeInTheDocument();
  });
});
