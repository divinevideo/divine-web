import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TrendingPage from './TrendingPage';

vi.mock('@/components/VideoFeed', () => ({
  VideoFeed: (props: { sortMode?: string; period?: string }) => (
    <div data-testid="video-feed" data-sort={props.sortMode ?? ''} data-period={props.period ?? ''} />
  ),
}));

vi.mock('@/hooks/useRssFeedAvailable', () => ({ useRssFeedAvailable: () => false }));
vi.mock('@unhead/react', () => ({ useHead: () => undefined }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderAt(initial: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route
            path="/trending"
            element={<>
              <TrendingPage />
              <LocationProbe />
            </>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TrendingPage URL state', () => {
  it('defaults to sort=hot and renders no period row when no params', () => {
    renderAt('/trending');
    const feed = screen.getByTestId('video-feed');
    expect(feed.dataset.sort).toBe('hot');
    expect(screen.queryByTestId('period-row')).not.toBeInTheDocument();
  });

  it('shows the period row when sort=popular and defaults period to today', () => {
    renderAt('/trending?sort=popular');
    const feed = screen.getByTestId('video-feed');
    expect(feed.dataset.sort).toBe('popular');
    expect(feed.dataset.period).toBe('today');
    expect(screen.getByTestId('period-row')).toBeInTheDocument();
    expect(screen.getByTestId('period-pill-week')).toBeInTheDocument();
  });

  it('respects ?sort=popular&period=week', () => {
    renderAt('/trending?sort=popular&period=week');
    expect(screen.getByTestId('video-feed').dataset.period).toBe('week');
    expect(screen.getByTestId('period-pill-week')).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders ?sort=controversial as the Hot tab (no API call uses controversial) and hides the period row', () => {
    renderAt('/trending?sort=controversial');
    expect(screen.getByTestId('video-feed').dataset.sort).toBe('hot');
    expect(screen.queryByTestId('period-row')).not.toBeInTheDocument();
  });

  it('encodes the New tab as ?sort=new (round-trip stable)', () => {
    renderAt('/trending?sort=new');
    expect(screen.getByTestId('video-feed').dataset.sort).toBe('');
    expect(screen.queryByTestId('period-row')).not.toBeInTheDocument();
  });

  it('updates the URL and feed when a period pill is clicked', async () => {
    const user = userEvent.setup();
    renderAt('/trending?sort=popular');
    await user.click(screen.getByTestId('period-pill-month'));
    await waitFor(() => {
      expect(screen.getByTestId('video-feed').dataset.period).toBe('month');
    });
    expect(screen.getByTestId('location-search').textContent).toContain('period=month');
    expect(screen.getByTestId('location-search').textContent).toContain('sort=popular');
  });

  it('drops period from the URL when switching from Popular to Hot', async () => {
    const user = userEvent.setup();
    renderAt('/trending?sort=popular&period=week');
    await user.click(screen.getByRole('tab', { name: /^Hot/i }));
    await waitFor(() => {
      expect(screen.getByTestId('video-feed').dataset.sort).toBe('hot');
    });
    expect(screen.getByTestId('location-search').textContent).not.toContain('period=');
  });
});
