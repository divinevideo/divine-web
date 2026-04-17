// ABOUTME: Tests that AgeVerificationOverlay shows a Sign In CTA to logged-out viewers
// ABOUTME: and preserves the existing "I'm 18 or older" flow for logged-in viewers

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const openLoginDialog = vi.fn();
vi.mock('@/contexts/LoginDialogContext', () => ({
  useLoginDialog: () => ({ openLoginDialog, closeLoginDialog: vi.fn(), isOpen: false }),
}));

const confirmAdult = vi.fn();
const isVerifiedRef = { current: false };
vi.mock('@/hooks/useAdultVerification', () => ({
  useAdultVerification: () => ({
    get isVerified() { return isVerifiedRef.current; },
    isLoading: false,
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
  beforeEach(() => {
    openLoginDialog.mockClear();
    confirmAdult.mockClear();
    useCurrentUserMock.mockReset();
    isVerifiedRef.current = false;
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

  it('keeps the existing "I\'m 18 or older" flow when a user IS logged in', () => {
    useCurrentUserMock.mockReturnValue({
      user: { pubkey: 'pub' },
      signer: { signEvent: vi.fn(), getPublicKey: vi.fn() },
    });
    const onVerified = vi.fn();
    render(<AgeVerificationOverlay onVerified={onVerified} />);

    expect(screen.queryByText(/sign in to view this content/i)).toBeNull();
    const confirmButton = screen.getByRole('button', { name: /18 or older/i });
    fireEvent.click(confirmButton);
    expect(confirmAdult).toHaveBeenCalledTimes(1);
    expect(onVerified).toHaveBeenCalledTimes(1);
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
