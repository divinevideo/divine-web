// ABOUTME: Tests for PeopleListCard — discovery card for a people list (Figma #1/#2)
// ABOUTME: Covers title/description, member count badge, navigation, and placeholder fallback

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { PeopleListCard } from './PeopleListCard';
import type { PeopleList } from '@/types/peopleList';

// ---- mock react-router navigate -----------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ---- mock buildListPath -------------------------------------------------------

vi.mock('@/lib/eventRouting', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eventRouting')>('@/lib/eventRouting');
  return {
    ...actual,
    buildListPath: (pubkey: string, listId: string) => `/list/${pubkey}/${listId}`,
  };
});

// ---- shared fixtures ---------------------------------------------------------

const PUBKEY = 'a'.repeat(64);

const LIST: PeopleList = {
  id: 'cool-people',
  pubkey: PUBKEY,
  name: 'Cool People',
  description: 'A curated list of interesting folk.',
  members: ['b'.repeat(64), 'c'.repeat(64), 'd'.repeat(64)],
  createdAt: 1_700_000_000,
};

const EMPTY_MEMBERS_LIST: PeopleList = {
  id: 'empty-list',
  pubkey: PUBKEY,
  name: 'Empty List',
  members: [],
  createdAt: 1_700_000_000,
};

const MEMBERS_PREVIEW = [
  { pubkey: 'b'.repeat(64), metadata: { picture: 'https://example.com/a.jpg' } },
  { pubkey: 'c'.repeat(64), metadata: { picture: 'https://example.com/b.jpg' } },
  { pubkey: 'd'.repeat(64), metadata: {} },
];

function renderCard(
  list: PeopleList = LIST,
  membersPreview?: typeof MEMBERS_PREVIEW,
) {
  return render(
    <MemoryRouter>
      <PeopleListCard list={list} membersPreview={membersPreview} />
    </MemoryRouter>,
  );
}

// ---- tests -------------------------------------------------------------------

describe('PeopleListCard', () => {
  it('renders the title and description', () => {
    renderCard();

    expect(screen.getByText('Cool People')).toBeInTheDocument();
    expect(screen.getByText('A curated list of interesting folk.')).toBeInTheDocument();
  });

  it('renders the member count badge when list.members.length >= 1', () => {
    renderCard();

    // Badge should show the member count
    const badge = screen.getByTestId('member-count-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('3');
  });

  it('navigates to buildListPath(list.pubkey, list.id) on click', () => {
    renderCard();

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `/list/${PUBKEY}/cool-people`);
  });

  it('renders placeholder swatches when no membersPreview provided and list has 0 members', () => {
    renderCard(EMPTY_MEMBERS_LIST);

    // No member count badge (members.length === 0)
    expect(screen.queryByTestId('member-count-badge')).not.toBeInTheDocument();

    // Should show placeholder tiles
    const placeholders = screen.getAllByTestId('avatar-placeholder');
    expect(placeholders.length).toBeGreaterThan(0);
  });
});
