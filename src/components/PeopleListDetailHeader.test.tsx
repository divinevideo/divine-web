// ABOUTME: Tests for PeopleListDetailHeader — list detail page header with stats, avatar strip, and action buttons
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PeopleListDetailHeader } from './PeopleListDetailHeader';
import type { PeopleList } from '@/types/peopleList';

// ---- mock usePeopleListMembers -----------------------------------------------

vi.mock('@/hooks/usePeopleListMembers');
import { usePeopleListMembers } from '@/hooks/usePeopleListMembers';
const mockUsePeopleListMembers = vi.mocked(usePeopleListMembers);

// ---- mock buildListMembersPath -----------------------------------------------

vi.mock('@/lib/eventRouting', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eventRouting')>('@/lib/eventRouting');
  return {
    ...actual,
    buildListMembersPath: (pubkey: string, dTag: string) => `/list/${pubkey}/${dTag}/members`,
  };
});

// ---- shared fixtures ---------------------------------------------------------

const PUBKEY = 'a'.repeat(64);
const D_TAG = 'my-people-list';

const LIST: PeopleList = {
  id: D_TAG,
  pubkey: PUBKEY,
  name: 'My People',
  description: 'A great group of people.',
  members: ['b'.repeat(64), 'c'.repeat(64)],
  createdAt: 1_700_000_000,
};

const STATS = { members: 33, videos: 88, loops: null };

function makeMembers(count = 2) {
  return Array.from({ length: count }, (_, i) => ({
    pubkey: String(i).padStart(64, '0'),
    metadata: { name: `User ${i}` },
  }));
}

function renderHeader(props: Partial<React.ComponentProps<typeof PeopleListDetailHeader>> = {}) {
  const defaults = {
    pubkey: PUBKEY,
    dTag: D_TAG,
    list: LIST,
    stats: STATS,
    isOwner: false,
    isFollowing: false,
  };
  return render(
    <MemoryRouter>
      <PeopleListDetailHeader {...defaults} {...props} />
    </MemoryRouter>,
  );
}

// ---- tests -------------------------------------------------------------------

describe('PeopleListDetailHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePeopleListMembers.mockReturnValue({
      members: makeMembers(2),
      isLoading: false,
      isError: false,
    });
  });

  it('shows "Edit list" button when isOwner=true, no Follow button', () => {
    renderHeader({ isOwner: true });

    expect(screen.getByRole('button', { name: /edit list/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^follow$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /following/i })).not.toBeInTheDocument();
  });

  it('shows "Follow" sticker button when visitor is not following', () => {
    renderHeader({ isOwner: false, isFollowing: false });

    const btn = screen.getByRole('button', { name: /^follow$/i });
    expect(btn).toBeInTheDocument();
    // sticker variant ships brand-sticker in its class attribute
    expect(btn.className).toMatch(/brand-sticker/);
    expect(screen.queryByRole('button', { name: /edit list/i })).not.toBeInTheDocument();
  });

  it('shows "Following" sticker button when visitor is already following', () => {
    renderHeader({ isOwner: false, isFollowing: true });

    const btn = screen.getByRole('button', { name: /following/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toMatch(/brand-sticker/);
    expect(screen.queryByRole('button', { name: /^follow$/i })).not.toBeInTheDocument();
  });

  it('renders stats row with correct format', () => {
    // videos=88, loops=null → "33 members · 88 videos · — loops"
    renderHeader({ stats: { members: 33, videos: 88, loops: null } });
    const statsEl = screen.getByTestId('people-list-stats');
    expect(statsEl).toHaveTextContent('33 members');
    expect(statsEl).toHaveTextContent('88 videos');
    expect(statsEl).toHaveTextContent('— loops');

    // videos=null as well → "33 members · — videos · — loops"
  });

  it('renders "— videos" when videos stat is null', () => {
    renderHeader({ stats: { members: 33, videos: null, loops: null } });
    const statsEl = screen.getByTestId('people-list-stats');
    expect(statsEl).toHaveTextContent('— videos');
    expect(statsEl).toHaveTextContent('— loops');
  });

  it('View all link points to buildListMembersPath(pubkey, dTag)', () => {
    renderHeader();
    const link = screen.getByRole('link', { name: /view all/i });
    expect(link).toHaveAttribute('href', `/list/${PUBKEY}/${D_TAG}/members`);
  });
});
