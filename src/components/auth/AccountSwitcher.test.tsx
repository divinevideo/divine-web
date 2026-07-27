import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeI18n } from '@/lib/i18n';

const {
  mockClearJwtCookie,
  mockClearLoginCookie,
  mockClearSession,
  mockNavigate,
  mockRemoveLogin,
  mockRelaySelector,
  mockSetLogin,
  mockUseLoggedInAccounts,
  mockUseNostrLogin,
  mockUseProtectedMinorStatus,
} = vi.hoisted(() => ({
  mockClearJwtCookie: vi.fn(),
  mockClearLoginCookie: vi.fn(),
  mockClearSession: vi.fn(),
  mockNavigate: vi.fn(),
  mockRemoveLogin: vi.fn(),
  mockRelaySelector: vi.fn(),
  mockSetLogin: vi.fn(),
  mockUseLoggedInAccounts: vi.fn(),
  mockUseNostrLogin: vi.fn(),
  mockUseProtectedMinorStatus: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@nostrify/react/login', () => ({
  useNostrLogin: () => mockUseNostrLogin(),
}));

vi.mock('@/hooks/useProtectedMinorStatus', () => ({
  useProtectedMinorStatus: () => mockUseProtectedMinorStatus(),
}));

vi.mock('@/hooks/useLoggedInAccounts', () => ({
  useLoggedInAccounts: () => mockUseLoggedInAccounts(),
}));

vi.mock('@/hooks/useDivineSession', () => ({
  useDivineSession: () => ({
    clearSession: mockClearSession,
  }),
}));

vi.mock('@/lib/crossSubdomainAuth', () => ({
  clearLoginCookie: mockClearLoginCookie,
  clearJwtCookie: mockClearJwtCookie,
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
  RelaySelector: (props: { className?: string; contentClassName?: string }) => {
    mockRelaySelector(props);
    return <div>Relay Selector</div>;
  },
}));

vi.mock('./LocalNsecBanner', () => ({
  LocalNsecBanner: () => <div data-testid="local-nsec-banner" />,
}));

import { AccountSwitcher } from './AccountSwitcher';
import { OVERLAY_LAYERS } from '@/lib/overlayLayers';
import {
  NOT_PROTECTED,
  type ProtectedMinorStatus,
} from '@/lib/protectedMinor';

const PROTECTED_STATUS: ProtectedMinorStatus = Object.freeze({
  state: 'protected',
  isKnown: true,
  verifiedMinorAt: null,
});

const LOCAL_NSEC_LOGIN = {
  id: 'nsec-login',
  type: 'nsec',
  data: { nsec: 'nsec1localsecret' },
};

describe('AccountSwitcher', () => {
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
    await initializeI18n({ force: true, languages: ['en-US'] });

    mockClearJwtCookie.mockClear();
    mockClearLoginCookie.mockClear();
    mockClearSession.mockClear();
    mockNavigate.mockClear();
    mockRemoveLogin.mockClear();
    mockRelaySelector.mockClear();
    mockSetLogin.mockClear();
    mockUseNostrLogin.mockReset();
    mockUseNostrLogin.mockReturnValue({ logins: [] });
    mockUseProtectedMinorStatus.mockReset();
    mockUseProtectedMinorStatus.mockReturnValue(NOT_PROTECTED);
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
    expect(mockClearJwtCookie).toHaveBeenCalled();
    expect(mockClearLoginCookie).toHaveBeenCalled();
    expect(mockRemoveLogin).not.toHaveBeenCalled();
  });

  it('keeps the relay selector layer override scoped to account menu usage', () => {
    render(<AccountSwitcher onAddAccountClick={vi.fn()} />);

    expect(mockRelaySelector).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'w-full',
        contentClassName: OVERLAY_LAYERS.nestedOverlayFloating,
      }),
    );
  });

  describe('nsec backup banner mounting (#182)', () => {
    beforeEach(() => {
      mockUseNostrLogin.mockReturnValue({ logins: [LOCAL_NSEC_LOGIN] });
    });

    it('renders the backup banner whenever a local nsec login exists', () => {
      render(<AccountSwitcher onAddAccountClick={vi.fn()} />);

      expect(screen.getByTestId('local-nsec-banner')).toBeInTheDocument();
    });

    // The banner gates itself for protected minors (LocalNsecBanner.test.tsx;
    // real-parent flip coverage in LoginDialog.test.tsx). This parent must NOT
    // gate it: unmounting on a restricted flip would freeze the banner's
    // command-boundary re-checks at their pre-flip verdict (dcadenas review on
    // #476), so the banner stays mounted here even while restricted.
    it('keeps the banner mounted while restricted so its own gate stays live', () => {
      mockUseProtectedMinorStatus.mockReturnValue(PROTECTED_STATUS);

      render(<AccountSwitcher onAddAccountClick={vi.fn()} />);

      expect(screen.getByTestId('local-nsec-banner')).toBeInTheDocument();
    });

    it('renders no banner without a local nsec login', () => {
      mockUseNostrLogin.mockReturnValue({ logins: [] });

      render(<AccountSwitcher onAddAccountClick={vi.fn()} />);

      expect(screen.queryByTestId('local-nsec-banner')).not.toBeInTheDocument();
    });
  });
});
