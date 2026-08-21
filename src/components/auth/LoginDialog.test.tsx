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
  mockGetStoredLocalNsecLogin,
  mockLoginActions,
  mockTrackProductEvent,
  mockUseProtectedMinorStatus,
} = vi.hoisted(() => ({
  mockBuildLoginRedirect: vi.fn(),
  mockBuildSignupRedirect: vi.fn(),
  mockGetStoredLocalNsecLogin: vi.fn(),
  mockLoginActions: {
    bunker: vi.fn(),
    extension: vi.fn(),
    nsec: vi.fn(),
  },
  mockTrackProductEvent: vi.fn().mockResolvedValue('event-id'),
  mockUseProtectedMinorStatus: vi.fn(),
}));

const originalLocation = window.location;
const locationAssign = vi.fn();
const fetchMock = vi.fn<typeof fetch>();

vi.mock('@/lib/analyticsClient', () => ({
  getProductAnalyticsUtm: () => ({
    utm_source: 'newsletter',
    utm_medium: 'email',
  }),
  trackProductEvent: mockTrackProductEvent,
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
    vi.stubGlobal('fetch', fetchMock);
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
    vi.unstubAllGlobals();
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
    expect(screen.getByText(/Set up your Divine account\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Create account$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /I already have an account/i })).not.toBeInTheDocument();
  });

  it('records registration entry once when the registration tab opens', async () => {
    const { rerender } = render(
      <LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />,
    );

    await waitFor(() => {
      expect(mockTrackProductEvent).toHaveBeenCalledWith('registration_started', {
        entry_point: 'landing',
        utm_source: 'newsletter',
        utm_medium: 'email',
      });
    });

    rerender(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);
    expect(mockTrackProductEvent).toHaveBeenCalledTimes(1);
  });
  it('does not mislabel registration opened from an app route as a landing', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, assign: locationAssign, pathname: '/profile/npub1example', search: '' },
      writable: true,
      configurable: true,
    });

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await waitFor(() => {
      expect(mockTrackProductEvent).toHaveBeenCalledWith('registration_started', {
        entry_point: 'unknown',
        utm_source: 'newsletter',
        utm_medium: 'email',
      });
    });
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

  it('redirects existing-account users from the sign-in tab', async () => {
    const user = userEvent.setup();

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));
    await user.click(screen.getByRole('button', { name: /^Sign in at login\.divine\.video$/i }));

    await waitFor(() => {
      expect(mockBuildLoginRedirect).toHaveBeenCalledWith({ returnPath: '/' });
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

    it('logs in via extension when positively not protected (positive control)', async () => {
      const user = userEvent.setup();
      (window as unknown as { nostr?: object }).nostr = {};
      mockLoginActions.extension.mockResolvedValue(true);
      const onLogin = vi.fn();
      const onClose = vi.fn();

      try {
        render(<LoginDialog isOpen onClose={onClose} onLogin={onLogin} />);

        await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));
        await user.click(screen.getByRole('button', { name: /Use Nostr instead/i }));
        await user.click(await screen.findByRole('button', { name: /Login with Extension/i }));

        await waitFor(() => {
          expect(onLogin).toHaveBeenCalled();
          expect(onClose).toHaveBeenCalled();
        });
      } finally {
        delete (window as unknown as { nostr?: object }).nostr;
      }
    });

    it('blocks a pending extension login when the restriction engages during the handshake', async () => {
      const user = userEvent.setup();
      (window as unknown as { nostr?: object }).nostr = {};
      let resolveHandshake!: () => void;
      const handshake = new Promise<void>((resolve) => { resolveHandshake = resolve; });
      // Faithful to the real contract (pinned in useLoginActions.test.ts): the
      // action runs the caller's guard at commit time and reports whether the
      // signer was committed.
      mockLoginActions.extension.mockImplementation(
        async (options?: { beforeCommit?: () => boolean }) => {
          await handshake;
          return options?.beforeCommit?.() ?? true;
        },
      );
      const onLogin = vi.fn();
      const onClose = vi.fn();

      try {
        const { rerender } = render(<LoginDialog isOpen onClose={onClose} onLogin={onLogin} />);

        await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));
        await user.click(screen.getByRole('button', { name: /Use Nostr instead/i }));
        await user.click(await screen.findByRole('button', { name: /Login with Extension/i }));
        expect(mockLoginActions.extension).toHaveBeenCalled();

        // The verdict flips to protected while the extension prompt is open.
        mockUseProtectedMinorStatus.mockReturnValue(PROTECTED_STATUS);
        rerender(<LoginDialog isOpen onClose={onClose} onLogin={onLogin} />);

        resolveHandshake();
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(onLogin).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
      } finally {
        delete (window as unknown as { nostr?: object }).nostr;
      }
    });

    it('blocks a pending bunker login when the restriction engages during the connect', async () => {
      const user = userEvent.setup();
      let resolveConnect!: () => void;
      const connect = new Promise<void>((resolve) => { resolveConnect = resolve; });
      mockLoginActions.bunker.mockImplementation(
        async (_uri: string, options?: { beforeCommit?: () => boolean }) => {
          await connect;
          return options?.beforeCommit?.() ?? true;
        },
      );
      const onLogin = vi.fn();
      const onClose = vi.fn();

      const { rerender } = render(<LoginDialog isOpen onClose={onClose} onLogin={onLogin} />);

      await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));
      await user.click(screen.getByRole('button', { name: /Use Nostr instead/i }));
      // The trigger renders both the full and sm:hidden short labels, so the
      // accessible name is "Bunker Bnkr" - no exact match.
      await user.click(await screen.findByRole('tab', { name: /Bunker/i }));
      fireEvent.change(screen.getByLabelText(/Bunker URI/i), {
        target: { value: 'bunker://remote-signer.example?relay=wss%3A%2F%2Frelay.example' },
      });
      await user.click(screen.getByRole('button', { name: /Login with Bunker/i }));
      expect(mockLoginActions.bunker).toHaveBeenCalled();

      // The verdict flips to protected while the bunker connect is pending.
      mockUseProtectedMinorStatus.mockReturnValue(PROTECTED_STATUS);
      rerender(<LoginDialog isOpen onClose={onClose} onLogin={onLogin} />);

      resolveConnect();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(onLogin).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    // divine-web#485: a NIP-46 signer can answer with an auth challenge instead
    // of a result. We open it in a tab, but that fires after an await so popup
    // blockers routinely eat it — the dialog has to offer the link.
    it('shows the auth challenge link when the browser blocks the popup', async () => {
      const user = userEvent.setup();
      mockLoginActions.bunker.mockImplementation(
        async (_uri: string, options?: { onAuthChallenge?: (c: { url: string; opened: boolean }) => void }) => {
          options?.onAuthChallenge?.({ url: 'https://signer.example/approve', opened: false });
          return new Promise(() => {}); // still waiting on the signer
        }
      );

      render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

      await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));
      await user.click(screen.getByRole('button', { name: /Use Nostr instead/i }));
      await user.click(await screen.findByRole('tab', { name: /Bunker/i }));
      fireEvent.change(screen.getByLabelText(/Bunker URI/i), {
        target: { value: 'bunker://remote-signer.example?relay=wss%3A%2F%2Frelay.example' },
      });
      await user.click(screen.getByRole('button', { name: /Login with Bunker/i }));

      const link = await screen.findByRole('link', { name: /Approve in your signer/i });
      expect(link).toHaveAttribute('href', 'https://signer.example/approve');
      // The signer picks this URL, so the destination must be visible rather
      // than hidden behind our own localized label.
      expect(screen.getByText('(signer.example)')).toBeInTheDocument();
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });

    it('stays quiet when the challenge tab opened successfully', async () => {
      const user = userEvent.setup();
      mockLoginActions.bunker.mockImplementation(
        async (_uri: string, options?: { onAuthChallenge?: (c: { url: string; opened: boolean }) => void }) => {
          options?.onAuthChallenge?.({ url: 'https://signer.example/approve', opened: true });
          return new Promise(() => {});
        }
      );

      render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

      await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));
      await user.click(screen.getByRole('button', { name: /Use Nostr instead/i }));
      await user.click(await screen.findByRole('tab', { name: /Bunker/i }));
      fireEvent.change(screen.getByLabelText(/Bunker URI/i), {
        target: { value: 'bunker://remote-signer.example?relay=wss%3A%2F%2Frelay.example' },
      });
      await user.click(screen.getByRole('button', { name: /Login with Bunker/i }));

      expect(screen.queryByRole('link', { name: /Approve in your signer/i })).toBeNull();
    });

    // LoginArea renders this dialog unconditionally and only toggles `isOpen`,
    // so dismissing it leaves the NIP-46 handshake running. A signer approval
    // that lands afterwards must not log the user in behind their back.
    it('refuses to commit a bunker login the user dismissed while it was pending', async () => {
      const user = userEvent.setup();
      let capturedBeforeCommit: (() => boolean) | undefined;
      mockLoginActions.bunker.mockImplementation(
        async (_uri: string, options?: { beforeCommit?: () => boolean }) => {
          capturedBeforeCommit = options?.beforeCommit;
          return new Promise(() => {}); // signer still waiting on out-of-band approval
        }
      );

      const { rerender } = render(
        <LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />
      );

      await user.click(await screen.findByRole('tab', { name: /^Sign in$/i }));
      await user.click(screen.getByRole('button', { name: /Use Nostr instead/i }));
      await user.click(await screen.findByRole('tab', { name: /Bunker/i }));
      fireEvent.change(screen.getByLabelText(/Bunker URI/i), {
        target: { value: 'bunker://remote-signer.example?relay=wss%3A%2F%2Frelay.example' },
      });
      await user.click(screen.getByRole('button', { name: /Login with Bunker/i }));

      expect(capturedBeforeCommit?.()).toBe(true);

      // User gives up and closes the dialog; the component stays mounted.
      rerender(<LoginDialog isOpen={false} onClose={vi.fn()} onLogin={vi.fn()} />);

      expect(capturedBeforeCommit?.()).toBe(false);

      // Reopening must not re-arm the guard. Anything that calls
      // openLoginDialog() later, a like button for instance, reopens this same
      // mounted instance, and the abandoned approval can still be in flight
      // because nothing bounds how long the signer takes.
      rerender(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

      expect(capturedBeforeCommit?.()).toBe(false);
    });

    // fireEvent (not userEvent) so the local clipboard spy stays attached;
    // userEvent.setup() installs its own navigator.clipboard stub.
    it('aborts an in-flight nsec backup when the restriction engages mid-flight (real parent path)', async () => {
      mockGetStoredLocalNsecLogin.mockReturnValue({
        type: 'nsec',
        data: { nsec: 'nsec1example' },
      });

      let rejectWrite!: (error: Error) => void;
      const clipboardWriteText = vi.fn(
        () => new Promise<void>((_resolve, reject) => { rejectWrite = reject; }),
      );
      const originalClipboard = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard');
      const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
      const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
      const createObjectURL = vi.fn(() => 'blob:stub');
      Object.defineProperty(window.navigator, 'clipboard', {
        value: { writeText: clipboardWriteText }, writable: true, configurable: true,
      });
      Object.defineProperty(URL, 'createObjectURL', {
        value: createObjectURL, writable: true, configurable: true,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: vi.fn(), writable: true, configurable: true,
      });

      try {
        const { rerender } = render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

        fireEvent.click(await screen.findByRole('button', { name: /Back up nsec/i }));
        expect(clipboardWriteText).toHaveBeenCalled();

        mockUseProtectedMinorStatus.mockReturnValue(PROTECTED_STATUS);
        rerender(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);
        // The affordance disappears from the DOM...
        expect(screen.queryByRole('button', { name: /Back up nsec/i })).not.toBeInTheDocument();

        // ...and the flip must reach the in-flight continuation too: a late
        // clipboard rejection must not fall through to a plaintext download.
        // This goes through the real parent (not an in-place banner rerender)
        // so the banner's mount lifecycle is the production one.
        rejectWrite(new Error('NotAllowedError'));
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(createObjectURL).not.toHaveBeenCalled();
      } finally {
        if (originalClipboard) {
          Object.defineProperty(window.navigator, 'clipboard', originalClipboard);
        } else {
          delete (window.navigator as { clipboard?: unknown }).clipboard;
        }
        if (originalCreateObjectURL) {
          Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
        } else {
          delete (URL as { createObjectURL?: unknown }).createObjectURL;
        }
        if (originalRevokeObjectURL) {
          Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
        } else {
          delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
        }
      }
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

  it('redirects new users to hosted signup with the current return path', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, assign: locationAssign, pathname: '/discovery', search: '?tab=hot' },
      writable: true,
      configurable: true,
    });

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: /^Create account$/i }));

    await waitFor(() => {
      expect(mockBuildSignupRedirect).toHaveBeenCalledWith({ returnPath: '/discovery?tab=hot' });
      expect(locationAssign).toHaveBeenCalledWith('https://login.divine.video/api/oauth/authorize?client_id=divine-web');
    });
  });

  it('shows a signup-specific error when hosted signup cannot start', async () => {
    const user = userEvent.setup();
    mockBuildSignupRedirect.mockRejectedValue(undefined);

    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: /^Create account$/i }));

    expect(await screen.findByText(/Unable to start sign-up/i)).toBeInTheDocument();
  });

  it('renders both auth tabs immediately without contacting the invite service', async () => {
    render(<LoginDialog isOpen onClose={vi.fn()} onLogin={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /^Create account$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Register$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Sign in$/i })).toBeInTheDocument();
    expect(screen.queryByText(/Checking invite status/i)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
