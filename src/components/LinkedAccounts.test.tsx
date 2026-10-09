import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkedAccounts } from './LinkedAccounts';

const mockUseExternalIdentities = vi.fn();
const mockVerifyIdentityClaim = vi.fn();

vi.mock('@/hooks/useExternalIdentities', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/hooks/useExternalIdentities')>();
  return {
    useExternalIdentities: (...args: unknown[]) => mockUseExternalIdentities(...args),
    verifyIdentityClaim: (...args: unknown[]) => mockVerifyIdentityClaim(...args),
    VERIFIER_TEMPORARILY_UNAVAILABLE: actual.VERIFIER_TEMPORARILY_UNAVAILABLE,
    SUPPORTED_PLATFORMS: {
      github: {
        label: 'GitHub',
        profileUrl: (id: string) => `https://github.com/${id}`,
        proofUrl: (id: string, proof: string) => `https://gist.github.com/${id}/${proof}`,
        verificationText: () => [],
        canVerifyInBrowser: false,
      },
    },
  };
});

vi.mock('@/lib/verificationCache', () => ({
  getCachedVerification: () => null,
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
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('hides unverified identity badge on profile', async () => {
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
      expect(screen.queryByTestId('identity-badge-github')).not.toBeInTheDocument();
    });
  });

  it('re-verifies the same claim for a different Nostr pubkey', async () => {
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
    mockVerifyIdentityClaim
      .mockResolvedValueOnce({ verified: true })
      .mockResolvedValueOnce({ verified: false });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <LinkedAccounts pubkey={'a'.repeat(64)} />
      </QueryClientProvider>,
    );
    await screen.findByTestId('identity-badge-github');

    rerender(
      <QueryClientProvider client={queryClient}>
        <LinkedAccounts pubkey={'b'.repeat(64)} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mockVerifyIdentityClaim).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.queryByTestId('identity-badge-github')).not.toBeInTheDocument();
    });
  });

  it('keeps a verified badge when a later check couldn\'t be completed', async () => {
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
    mockVerifyIdentityClaim
      .mockResolvedValueOnce({ verified: true })
      .mockResolvedValue({ verified: false, code: 'temporarily_unavailable', error: 'GitHub couldn\'t be checked right now.' });

    // The badge's own query retries twice; no delay keeps the test fast.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retryDelay: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <LinkedAccounts pubkey={'a'.repeat(64)} />
      </QueryClientProvider>,
    );
    await screen.findByTestId('identity-badge-github');

    // invalidateQueries() resolves once the refetch and its two retries have
    // all come back "couldn't check", but React Query tells the badge on the
    // next tick. Wait for that render, or the badge check reads the old DOM.
    await act(async () => {
      await queryClient.invalidateQueries();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockVerifyIdentityClaim).toHaveBeenCalledTimes(4);
    expect(screen.getByTestId('identity-badge-github')).toBeInTheDocument();
  });
});
