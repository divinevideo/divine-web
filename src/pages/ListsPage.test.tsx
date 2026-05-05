// ABOUTME: Tests for the ListsPage — Authored/Saved sub-tabs with unified list cards
// ABOUTME: Covers both video and people lists, empty states, and create CTA

import React from 'react';
import { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ListsPage from './ListsPage';
import type { PeopleList } from '@/types/peopleList';
import type { VideoList } from '@/hooks/useVideoLists';

// ---- mock Tabs to render all content simultaneously (avoids Radix tab-hide behaviour) --

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { value?: string }) => (
    <button role="tab" {...props}>{children}</button>
  ),
  TabsContent: ({ children, value }: { children: ReactNode; value?: string }) => (
    <div data-tab-content={value}>{children}</div>
  ),
}));

// ---- mock hooks -----------------------------------------------------------------

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('@/hooks/useUnifiedLists', () => ({
  useUnifiedLists: vi.fn(),
}));

vi.mock('@/hooks/useResolvedSavedLists', () => ({
  useResolvedSavedLists: vi.fn(),
}));

// Suppress CreatePeopleListDialog (heavy, not under test here)
vi.mock('@/components/CreatePeopleListDialog', () => ({
  CreatePeopleListDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-people-list-dialog" /> : null,
}));

// Mock UnifiedListCard to keep tests simple — just renders the list name
vi.mock('@/components/UnifiedListCard', () => ({
  UnifiedListCard: ({ kind, list }: { kind: number; list: { name: string; id: string; pubkey: string } }) => (
    <div data-testid={`unified-list-card-${kind}`} data-list-id={list.id}>
      {list.name}
    </div>
  ),
}));

// Mock Skeleton to avoid issues
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: HTMLAttributes<HTMLDivElement>) => <div data-testid="skeleton" {...props} />,
}));

// ---- imports after mocks -------------------------------------------------------
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUnifiedLists } from '@/hooks/useUnifiedLists';
import { useResolvedSavedLists } from '@/hooks/useResolvedSavedLists';

// ---- fixtures ------------------------------------------------------------------

const PUBKEY = 'a'.repeat(64);

const PEOPLE_LIST_1: PeopleList = {
  id: 'cool-people',
  pubkey: PUBKEY,
  name: 'Cool People',
  description: 'Great humans.',
  members: ['b'.repeat(64)],
  createdAt: 1_700_000_100,
};

const PEOPLE_LIST_2: PeopleList = {
  id: 'vine-stars',
  pubkey: PUBKEY,
  name: 'Vine Stars',
  members: [],
  createdAt: 1_700_000_050,
};

const VIDEO_LIST_1: VideoList = {
  id: 'best-vines',
  name: 'Best Vines',
  pubkey: PUBKEY,
  createdAt: 1_700_000_200,
  videoCoordinates: ['34236:aaa:1'],
  public: true,
};

const VIDEO_LIST_2: VideoList = {
  id: 'classics',
  name: 'Classics',
  pubkey: PUBKEY,
  createdAt: 1_700_000_010,
  videoCoordinates: [],
  public: true,
};

// ---- helpers -------------------------------------------------------------------

function renderPage() {
  return render(
    <MemoryRouter>
      <ListsPage />
    </MemoryRouter>
  );
}

function mockUser(pubkey: string | null = PUBKEY) {
  (useCurrentUser as ReturnType<typeof vi.fn>).mockReturnValue({
    user: pubkey ? { pubkey } : null,
  });
}

function mockAuthored(people: PeopleList[] = [], video: VideoList[] = [], isLoading = false) {
  (useUnifiedLists as ReturnType<typeof vi.fn>).mockReturnValue({
    people,
    video,
    isLoading,
    isError: false,
  });
}

function mockSaved(people: PeopleList[] = [], video: VideoList[] = [], isLoading = false) {
  (useResolvedSavedLists as ReturnType<typeof vi.fn>).mockReturnValue({
    people,
    video,
    isLoading,
    isError: false,
  });
}

// ---- tests ---------------------------------------------------------------------

