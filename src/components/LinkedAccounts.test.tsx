import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18n } from '@/lib/i18n';
import { LinkedAccounts } from './LinkedAccounts';

const mockUseExternalIdentities = vi.fn();
const mockVerifyIdentityClaim = vi.fn();

vi.mock('@/hooks/useExternalIdentities', () => ({
  useExternalIdentities: (...args: unknown[]) => mockUseExternalIdentities(...args),
  verifyIdentityClaim: (...args: unknown[]) => mockVerifyIdentityClaim(...args),
  SUPPORTED_PLATFORMS: {
    github: {
      label: 'GitHub',
      profileUrl: (id: string) => `https://github.com/${id}`,
      proofUrl: (id: string, proof: string) => `https://gist.github.com/${id}/${proof}`,
      verificationText: () => [],
      canVerifyInBrowser: false,
    },
  },
}));

vi.mock('@/lib/verificationCache', () => ({
  getCachedVerification: () => null,
}));

let mockShowUnverified = false;
vi.mock('@/hooks/useLocalStorage', () => ({
  useLocalStorage: () => [
    mockShowUnverified,
    (value: boolean | ((prev: boolean) => boolean)) => {
      mockShowUnverified = typeof value === 'function' ? value(mockShowUnverified) : value;
    },
  ],
}));

function withQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('LinkedAccounts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockShowUnverified = false;
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  it('renders verified identity badge on profile', async () => {
    mockUseExternalIdentities.mockReturnValue({
      data: [
        {
          platform: 'github',
          identity: 'alice',
          proof: 'abc123',
          profileUrl: 'https://github.com/alice',
          proofUrl: 'https://gist.github.com/alice/abc123',
        },
      ],
      isLoading: false,
    });
    mockVerifyIdentityClaim.mockResolvedValue({ verified: true });

    render(withQueryClient(<LinkedAccounts pubkey={'a'.repeat(64)} />));

    await waitFor(() => {
      expect(screen.getByTestId('identity-badge-github')).toBeInTheDocument();
    });
  });

  it('hides unverified identity badge by default (toggle off)', async () => {
    mockUseExternalIdentities.mockReturnValue({
      data: [
        {
          platform: 'github',
          identity: 'alice',
          proof: 'abc123',
          profileUrl: 'https://github.com/alice',
          proofUrl: 'https://gist.github.com/alice/abc123',
        },
      ],
      isLoading: false,
    });
    mockVerifyIdentityClaim.mockResolvedValue({ verified: false, error: 'manual' });

    render(withQueryClient(<LinkedAccounts pubkey={'a'.repeat(64)} />));

    await waitFor(() => {
      expect(mockVerifyIdentityClaim).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByTestId('identity-badge-github-unverified')).not.toBeInTheDocument();
    });
  });

  it('shows unverified identity badge when toggle is on', async () => {
    mockShowUnverified = true;
    mockUseExternalIdentities.mockReturnValue({
      data: [
        {
          platform: 'github',
          identity: 'alice',
          proof: 'abc123',
          profileUrl: 'https://github.com/alice',
          proofUrl: 'https://gist.github.com/alice/abc123',
        },
      ],
      isLoading: false,
    });
    mockVerifyIdentityClaim.mockResolvedValue({ verified: false, error: 'manual' });

    render(withQueryClient(<LinkedAccounts pubkey={'a'.repeat(64)} />));

    await waitFor(() => {
      expect(screen.getByTestId('identity-badge-github-unverified')).toBeInTheDocument();
    });
  });

  it('keeps hard-failed identity claims hidden when toggle is on', async () => {
    mockShowUnverified = true;
    mockUseExternalIdentities.mockReturnValue({
      data: [
        {
          platform: 'github',
          identity: 'alice',
          proof: 'abc123',
          profileUrl: 'https://github.com/alice',
          proofUrl: 'https://gist.github.com/alice/abc123',
        },
      ],
      isLoading: false,
    });
    mockVerifyIdentityClaim.mockResolvedValue({ verified: false, error: 'HTTP 404' });

    render(withQueryClient(<LinkedAccounts pubkey={'a'.repeat(64)} />));

    await waitFor(() => {
      expect(mockVerifyIdentityClaim).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByTestId('identity-badge-github-unverified')).not.toBeInTheDocument();
    });
  });

  it('does not render the toggle when no identities have proofs', () => {
    mockUseExternalIdentities.mockReturnValue({
      data: [
        {
          platform: 'github',
          identity: 'alice',
          proof: '',
          profileUrl: 'https://github.com/alice',
          proofUrl: '',
        },
      ],
      isLoading: false,
    });
    mockVerifyIdentityClaim.mockResolvedValue({ verified: true });

    render(withQueryClient(<LinkedAccounts pubkey={'a'.repeat(64)} />));

    expect(screen.queryByTestId('show-unverified-toggle')).not.toBeInTheDocument();
  });

  it('toggles aria-pressed when clicked without changing its accessible name', async () => {
    mockUseExternalIdentities.mockReturnValue({
      data: [
        {
          platform: 'github',
          identity: 'alice',
          proof: 'abc123',
          profileUrl: 'https://github.com/alice',
          proofUrl: 'https://gist.github.com/alice/abc123',
        },
      ],
      isLoading: false,
    });
    mockVerifyIdentityClaim.mockResolvedValue({ verified: false, error: 'manual' });

    const { rerender } = render(withQueryClient(<LinkedAccounts pubkey={'a'.repeat(64)} />));

    const toggle = await screen.findByRole('button', { name: 'Show unverified' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);
    expect(mockShowUnverified).toBe(true);

    rerender(withQueryClient(<LinkedAccounts pubkey={'a'.repeat(64)} />));
    expect(screen.getByRole('button', { name: 'Show unverified' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('summary popover renders localized verification copy', async () => {
    mockUseExternalIdentities.mockReturnValue({
      data: [
        {
          platform: 'github',
          identity: 'alice',
          proof: 'abc123',
          profileUrl: 'https://github.com/alice',
          proofUrl: 'https://gist.github.com/alice/abc123',
        },
      ],
      isLoading: false,
    });
    mockVerifyIdentityClaim.mockResolvedValue({ verified: true });

    render(withQueryClient(<LinkedAccounts pubkey={'a'.repeat(64)} />));

    fireEvent.click(screen.getByRole('button', { name: 'Linked accounts' }));

    expect(await screen.findByText('Identity verification')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Linked accounts use NIP-39 identity proofs. Verified accounts show automatically; unverifiable claims stay hidden unless you choose to show them.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('linkedAccounts.identityVerificationDescription')).not.toBeInTheDocument();
  });

  it('popover on a manual badge shows a verify-manually link with the correct URL', async () => {
    mockShowUnverified = true;
    mockUseExternalIdentities.mockReturnValue({
      data: [
        {
          platform: 'github',
          identity: 'alice',
          proof: 'abc123',
          profileUrl: 'https://github.com/alice',
          proofUrl: 'https://gist.github.com/alice/abc123',
        },
      ],
      isLoading: false,
    });
    mockVerifyIdentityClaim.mockResolvedValue({ verified: false, error: 'manual' });

    render(withQueryClient(<LinkedAccounts pubkey={'a'.repeat(64)} />));

    const badge = await screen.findByTestId('identity-badge-github-unverified');
    fireEvent.click(badge);

    const link = await screen.findByTestId('verify-manually-github');
    expect(link).toHaveAttribute(
      'href',
      'https://verifyer.divine.video/verify/github/alice/abc123?pubkey=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
  });
});
