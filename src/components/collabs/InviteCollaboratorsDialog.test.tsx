import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

import { TestApp } from '@/test/TestApp';
import { InviteCollaboratorsDialog } from './InviteCollaboratorsDialog';

const { resolveNip05Mock, inviteMutateAsync } = vi.hoisted(() => ({
  resolveNip05Mock: vi.fn(),
  inviteMutateAsync: vi.fn(),
}));

const COLLABORATOR = 'c'.repeat(64);
const EXISTING = 'e'.repeat(64);

const video: NostrEvent = {
  id: 'video',
  pubkey: 'a'.repeat(64),
  created_at: 1700000000,
  kind: 34236,
  content: '',
  sig: '',
  tags: [
    ['d', 'video'],
    ['title', 'Video'],
    ['p', EXISTING, 'director'],
  ],
};

vi.mock('@/lib/nip05Resolve', async () => {
  const actual = await vi.importActual<typeof import('@/lib/nip05Resolve')>('@/lib/nip05Resolve');
  return {
    ...actual,
    resolveNip05: resolveNip05Mock,
  };
});

vi.mock('@/hooks/useVideoCollaboratorStatus', () => ({
  useVideoCollaboratorStatus: () => ({ data: {} }),
}));

vi.mock('@/hooks/useInviteCollaborators', () => ({
  useInviteCollaborators: () => ({
    isPending: false,
    mutateAsync: inviteMutateAsync,
  }),
}));

describe('InviteCollaboratorsDialog', () => {
  beforeEach(() => {
    resolveNip05Mock.mockReset();
    inviteMutateAsync.mockReset();
  });

  it('does not queue the same resolved collaborator twice', async () => {
    resolveNip05Mock.mockResolvedValue({ pubkey: COLLABORATOR, name: 'name', domain: 'divine.video' });
    const user = userEvent.setup();

    render(
      <InviteCollaboratorsDialog video={video} open={true} onOpenChange={() => {}} />,
      { wrapper: TestApp },
    );

    await user.type(screen.getByPlaceholderText(/handle/i), 'name.divine.video');
    await user.click(screen.getByRole('button', { name: /add/i }));
    await user.type(screen.getByPlaceholderText(/handle/i), 'name.divine.video');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(screen.getAllByText(/to add/i)).toHaveLength(1);
    expect(screen.getByText(/already queued/i)).toBeInTheDocument();
  });

  it('does not queue an already tagged collaborator', async () => {
    resolveNip05Mock.mockResolvedValue({ pubkey: EXISTING, name: 'existing', domain: 'divine.video' });
    const user = userEvent.setup();

    render(
      <InviteCollaboratorsDialog video={video} open={true} onOpenChange={() => {}} />,
      { wrapper: TestApp },
    );

    await user.type(screen.getByPlaceholderText(/handle/i), 'existing.divine.video');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(screen.queryByText(/to add/i)).not.toBeInTheDocument();
    expect(screen.getByText(/already tagged/i)).toBeInTheDocument();
  });
});
