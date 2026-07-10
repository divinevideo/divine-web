import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeI18n } from '@/lib/i18n';
import {
  NOT_PROTECTED,
  UNKNOWN_PROTECTED_MINOR_STATUS,
  type ProtectedMinorStatus,
} from '@/lib/protectedMinor';
import LoginDialog from './LoginDialog';

const PROTECTED_STATUS: ProtectedMinorStatus = Object.freeze({
  state: 'protected',
  isKnown: true,
  verifiedMinorAt: null,
});

const {
  mockBuildLoginRedirect,
  mockBuildSignupRedirect,
  mockGetInviteClientConfig,
  mockGetStoredLocalNsecLogin,
  mockJoinInviteWaitlist,
  mockLoginActions,
  mockSetInviteHandoff,
  mockUseProtectedMinorStatus,
  mockValidateInviteCode,
} = vi.hoisted(() => ({
  mockBuildLoginRedirect: vi.fn(),
  mockBuildSignupRedirect: vi.fn(),
  mockGetInviteClientConfig: vi.fn(),
  mockGetStoredLocalNsecLogin: vi.fn(),
  mockJoinInviteWaitlist: vi.fn(),
  mockLoginActions: {
    bunker: vi.fn(),
    extension: vi.fn(),
    nsec: vi.fn(),
  },
  mockSetInviteHandoff: vi.fn(),
  mockUseProtectedMinorStatus: vi.fn(),
  mockValidateInviteCode: vi.fn(),
}));

const originalLocation = window.location;
const locationAssign = vi.fn();

vi.mock('@/lib/inviteApi', () => ({
  getInviteClientConfig: mockGetInviteClientConfig,
  joinInviteWaitlist: mockJoinInviteWaitlist,
  validateInviteCode: mockValidateInviteCode,
}));

vi.mock('@/lib/authHandoff', () => ({
  setInviteHandoff: mockSetInviteHandoff,
}));

vi.mock('@/lib/divineLogin', async () => {
  const actual = await vi.importActual<typeof import('@/lib/divineLogin')>('@/lib/divineLogin');

  return {
    ...actual,
    buildLoginRedirect: mockBuildLoginRedirect,
    buildSignupRedirect: mockBuildSignupRedirect,
  };
});

vi.mock('@/hooks/useLoginActions', () => ({
  useLoginActions: () => mockLoginActions,
}));

vi.mock('@/hooks/useProtectedMinorStatus', () => ({
  useProtectedMinorStatus: () => mockUseProtectedMinorStatus(),
}));

vi.mock('@/lib/localNsecAccount', async () => {
  const actual = await vi.importActual<typeof import('@/lib/localNsecAccount')>('@/lib/localNsecAccount');

  return {
    ...actual,
    getStoredLocalNsecLogin: mockGetStoredLocalNsecLogin,
  };
});

