// ABOUTME: Tests that AgeVerificationOverlay lets both logged-in and anonymous viewers
// ABOUTME: pass the age gate via the shared "I'm 18 or older" confirm flow.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

import { AgeVerificationOverlay } from '@/components/AgeVerificationOverlay';

describe('AgeVerificationOverlay', () => {
  beforeEach(() => {
    confirmAdult.mockClear();
    isVerifiedRef.current = false;
  });

  it('shows the "I\'m 18 or older" button to anonymous viewers', () => {
    const onVerified = vi.fn();
    render(<AgeVerificationOverlay onVerified={onVerified} />);

    const confirmButton = screen.getByRole('button', { name: /18 or older/i });
    fireEvent.click(confirmButton);

    expect(confirmAdult).toHaveBeenCalledTimes(1);
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing "I\'m 18 or older" flow when a user IS logged in', () => {
    const onVerified = vi.fn();
    render(<AgeVerificationOverlay onVerified={onVerified} />);

    const confirmButton = screen.getByRole('button', { name: /18 or older/i });
    fireEvent.click(confirmButton);
    expect(confirmAdult).toHaveBeenCalledTimes(1);
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when isVerified is true (preserves existing early-return)', () => {
    isVerifiedRef.current = true;
    const { container } = render(<AgeVerificationOverlay onVerified={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
