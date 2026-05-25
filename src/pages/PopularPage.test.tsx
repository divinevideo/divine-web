import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { initializeI18n } from '@/lib/i18n';
import PopularPage from './PopularPage';

const mockVideoFeed = vi.fn();

vi.mock('@/components/VideoFeed', () => ({
  VideoFeed: (props: unknown) => {
    mockVideoFeed(props);
    return <div data-testid="popular-feed" />;
  },
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}{location.search}</div>;
}

async function renderPage(initialEntry = '/popular') {
  await initializeI18n({ force: true, languages: ['en-US'] });
  mockVideoFeed.mockClear();
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PopularPage />
      <LocationDisplay />
    </MemoryRouter>
  );
}

describe('PopularPage', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });
  });

  it('defaults to New and Now with canonical empty query params', async () => {
    await renderPage('/popular');

    expect(screen.getByRole('heading', { name: 'Popular' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Now' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('location-display')).toHaveTextContent('/popular');
    expect(mockVideoFeed).toHaveBeenCalledWith(expect.objectContaining({
      feedType: 'popular',
      popularSource: 'new',
      popularPeriod: 'now',
    }));
  });

  it('updates URL params when selecting Classic and Week', async () => {
    const user = userEvent.setup();
    await renderPage('/popular');

    await user.click(screen.getByRole('button', { name: 'Classic' }));
    await user.click(screen.getByRole('button', { name: 'Week' }));

    expect(screen.getByRole('button', { name: 'Classic' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('location-display')).toHaveTextContent('/popular?source=classic&period=week');
    expect(mockVideoFeed).toHaveBeenLastCalledWith(expect.objectContaining({
      feedType: 'popular',
      popularSource: 'classic',
      popularPeriod: 'week',
    }));
  });

  it('normalizes invalid params to defaults', async () => {
    await renderPage('/popular?source=bad&period=ancient');

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/popular');
    });
    expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Now' })).toHaveAttribute('aria-pressed', 'true');
  });
});