describe('LoginDialog', () => {
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

    mockGetInviteClientConfig.mockResolvedValue({
      mode: 'invite_code_required',
      waitlistEnabled: true,
    });
    mockGetStoredLocalNsecLogin.mockReturnValue(null);
    mockUseProtectedMinorStatus.mockReturnValue(NOT_PROTECTED);
    mockBuildSignupRedirect.mockResolvedValue({
      state: 'signup-state',
      url: 'https://login.divine.video/api/oauth/authorize?client_id=divine-web',
    });
    mockBuildLoginRedirect.mockResolvedValue({
      state: 'login-state',
      url: 'https://login.divine.video/api/oauth/authorize?client_id=divine-web',
    });

    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, assign: locationAssign, pathname: '/', search: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('renders explicit register and sign-in tabs with register selected by default', async () => {
    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    expect(await screen.findByRole('tab', { name: /^Register$/i })).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('tab', { name: /^Sign in$/i })).toBeInTheDocument();
    expect(screen.getByText(/Got an invite\? Spin up an account\./i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Invite code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Continue$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No invite\? Get on the waitlist/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /I already have an account/i })).not.toBeInTheDocument();
  });

  it('shows field-level feedback for invalid invite codes', async () => {
    const user = userEvent.setup();
    mockValidateInviteCode.mockRejectedValue(new Error('Invite not found'));

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await user.type(await screen.findByLabelText(/Invite code/i), 'bad-code');
    await user.click(screen.getByRole('button', { name: /^Continue$/i }));

    await screen.findByText(/Invite not found/i);
  });

  it('renders hosted sign-in and keeps Nostr methods behind a text disclosure', async () => {
    const user = userEvent.setup();

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));

    expect(await screen.findByText(/Sign in at login\.divine\.video with your existing account\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sign in at login\.divine\.video$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use Nostr instead/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Login with Extension/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Use Nostr instead/i }));

    expect(await screen.findByRole('button', { name: /Login with Extension/i })).toBeInTheDocument();
  });

  it('redirects existing-account users from the sign-in tab without validating an invite code', async () => {
    const user = userEvent.setup();

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));
    await user.click(screen.getByRole('button', { name: /^Sign in at login\.divine\.video$/i }));

    await waitFor(() => {
      expect(mockBuildLoginRedirect).toHaveBeenCalledWith({ returnPath: '/' });
      expect(mockValidateInviteCode).not.toHaveBeenCalled();
      expect(locationAssign).toHaveBeenCalledWith('https://login.divine.video/api/oauth/authorize?client_id=divine-web');
    });
  });

  it('shows the local nsec banner when a browser-local key already exists', async () => {
    mockGetStoredLocalNsecLogin.mockReturnValue({
      type: 'nsec',
      data: {
        nsec: 'nsec1example',
      },
    });

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /Secure with divine.video login/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back up nsec/i })).toBeInTheDocument();
  });

  describe('key-handover gating for protected minors (#182)', () => {
    it('hides the local nsec banner for a protected minor even when a browser-local key exists', async () => {
      mockUseProtectedMinorStatus.mockReturnValue(PROTECTED_STATUS);
      mockGetStoredLocalNsecLogin.mockReturnValue({
        type: 'nsec',
        data: { nsec: 'nsec1example' },
      });

      render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

      expect(await screen.findByRole('tab', { name: /^Register$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Back up nsec/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Secure with divine.video login/i })).not.toBeInTheDocument();
    });

    it('hides the Nostr key-import disclosure on the sign-in tab for a protected minor', async () => {
      const user = userEvent.setup();
      mockUseProtectedMinorStatus.mockReturnValue(PROTECTED_STATUS);

      render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

      await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));

      expect(await screen.findByRole('button', { name: /^Sign in at login\.divine\.video$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Use Nostr instead/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Login with Extension/i })).not.toBeInTheDocument();
    });

    it('does not reopen the Nostr disclosure unprompted after a restriction interlude', async () => {
      const user = userEvent.setup();

      const { rerender } = render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

      await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));
      await user.click(screen.getByRole('button', { name: /Use Nostr instead/i }));
      expect(await screen.findByRole('button', { name: /Login with Extension/i })).toBeInTheDocument();

      mockUseProtectedMinorStatus.mockReturnValue(PROTECTED_STATUS);
      rerender(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /Login with Extension/i })).not.toBeInTheDocument();

      mockUseProtectedMinorStatus.mockReturnValue(NOT_PROTECTED);
      rerender(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

      expect(await screen.findByRole('button', { name: /Use Nostr instead/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Login with Extension/i })).not.toBeInTheDocument();
    });

    it('logs in with a pasted nsec when positively not protected (positive control)', async () => {
      const user = userEvent.setup();

      render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

      await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));
      await user.click(screen.getByRole('button', { name: /Use Nostr instead/i }));
      await user.click(await screen.findByRole('tab', { name: /^Key$/i }));
      fireEvent.change(screen.getByLabelText(/Secret key/i), {
        target: { value: 'nsec1czx9vnnpgx8dlf72xct3ntry2l2suss2kv4ll496geja4qjmwn9sh3qlyn' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^Log In$/i }));

      await waitFor(() => {
        expect(mockLoginActions.nsec).toHaveBeenCalledWith('nsec1czx9vnnpgx8dlf72xct3ntry2l2suss2kv4ll496geja4qjmwn9sh3qlyn');
      });
    });

    it('blocks a pending nsec import when the restriction engages before the deferred login runs', async () => {
      const user = userEvent.setup();

      const { rerender } = render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

      await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));
      await user.click(screen.getByRole('button', { name: /Use Nostr instead/i }));
      await user.click(await screen.findByRole('tab', { name: /^Key$/i }));
      fireEvent.change(screen.getByLabelText(/Secret key/i), {
        target: { value: 'nsec1czx9vnnpgx8dlf72xct3ntry2l2suss2kv4ll496geja4qjmwn9sh3qlyn' },
      });

      // Schedule the deferred login (50ms window), then flip the status to
      // protected before the timer fires - the shape of the mobile #5991
      // finding: a live check resolving mid-interaction must beat a pending
      // continuation to the raw-key handover.
      vi.useFakeTimers();
      try {
        fireEvent.click(screen.getByRole('button', { name: /^Log In$/i }));

        mockUseProtectedMinorStatus.mockReturnValue(PROTECTED_STATUS);
        rerender(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

        act(() => {
          vi.advanceTimersByTime(100);
        });
      } finally {
        vi.useRealTimers();
      }

      expect(mockLoginActions.nsec).not.toHaveBeenCalled();
    });

    it('fails closed: hides the banner and the Nostr disclosure while the status is unknown', async () => {
      const user = userEvent.setup();
      mockUseProtectedMinorStatus.mockReturnValue(UNKNOWN_PROTECTED_MINOR_STATUS);
      mockGetStoredLocalNsecLogin.mockReturnValue({
        type: 'nsec',
        data: { nsec: 'nsec1example' },
      });

      render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

      expect(await screen.findByRole('tab', { name: /^Register$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Back up nsec/i })).not.toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: /^Sign in$/i }));

      expect(await screen.findByRole('button', { name: /^Sign in at login\.divine\.video$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Use Nostr instead/i })).not.toBeInTheDocument();
    });
  });

  it('validates an invite, stores the handoff, and redirects to login.divine.video', async () => {
    const user = userEvent.setup();
    mockValidateInviteCode.mockResolvedValue({
      valid: true,
      normalizedCode: 'ABCD-EFGH',
    });

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await user.type(await screen.findByLabelText(/Invite code/i), 'abcd-efgh');
    await user.click(screen.getByRole('button', { name: /^Continue$/i }));

    await waitFor(() => {
      expect(mockSetInviteHandoff).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ABCD-EFGH',
          mode: 'signup',
        }),
      );
      expect(locationAssign).toHaveBeenCalledWith('https://login.divine.video/api/oauth/authorize?client_id=divine-web');
    });
  });

  it('keeps hosted sign-in available when the invite service config fails', async () => {
    const user = userEvent.setup();
    mockGetInviteClientConfig.mockRejectedValue(new Error('Invite service unavailable'));

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await screen.findByText(/Invite service unavailable/i);
    expect(screen.getByText(/Invite sign-up is unavailable right now/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Sign in$/i }));
    await user.click(await screen.findByRole('button', { name: /^Sign in at login\.divine\.video$/i }));

    await waitFor(() => {
      expect(mockBuildLoginRedirect).toHaveBeenCalledWith({ returnPath: '/' });
      expect(locationAssign).toHaveBeenCalledWith('https://login.divine.video/api/oauth/authorize?client_id=divine-web');
    });
  });
});
