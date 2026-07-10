import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalNsecBanner } from './LocalNsecBanner';
import {
  NOT_PROTECTED,
  UNKNOWN_PROTECTED_MINOR_STATUS,
  type ProtectedMinorStatus,
} from '@/lib/protectedMinor';

const { mockBuildSecureAccountRedirect, mockUseProtectedMinorStatus } = vi.hoisted(() => ({
  mockBuildSecureAccountRedirect: vi.fn(),
  mockUseProtectedMinorStatus: vi.fn(),
}));

vi.mock('@/hooks/useProtectedMinorStatus', () => ({
  useProtectedMinorStatus: () => mockUseProtectedMinorStatus(),
}));

const PROTECTED_STATUS: ProtectedMinorStatus = Object.freeze({
  state: 'protected',
  isKnown: true,
  verifiedMinorAt: null,
});

const originalLocation = window.location;
const locationAssign = vi.fn();
const clipboardWriteText = vi.fn();

vi.mock('@/lib/divineLogin', async () => {
  const actual = await vi.importActual<typeof import('@/lib/divineLogin')>('@/lib/divineLogin');

  return {
    ...actual,
    buildSecureAccountRedirect: mockBuildSecureAccountRedirect,
  };
});

describe('LocalNsecBanner', () => {
  beforeEach(() => {
    mockUseProtectedMinorStatus.mockReturnValue(NOT_PROTECTED);
    mockBuildSecureAccountRedirect.mockResolvedValue({
      state: 'secure-state',
      pubkey: 'pubkey-123',
      url: 'https://login.divine.video/api/oauth/authorize?client_id=divine-web',
    });

    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, assign: locationAssign, pathname: '/settings/linked-accounts', search: '' },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: clipboardWriteText },
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

  it('renders the secure-account and backup call to action set', () => {
    render(<LocalNsecBanner nsec="nsec1example" />);

    expect(screen.getByRole('button', { name: /Secure with divine.video login/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back up nsec/i })).toBeInTheDocument();
  });

  it('gives the user a backup path for the current nsec', async () => {
    const user = userEvent.setup();

    render(<LocalNsecBanner nsec="nsec1example" />);

    await user.click(screen.getByRole('button', { name: /Back up nsec/i }));

    await screen.findByText(/somewhere safe/i);
  });

  it('starts the secure-account redirect without exposing the nsec in the URL', async () => {
    const user = userEvent.setup();

    render(<LocalNsecBanner nsec="nsec1example" />);

    await user.click(screen.getByRole('button', { name: /Secure with divine.video login/i }));

    await waitFor(() => {
      expect(mockBuildSecureAccountRedirect).toHaveBeenCalledWith('nsec1example', {
        returnPath: '/settings/linked-accounts',
      });
      expect(locationAssign).toHaveBeenCalledWith('https://login.divine.video/api/oauth/authorize?client_id=divine-web');
    });
  });

  describe('command-boundary re-check (#182)', () => {
    it('aborts a pending secure-account redirect when the restriction engages mid-flight', async () => {
      const user = userEvent.setup();
      let resolveRedirect!: (value: { state: string; pubkey: string; url: string }) => void;
      mockBuildSecureAccountRedirect.mockImplementation(
        () => new Promise((resolve) => { resolveRedirect = resolve; }),
      );

      const { rerender } = render(<LocalNsecBanner nsec="nsec1example" />);

      await user.click(screen.getByRole('button', { name: /Secure with divine.video login/i }));
      expect(mockBuildSecureAccountRedirect).toHaveBeenCalled();

      mockUseProtectedMinorStatus.mockReturnValue(PROTECTED_STATUS);
      rerender(<LocalNsecBanner nsec="nsec1example" />);

      resolveRedirect({
        state: 'secure-state',
        pubkey: 'pubkey-123',
        url: 'https://login.divine.video/api/oauth/authorize?client_id=divine-web',
      });
      // Let the pending handleSecure continuation run to completion. The
      // happy-path test above proves this code path reaches location.assign
      // when unrestricted, so not-called here is a real verdict.
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(locationAssign).not.toHaveBeenCalled();
    });

    // fireEvent (not userEvent) for the clipboard paths: userEvent.setup()
    // installs its own navigator.clipboard stub, which would detach the
    // clipboardWriteText spy these two tests assert on.
    it('aborts the download fall-through when the restriction engages while the clipboard write is pending', async () => {
      let rejectWrite!: (error: Error) => void;
      clipboardWriteText.mockImplementation(
        () => new Promise((_resolve, reject) => { rejectWrite = reject; }),
      );
      const createObjectURL = vi.fn(() => 'blob:stub');
      Object.defineProperty(URL, 'createObjectURL', {
        value: createObjectURL,
        writable: true,
        configurable: true,
      });

      const { rerender } = render(<LocalNsecBanner nsec="nsec1example" />);

      fireEvent.click(screen.getByRole('button', { name: /Back up nsec/i }));
      expect(clipboardWriteText).toHaveBeenCalled();

      mockUseProtectedMinorStatus.mockReturnValue(PROTECTED_STATUS);
      rerender(<LocalNsecBanner nsec="nsec1example" />);

      // A clipboard write can reject late (permission prompt, focus loss); the
      // catch fall-through must not hand the key over via a file download.
      rejectWrite(new Error('NotAllowedError'));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(createObjectURL).not.toHaveBeenCalled();
      expect(screen.queryByText(/somewhere safe/i)).not.toBeInTheDocument();
    });

    it('refuses to copy or download the nsec when rendered by an ungated parent while restricted', async () => {
      const createObjectURL = vi.fn(() => 'blob:stub');
      Object.defineProperty(URL, 'createObjectURL', {
        value: createObjectURL,
        writable: true,
        configurable: true,
      });
      mockUseProtectedMinorStatus.mockReturnValue(PROTECTED_STATUS);

      render(<LocalNsecBanner nsec="nsec1example" />);

      fireEvent.click(screen.getByRole('button', { name: /Back up nsec/i }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(clipboardWriteText).not.toHaveBeenCalled();
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(screen.queryByText(/somewhere safe/i)).not.toBeInTheDocument();
    });

    it('fails closed: refuses to start the secure-account redirect while the status is unknown', async () => {
      const user = userEvent.setup();
      mockUseProtectedMinorStatus.mockReturnValue(UNKNOWN_PROTECTED_MINOR_STATUS);

      render(<LocalNsecBanner nsec="nsec1example" />);

      await user.click(screen.getByRole('button', { name: /Secure with divine.video login/i }));

      expect(mockBuildSecureAccountRedirect).not.toHaveBeenCalled();
      expect(locationAssign).not.toHaveBeenCalled();
    });
  });
});
