import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

import { TestApp } from '@/test/TestApp';
import { InboxTab } from './InboxTab';

const { ME, CREATOR_ONE, CREATOR_TWO, mutateMock, refetchMock } = vi.hoisted(() => ({
  ME: 'a'.repeat(64),
  CREATOR_ONE: 'b'.repeat(64),
  CREATOR_TWO: 'c'.repeat(64),
  mutateMock: vi.fn(),
  refetchMock: vi.fn(),
}));

function video(id: string, creator: string): NostrEvent {
  return {
    id,
    pubkey: creator,
    created_at: 1700000000,
    kind: 34236,
    content: '',
    sig: '',
    tags: [
      ['d', id],
      ['title', `Video ${id}`],
      ['p', ME, 'actor'],
    ],
  };
}

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: ME } }),
}));

vi.mock('@/hooks/useCollabInvites', () => ({
  useCollabInvites: () => ({
    data: [video('one', CREATOR_ONE), video('two', CREATOR_TWO)],
    isPending: false,
    isError: false,
    refetch: refetchMock,
  }),
}));

vi.mock('@/hooks/useApproveCollab', () => ({
  useApproveCollab: () => ({
    isPending: true,
    variables: { creatorPubkey: CREATOR_ONE, videoDTag: 'one' },
    mutate: mutateMock,
  }),
}));

describe('InboxTab', () => {
  it('only marks the matching invite as approving', () => {
    render(<InboxTab />, { wrapper: TestApp });

    expect(screen.getByText(/approving/i).closest('button')).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /^approve$/i })
      .some((button) => !button.hasAttribute('disabled'))).toBe(true);
  });
});
