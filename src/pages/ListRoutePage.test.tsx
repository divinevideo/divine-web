import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildListPath } from '@/lib/eventRouting';
import ListRoutePage, { LegacyPeopleListRedirect } from './ListRoutePage';

const OWNER = 'a'.repeat(64);
const { mockUseListRouteKind } = vi.hoisted(() => ({
  mockUseListRouteKind: vi.fn(),
}));

vi.mock('@/hooks/useListRouteKind', () => ({
  useListRouteKind: (...args: unknown[]) => mockUseListRouteKind(...args),
}));

vi.mock('@/pages/ListDetailPage', () => ({
  default: () => <div data-testid="video-list-page">Video list</div>,
}));

vi.mock('@/pages/PeopleListDetailPage', () => ({
  default: () => <div data-testid="people-list-page">People list</div>,
}));

function renderCanonicalRoute(routeKind: 'videos' | 'people' | 'missing') {
  mockUseListRouteKind.mockReturnValue({
    data: routeKind,
    isLoading: false,
  });

  return render(
    <MemoryRouter initialEntries={[buildListPath(OWNER, 'friends')]}>
      <Routes>
        <Route path="/list/:pubkey/:listId" element={<ListRoutePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ListRoutePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the people-list surface for kind 30000 lists', () => {
    renderCanonicalRoute('people');

    expect(screen.getByTestId('people-list-page')).toBeInTheDocument();
    expect(screen.queryByTestId('video-list-page')).not.toBeInTheDocument();
    expect(mockUseListRouteKind).toHaveBeenCalledWith(OWNER, 'friends');
  });

  it('renders the video-list surface for kind 30005 lists', () => {
    renderCanonicalRoute('videos');

    expect(screen.getByTestId('video-list-page')).toBeInTheDocument();
    expect(screen.queryByTestId('people-list-page')).not.toBeInTheDocument();
  });

  it('falls back to the video-list not-found surface when no list resolves', () => {
    renderCanonicalRoute('missing');

    expect(screen.getByTestId('video-list-page')).toBeInTheDocument();
  });

  it('redirects legacy people-list paths to the canonical list route', async () => {
    render(
      <MemoryRouter initialEntries={[`/people-lists/${OWNER}/friends`]}>
        <Routes>
          <Route path="/people-lists/:pubkey/:listId" element={<LegacyPeopleListRedirect />} />
          <Route path="/list/:pubkey/:listId" element={<div data-testid="canonical-route" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('canonical-route')).toBeInTheDocument();
  });
});
