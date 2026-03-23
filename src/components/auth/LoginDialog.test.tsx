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
    mockBuildSignupRedirect.mockReturnValue({
      state: 'signup-state',
      url: 'https://login.divine.video/oauth/start?mode=signup',
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

  it('renders the invite-first auth surface before advanced login methods', async () => {
    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await screen.findByRole('button', { name: /Continue with invite code/i });

    expect(screen.getByRole('button', { name: /Join the waitlist/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Login with Extension/i })).not.toBeInTheDocument();
  });

  it('shows field-level feedback for invalid invite codes', async () => {
    const user = userEvent.setup();
    mockValidateInviteCode.mockRejectedValue(new Error('Invite not found'));

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await user.type(await screen.findByLabelText(/Invite code/i), 'bad-code');
    await user.click(screen.getByRole('button', { name: /Continue with invite code/i }));

    await screen.findByText(/Invite not found/i);
  });

  it('keeps advanced Nostr methods behind a secondary disclosure', async () => {
    const user = userEvent.setup();

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: /Advanced login methods/i }));

    expect(await screen.findByRole('button', { name: /Login with Extension/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Bunker/i }));

    expect(await screen.findByRole('button', { name: /Login with Bunker/i })).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: /Continue with invite code/i }));

    await waitFor(() => {
      expect(mockSetInviteHandoff).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ABCD-EFGH',
          mode: 'signup',
        }),
      );
      expect(locationAssign).toHaveBeenCalledWith('https://login.divine.video/oauth/start?mode=signup');
    });
  });
});
