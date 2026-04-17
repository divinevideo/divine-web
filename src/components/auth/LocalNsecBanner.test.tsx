import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalNsecBanner } from './LocalNsecBanner';

const { mockBuildSecureAccountRedirect } = vi.hoisted(() => ({
  mockBuildSecureAccountRedirect: vi.fn(),
}));

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
});
