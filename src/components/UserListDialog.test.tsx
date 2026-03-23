import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserListDialog } from './UserListDialog';

const {
  mockNavigate,
  mockStartInactiveSpan,
  mockUseBatchedAuthors,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseBatchedAuthors: vi.fn(),
  mockStartInactiveSpan: vi.fn(() => ({
    end: vi.fn(),
    setAttribute: vi.fn(),
  })),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useBatchedAuthors', () => ({
  useBatchedAuthors: mockUseBatchedAuthors,
}));

vi.mock('@/lib/genUserName', () => ({
  genUserName: (pubkey: string) => `Generated ${pubkey.slice(0, 6)}`,
}));

vi.mock('@/lib/sentry', () => ({
  Sentry: {
    startInactiveSpan: mockStartInactiveSpan,
  },
}));

describe('UserListDialog', () => {
  it('renders visible fallback rows before author metadata resolves', async () => {
    mockUseBatchedAuthors.mockReturnValue({ data: {} });

    render(
      <UserListDialog
        open
        onOpenChange={vi.fn()}
        title="Followers"
        pubkeys={['a'.repeat(64), 'b'.repeat(64)]}
      />,
    );

    expect(await screen.findByText('Generated aaaaaa')).toBeVisible();
    expect(screen.getByText('Generated bbbbbb')).toBeVisible();
    expect(screen.getAllByText('GE')).toHaveLength(2);
  });
});
