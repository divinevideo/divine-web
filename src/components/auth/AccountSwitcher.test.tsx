import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClearLoginCookie,
  mockClearSession,
  mockNavigate,
  mockRemoveLogin,
  mockSetLogin,
  mockUseLoggedInAccounts,
} = vi.hoisted(() => ({
  mockClearLoginCookie: vi.fn(),
  mockClearSession: vi.fn(),
  mockNavigate: vi.fn(),
  mockRemoveLogin: vi.fn(),
  mockSetLogin: vi.fn(),
  mockUseLoggedInAccounts: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@nostrify/react/login', () => ({
  useNostrLogin: () => ({
    logins: [],
  }),
}));

vi.mock('@/hooks/useLoggedInAccounts', () => ({
  useLoggedInAccounts: () => mockUseLoggedInAccounts(),
}));

vi.mock('@/hooks/useKeycastSession', () => ({
  useKeycastSession: () => ({
    clearSession: mockClearSession,
  }),
}));

vi.mock('@/lib/crossSubdomainAuth', () => ({
  clearLoginCookie: mockClearLoginCookie,
}));

vi.mock('@/components/ui/dropdown-menu.tsx', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: (
    {
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    },
  ) => <button onClick={onClick}>{children}</button>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/avatar.tsx', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: () => null,
}));

vi.mock('@/components/RelaySelector', () => ({
  RelaySelector: () => <div>Relay Selector</div>,
}));

vi.mock('./LocalNsecBanner', () => ({
  LocalNsecBanner: () => null,
}));

import { AccountSwitcher } from './AccountSwitcher';

describe('AccountSwitcher', () => {
  beforeEach(() => {
    mockClearLoginCookie.mockClear();
    mockClearSession.mockClear();
    mockNavigate.mockClear();
    mockRemoveLogin.mockClear();
    mockSetLogin.mockClear();
    mockUseLoggedInAccounts.mockReturnValue({
      currentUser: {
        id: `jwt:${'a'.repeat(64)}`,
        metadata: { name: 'JWT User' },
        pubkey: 'a'.repeat(64),
      },
      otherUsers: [],
      removeLogin: mockRemoveLogin,
      setLogin: mockSetLogin,
    });
  });

  it('clears the JWT-backed web session on logout', async () => {
    const user = userEvent.setup();

    render(<AccountSwitcher onAddAccountClick={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Log out/i }));

    expect(mockClearSession).toHaveBeenCalled();
    expect(mockClearLoginCookie).toHaveBeenCalled();
    expect(mockRemoveLogin).not.toHaveBeenCalled();
  });
});
