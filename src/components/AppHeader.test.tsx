import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { initializeI18n } from '@/lib/i18n';
import { AppHeader } from './AppHeader';

const { mockNavigate, mockSetTheme } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSetTheme: vi.fn(),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useUnreadNotificationCount: () => ({ data: 0 }),
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({ canUseDirectMessages: false }),
  useUnreadDmCount: () => ({ data: 0 }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ displayTheme: 'light', setTheme: mockSetTheme }),
}));

vi.mock('@/hooks/useSubdomainUser', () => ({
  getSubdomainUser: () => null,
}));

vi.mock('@/components/auth/LoginArea', () => ({
  LoginArea: () => <div data-testid="login-area" />,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div role="menu">{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" role="menuitem" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

describe('AppHeader', () => {
  let moreOptionsLabel: string;
  let merchLabel: string;

  beforeEach(async () => {
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

    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'es');

    const i18n = await initializeI18n({ force: true, languages: ['en-US'] });
    moreOptionsLabel = i18n.t('common.moreOptions');
    merchLabel = i18n.t('menu.merch');

    mockNavigate.mockReset();
    mockSetTheme.mockReset();
  });

  it('renders translated shell labels and a translated DMCA action in the more menu', () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );

    expect(screen.getByText('Buscar')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: moreOptionsLabel }));

    const dmcaItem = screen.getByRole('menuitem', { name: 'DMCA y derechos de autor' });
    expect(dmcaItem).toBeVisible();

    fireEvent.click(dmcaItem);

    expect(mockNavigate).toHaveBeenCalledWith('/dmca');
  });

  it('opens the merch store from the more menu', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    try {
      render(
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByRole('button', { name: moreOptionsLabel }));
      fireEvent.click(screen.getByRole('menuitem', { name: merchLabel }));

      expect(openSpy).toHaveBeenCalledWith('https://www.bonfire.com/store/divine-18/', '_blank');
    } finally {
      openSpy.mockRestore();
    }
  });
});
