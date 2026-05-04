import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
