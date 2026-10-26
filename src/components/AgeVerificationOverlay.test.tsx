// ABOUTME: Tests that AgeVerificationOverlay shows a Sign In CTA to logged-out viewers
// ABOUTME: and preserves the existing "I'm 18 or older" flow for logged-in viewers

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initializeI18n } from '@/lib/i18n';

const openLoginDialog = vi.fn();
vi.mock('@/contexts/LoginDialogContext', () => ({
  useLoginDialog: () => ({ openLoginDialog, closeLoginDialog: vi.fn(), isOpen: false }),
}));

const confirmAdult = vi.fn();
const isVerifiedRef = { current: false };
const isLoadingRef = { current: false };
vi.mock('@/hooks/useAdultVerification', () => ({
  useAdultVerification: () => ({
    get isVerified() { return isVerifiedRef.current; },
    get isLoading() { return isLoadingRef.current; },
    hasSigner: true,
    confirmAdult,
    revokeVerification: vi.fn(),
    getAuthHeader: vi.fn(),
  }),
}));

const useCurrentUserMock = vi.fn();
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

import { AgeVerificationOverlay } from '@/components/AgeVerificationOverlay';

describe('AgeVerificationOverlay', () => {
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
    openLoginDialog.mockClear();
    confirmAdult.mockClear();
    useCurrentUserMock.mockReset();
    isVerifiedRef.current = false;
    isLoadingRef.current = false;
    confirmAdult.mockReturnValue(true);
  });

  it('shows "Sign in to view this content" heading when no user is logged in', () => {
    useCurrentUserMock.mockReturnValue({ user: null, signer: null });
    render(<AgeVerificationOverlay onVerified={vi.fn()} />);

    expect(screen.getByText(/sign in to view this content/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /18 or older/i })).toBeNull();
  });

  it('renders a Sign In button that opens the login dialog', () => {
    useCurrentUserMock.mockReturnValue({ user: null, signer: null });
    render(<AgeVerificationOverlay onVerified={vi.fn()} />);

    const signInButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(signInButton);
    expect(openLoginDialog).toHaveBeenCalledTimes(1);
  });

  it('lets a signed-out viewer hide age-restricted videos in this browser', () => {
    useCurrentUserMock.mockReturnValue({ user: null, signer: null });
    render(<AgeVerificationOverlay onVerified={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /don't show me these videos/i }));

    expect(localStorage.getItem('hide-age-restricted-videos')).toBe('true');
    expect(screen.getByRole('button', { name: /show age-restricted videos/i })).toBeInTheDocument();
  });

  it('only reports success after adult verification becomes effective', () => {
    useCurrentUserMock.mockReturnValue({
      user: { pubkey: 'pub' },
      signer: { signEvent: vi.fn(), getPublicKey: vi.fn() },
    });
    const onVerified = vi.fn();
    const { rerender } = render(<AgeVerificationOverlay onVerified={onVerified} />);

    expect(screen.queryByText(/sign in to view this content/i)).toBeNull();
    const confirmButton = screen.getByRole('button', { name: /18 or older/i });
    fireEvent.click(confirmButton);
    expect(confirmAdult).toHaveBeenCalledTimes(1);
    expect(onVerified).not.toHaveBeenCalled();

    isVerifiedRef.current = true;
    rerender(<AgeVerificationOverlay onVerified={onVerified} />);
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('waits for the account age check before accepting confirmation', () => {
    isLoadingRef.current = true;
    useCurrentUserMock.mockReturnValue({ user: { pubkey: 'pub' }, signer: {} });
    const onVerified = vi.fn();
    render(<AgeVerificationOverlay onVerified={onVerified} />);

    const button = screen.getByRole('button', { name: /checking age status/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(confirmAdult).not.toHaveBeenCalled();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('allows another attempt when confirmation is refused', () => {
    confirmAdult.mockReturnValue(false);
    useCurrentUserMock.mockReturnValue({ user: { pubkey: 'pub' }, signer: {} });
    const onVerified = vi.fn();
    render(<AgeVerificationOverlay onVerified={onVerified} />);

    const button = screen.getByRole('button', { name: /18 or older/i });
    fireEvent.click(button);
    expect(button).toBeEnabled();
    expect(onVerified).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(confirmAdult).toHaveBeenCalledTimes(2);
  });

  it('renders nothing when isVerified is true (preserves existing early-return)', () => {
    isVerifiedRef.current = true;
    useCurrentUserMock.mockReturnValue({
      user: { pubkey: 'pub' },
      signer: { signEvent: vi.fn(), getPublicKey: vi.fn() },
    });
    const { container } = render(<AgeVerificationOverlay onVerified={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
