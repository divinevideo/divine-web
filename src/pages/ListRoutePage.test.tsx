import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PEOPLE_LIST_EVENT_KIND,
  VIDEO_LIST_EVENT_KIND,
  buildListPath,
} from '@/lib/eventRouting';
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

function renderRoute(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/list/:pubkey/:listId" element={<ListRoutePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderUnpinnedRoute(routeKind: 'videos' | 'people' | 'missing') {
  mockUseListRouteKind.mockReturnValue({
    data: routeKind,
    isLoading: false,
  });

  return renderRoute(buildListPath(OWNER, 'friends'));
}

describe('ListRoutePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseListRouteKind.mockReturnValue({ data: undefined, isLoading: false });
  });

  it('renders the people-list surface for kind 30000 lists', () => {
    renderUnpinnedRoute('people');

    expect(screen.getByTestId('people-list-page')).toBeInTheDocument();
    expect(screen.queryByTestId('video-list-page')).not.toBeInTheDocument();
    expect(mockUseListRouteKind).toHaveBeenCalledWith(OWNER, 'friends', { enabled: true });
  });

  it('renders the video-list surface for kind 30005 lists', () => {
    renderUnpinnedRoute('videos');

    expect(screen.getByTestId('video-list-page')).toBeInTheDocument();
    expect(screen.queryByTestId('people-list-page')).not.toBeInTheDocument();
  });

  it('falls back to the video-list not-found surface when no list resolves', () => {
    renderUnpinnedRoute('missing');

    expect(screen.getByTestId('video-list-page')).toBeInTheDocument();
  });

  it('shows a loading state while an unpinned list kind resolves', () => {
    mockUseListRouteKind.mockReturnValue({ data: undefined, isLoading: true });

    renderRoute(buildListPath(OWNER, 'friends'));

    expect(screen.queryByTestId('video-list-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('people-list-page')).not.toBeInTheDocument();
  });

  it('renders a pinned people list without resolving the kind from relays', () => {
    renderRoute(buildListPath(OWNER, 'friends', PEOPLE_LIST_EVENT_KIND));

    expect(screen.getByTestId('people-list-page')).toBeInTheDocument();
    expect(mockUseListRouteKind).toHaveBeenCalledWith(OWNER, 'friends', { enabled: false });
  });

  it('renders a pinned video list without resolving the kind from relays', () => {
    renderRoute(buildListPath(OWNER, 'friends', VIDEO_LIST_EVENT_KIND));

    expect(screen.getByTestId('video-list-page')).toBeInTheDocument();
    expect(mockUseListRouteKind).toHaveBeenCalledWith(OWNER, 'friends', { enabled: false });
  });

  it('ignores an unsupported kind pin and resolves the list kind instead', () => {
    mockUseListRouteKind.mockReturnValue({ data: 'people', isLoading: false });

    renderRoute(`/list/${OWNER}/friends?kind=30001`);

    expect(screen.getByTestId('people-list-page')).toBeInTheDocument();
    expect(mockUseListRouteKind).toHaveBeenCalledWith(OWNER, 'friends', { enabled: true });
  });

  it('redirects legacy people-list paths to the pinned canonical list route', async () => {
    function LocationProbe() {
      const location = useLocation();

      return <div data-testid="canonical-route">{`${location.pathname}${location.search}`}</div>;
    }

    render(
      <MemoryRouter initialEntries={[`/people-lists/${OWNER}/friends`]}>
        <Routes>
          <Route path="/people-lists/:pubkey/:listId" element={<LegacyPeopleListRedirect />} />
          <Route path="/list/:pubkey/:listId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('canonical-route')).toHaveTextContent(
      buildListPath(OWNER, 'friends', PEOPLE_LIST_EVENT_KIND),
    );
  });
});
