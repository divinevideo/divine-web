import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSetTheme.mockReset();
  });

  it('renders a Copyright & DMCA legal action in the more menu', () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /more options/i }));

    const dmcaItem = screen.getByRole('menuitem', { name: 'Copyright & DMCA' });
    expect(dmcaItem).toBeVisible();

    fireEvent.click(dmcaItem);

    expect(mockNavigate).toHaveBeenCalledWith('/dmca');
  });
});