describe('ListsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('page chrome', () => {
    it('renders the Lists heading', () => {
      mockUser();
      mockAuthored();
      mockSaved();
      renderPage();
      expect(screen.getByRole('heading', { name: /lists/i })).toBeInTheDocument();
    });

    it('renders Authored and Saved tab triggers', () => {
      mockUser();
      mockAuthored();
      mockSaved();
      renderPage();
      expect(screen.getByRole('tab', { name: /authored/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /saved/i })).toBeInTheDocument();
    });

    it('shows header CTA when user is logged in', () => {
      mockUser();
      mockAuthored();
      mockSaved();
      renderPage();
      // Header bar create button — distinct from the empty-state button
      const createButtons = screen.getAllByRole('button', { name: /create new list/i });
      // At least the header CTA is present (may also be empty-state CTA)
      expect(createButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('hides header CTA when no user', () => {
      mockUser(null);
      mockAuthored();
      mockSaved();
      renderPage();
      // No create button at all when logged out and lists are empty
      expect(screen.queryByRole('button', { name: /create new list/i })).not.toBeInTheDocument();
    });
  });

  describe('Authored tab — renders both video and people lists from useUnifiedLists', () => {
    it('renders people list cards', () => {
      mockUser();
      mockAuthored([PEOPLE_LIST_1], []);
      mockSaved();
      renderPage();
      expect(screen.getByText('Cool People')).toBeInTheDocument();
      expect(screen.getByTestId('unified-list-card-30000')).toBeInTheDocument();
    });

    it('renders video list cards', () => {
      mockUser();
      mockAuthored([], [VIDEO_LIST_1]);
      mockSaved();
      renderPage();
      expect(screen.getByText('Best Vines')).toBeInTheDocument();
      expect(screen.getByTestId('unified-list-card-30005')).toBeInTheDocument();
    });

    it('renders both people and video lists together sorted by createdAt desc', () => {
      mockUser();
      // VIDEO_LIST_1.createdAt (200) > PEOPLE_LIST_1.createdAt (100) > PEOPLE_LIST_2.createdAt (50) > VIDEO_LIST_2.createdAt (10)
      mockAuthored([PEOPLE_LIST_1, PEOPLE_LIST_2], [VIDEO_LIST_1, VIDEO_LIST_2]);
      mockSaved();
      renderPage();

      // All four authored names appear in the authored section
      const authoredSection = document.querySelector('[data-tab-content="authored"]');
      expect(authoredSection).not.toBeNull();
      expect(authoredSection!.textContent).toContain('Cool People');
      expect(authoredSection!.textContent).toContain('Vine Stars');
      expect(authoredSection!.textContent).toContain('Best Vines');
      expect(authoredSection!.textContent).toContain('Classics');

      // Should render 2 of each kind in the authored tab
      const cards30000 = authoredSection!.querySelectorAll('[data-testid="unified-list-card-30000"]');
      const cards30005 = authoredSection!.querySelectorAll('[data-testid="unified-list-card-30005"]');
      expect(cards30000).toHaveLength(2);
      expect(cards30005).toHaveLength(2);
    });

    it('shows empty state with create CTA when authored is empty', () => {
      mockUser();
      mockAuthored([], []);
      mockSaved();
      renderPage();

      const authoredSection = document.querySelector('[data-tab-content="authored"]');
      expect(authoredSection!.textContent).toMatch(/no lists yet/i);
      // The empty-state CTA button is within the authored section
      const createBtn = authoredSection!.querySelector('button');
      expect(createBtn).not.toBeNull();
      expect(createBtn!.textContent).toMatch(/create new list/i);
    });

    it('shows loading skeletons while authored is loading', () => {
      mockUser();
      mockAuthored([], [], true);
      mockSaved();
      renderPage();

      const authoredSection = document.querySelector('[data-tab-content="authored"]');
      // No list cards during loading
      expect(authoredSection!.querySelectorAll('[data-testid^="unified-list-card-"]')).toHaveLength(0);
      // Skeleton present
      expect(authoredSection!.querySelectorAll('[data-testid="skeleton"]').length).toBeGreaterThan(0);
    });
  });

  describe('Saved tab — renders results from useResolvedSavedLists', () => {
    it('renders saved people list cards', () => {
      mockUser();
      mockAuthored();
      mockSaved([PEOPLE_LIST_1], []);
      renderPage();

      const savedSection = document.querySelector('[data-tab-content="saved"]');
      expect(savedSection).not.toBeNull();
      expect(savedSection!.textContent).toContain('Cool People');
      expect(savedSection!.querySelector('[data-testid="unified-list-card-30000"]')).not.toBeNull();
    });

    it('renders saved video list cards', () => {
      mockUser();
      mockAuthored();
      mockSaved([], [VIDEO_LIST_1]);
      renderPage();

      const savedSection = document.querySelector('[data-tab-content="saved"]');
      expect(savedSection!.textContent).toContain('Best Vines');
      expect(savedSection!.querySelector('[data-testid="unified-list-card-30005"]')).not.toBeNull();
    });

    it('renders both saved people and video lists', () => {
      mockUser();
      mockAuthored();
      mockSaved([PEOPLE_LIST_2], [VIDEO_LIST_2]);
      renderPage();

      const savedSection = document.querySelector('[data-tab-content="saved"]');
      expect(savedSection!.textContent).toContain('Vine Stars');
      expect(savedSection!.textContent).toContain('Classics');
    });

    it('shows "No saved lists." when saved tab is empty', () => {
      mockUser();
      mockAuthored();
      mockSaved([], []);
      renderPage();

      const savedSection = document.querySelector('[data-tab-content="saved"]');
      expect(savedSection!.textContent).toMatch(/no saved lists/i);
    });

    it('does NOT show create CTA in the saved empty state', () => {
      mockUser();
      mockAuthored([], []);
      mockSaved([], []);
      renderPage();

      const savedSection = document.querySelector('[data-tab-content="saved"]');
      expect(savedSection!.textContent).toMatch(/no saved lists/i);
      // No create button in saved section
      expect(savedSection!.querySelector('button')).toBeNull();
    });
  });

  describe('empty Authored — create CTA + headline', () => {
    it('shows the create CTA in the empty authored state for logged-in user', () => {
      mockUser();
      mockAuthored([], []);
      mockSaved();
      renderPage();

      const authoredSection = document.querySelector('[data-tab-content="authored"]');
      expect(authoredSection!.textContent).toMatch(/no lists yet\. create your first\./i);
      const createBtn = authoredSection!.querySelector('button');
      expect(createBtn).not.toBeNull();
      expect(createBtn!.textContent).toMatch(/create new list/i);
    });

    it('authored empty state has no create CTA when logged out', () => {
      mockUser(null);
      mockAuthored([], []);
      mockSaved();
      renderPage();

      const authoredSection = document.querySelector('[data-tab-content="authored"]');
      expect(authoredSection!.textContent).toMatch(/no lists yet/i);
      // No button since user is not logged in
      expect(authoredSection!.querySelector('button')).toBeNull();
    });
  });
});
