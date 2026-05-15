import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { initializeI18n } from '@/lib/i18n';
import { BottomNav } from './BottomNav';

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useUnreadNotificationCount: () => ({ data: 0 }),
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

async function renderBottomNav(initialEntry = '/') {
  await initializeI18n({ force: true, languages: ['en-US'] });
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <BottomNav />
      <LocationDisplay />
    </MemoryRouter>
  );
}

describe('BottomNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('links mobile users to the popular page', async () => {
    const user = userEvent.setup();
    await renderBottomNav('/');

    await user.click(screen.getByRole('button', { name: 'Popular' }));

    expect(screen.getByTestId('location-display')).toHaveTextContent('/popular');
  });
});
