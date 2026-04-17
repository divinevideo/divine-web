import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoginDialog from './LoginDialog';

const {
  mockBuildLoginRedirect,
  mockBuildSignupRedirect,
  mockGetInviteClientConfig,
  mockGetStoredLocalNsecLogin,
  mockJoinInviteWaitlist,
  mockLoginActions,
  mockSetInviteHandoff,
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
