import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ListsPage from './ListsPage';

const mockUseCurrentUser = vi.fn();
const mockUseVideoLists = vi.fn();
const mockUseTrendingVideoLists = vi.fn();
const mockUseFollowedUsersLists = vi.fn();
const mockUseFollowList = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'listsPage.createList': 'Create List',
        'listsPage.createFirstList': 'Create Your First List',
        'listsPage.createVideoList': 'Video list',
        'listsPage.createPeopleList': 'People list',
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock('@/hooks/useVideoLists', () => ({
  useVideoLists: () => mockUseVideoLists(),
  useTrendingVideoLists: () => mockUseTrendingVideoLists(),
  useFollowedUsersLists: () => mockUseFollowedUsersLists(),
}));

vi.mock('@/hooks/useFollowList', () => ({
  useFollowList: () => mockUseFollowList(),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: { metadata: { name: 'Liz' } },
  }),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/CreateListDialog', () => ({
  CreateListDialog: ({ open }: { open: boolean }) => (
    open ? <div role="dialog" aria-label="Create video list" /> : null
  ),
}));

vi.mock('@/components/CreatePeopleListDialog', () => ({
  CreatePeopleListDialog: ({ open }: { open: boolean }) => (
    open ? <div role="dialog" aria-label="Create people list" /> : null
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ListsPage />
    </MemoryRouter>,
  );
}

describe('ListsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentUser.mockReturnValue({ user: { pubkey: 'a'.repeat(64) } });
    mockUseVideoLists.mockReturnValue({ data: [], isLoading: false });
    mockUseTrendingVideoLists.mockReturnValue({ data: [], isLoading: false });
    mockUseFollowedUsersLists.mockReturnValue({ data: [], isLoading: false });
    mockUseFollowList.mockReturnValue({ data: [] });
  });

  it('keeps video-list creation reachable from the create chooser', () => {
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: /Video list/ })[0]);

    expect(screen.getByRole('dialog', { name: 'Create video list' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Create people list' })).not.toBeInTheDocument();
  });

  it('offers people-list creation from the same create chooser', () => {
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: /People list/ })[0]);

    expect(screen.getByRole('dialog', { name: 'Create people list' })).toBeInTheDocument();
  });

  it('keeps the empty-state create chooser wired to video-list creation', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /Create Your First List/ })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Video list/ })[1]);

    expect(screen.getByRole('dialog', { name: 'Create video list' })).toBeInTheDocument();
  });
});
