import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoginDialog from './LoginDialog';

const {
  mockBuildSignupRedirect,
  mockGetInviteClientConfig,
  mockGetStoredLocalNsecLogin,
  mockJoinInviteWaitlist,
  mockLoginActions,
  mockLoginUser,
  mockSaveSession,
  mockSetInviteHandoff,
  mockValidateInviteCode,
} = vi.hoisted(() => ({
  mockBuildSignupRedirect: vi.fn(),
  mockGetInviteClientConfig: vi.fn(),
  mockGetStoredLocalNsecLogin: vi.fn(),
  mockJoinInviteWaitlist: vi.fn(),
  mockLoginActions: {
    bunker: vi.fn(),
    extension: vi.fn(),
    nsec: vi.fn(),
  },
  mockLoginUser: vi.fn(),
  mockSaveSession: vi.fn(),
  mockSetInviteHandoff: vi.fn(),
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
    buildSignupRedirect: mockBuildSignupRedirect,
  };
});

vi.mock('@/hooks/useLoginActions', () => ({
  useLoginActions: () => mockLoginActions,
}));

vi.mock('@/hooks/useKeycastSession', () => ({
  useKeycastSession: () => ({
    saveSession: mockSaveSession,
  }),
}));

vi.mock('@/lib/keycast', async () => {
  const actual = await vi.importActual<typeof import('@/lib/keycast')>('@/lib/keycast');

  return {
    ...actual,
    loginUser: mockLoginUser,
  };
});

vi.mock('@/lib/localNsecAccount', async () => {
  const actual = await vi.importActual<typeof import('@/lib/localNsecAccount')>('@/lib/localNsecAccount');

  return {
    ...actual,
    getStoredLocalNsecLogin: mockGetStoredLocalNsecLogin,
  };
});

describe('LoginDialog', () => {
  beforeEach(() => {
    mockGetInviteClientConfig.mockResolvedValue({
      mode: 'invite_code_required',
      waitlistEnabled: true,
    });
    mockGetStoredLocalNsecLogin.mockReturnValue(null);
    mockBuildSignupRedirect.mockResolvedValue({
      state: 'signup-state',
      url: 'https://login.divine.video/api/oauth/authorize?client_id=divine-web',
    });
    mockLoginUser.mockResolvedValue({
      token: 'jwt-token',
      pubkey: 'pubkey-123',
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
    expect(screen.getByText(/Use an invite to create your account\./i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Invite code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Continue$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No invite\? Join the waitlist/i })).toBeInTheDocument();
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

  it('shows inline password sign-in and keeps Nostr methods behind a text disclosure', async () => {
    const user = userEvent.setup();

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));

    expect(await screen.findByText(/Sign in with your username and password\./i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use Nostr instead/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Login with Extension/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Use Nostr instead/i }));

    expect(await screen.findByRole('button', { name: /Login with Extension/i })).toBeInTheDocument();
  });

  it('signs in directly from the sign-in tab without invite validation', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onLogin = vi.fn();

    render(<LoginDialog isOpen onClose={onClose} onLogin={onLogin} />);

    await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));
    await user.type(await screen.findByLabelText(/Username or email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^Password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /^Sign in$/i }));

    await waitFor(() => {
      expect(mockLoginUser).toHaveBeenCalledWith('alice@example.com', 'password123');
      expect(mockSaveSession).toHaveBeenCalledWith('jwt-token', 'alice@example.com', false);
      expect(mockValidateInviteCode).not.toHaveBeenCalled();
      expect(onLogin).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('shows sign-in failures inline', async () => {
    const user = userEvent.setup();
    mockLoginUser.mockRejectedValue(new Error('Invalid username or password'));

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));
    await user.type(await screen.findByLabelText(/Username or email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^Password$/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /^Sign in$/i }));

    await screen.findByText(/Invalid username or password/i);
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

  it('keeps inline sign-in available when the invite service config fails', async () => {
    const user = userEvent.setup();
    mockGetInviteClientConfig.mockRejectedValue(new Error('Invite service unavailable'));

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await screen.findByText(/Invite service unavailable/i);
    expect(screen.getByText(/Invite sign-up is unavailable right now/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Sign in$/i }));

    expect(await screen.findByLabelText(/Username or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Continue$/i })).not.toBeInTheDocument();
  });
});
