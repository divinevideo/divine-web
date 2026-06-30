import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { PendingInviteCard } from './PendingInviteCard';
import type { NostrEvent } from '@nostrify/nostrify';

const video: NostrEvent = {
  id: 'v', pubkey: 'b'.repeat(64), created_at: 1700000000, kind: 34236,
  content: 'desc', sig: '',
  tags: [
    ['d', 'vid1'],
    ['title', 'Hello world'],
    ['p', 'a'.repeat(64), 'actor'],
  ],
};

describe('PendingInviteCard', () => {
  it('renders the title and the role label', () => {
    render(
      <PendingInviteCard
        video={video}
        myPubkey={'a'.repeat(64)}
        onApprove={() => {}}
        approving={false}
      />,
      { wrapper: TestApp },
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText(/actor/i)).toBeInTheDocument();
  });

  it('falls back to "Collaborator" when the p-tag has no role', () => {
    const noRole: NostrEvent = { ...video, tags: video.tags.map((t) => t[0] === 'p' ? ['p', 'a'.repeat(64)] : t) };
    render(
      <PendingInviteCard video={noRole} myPubkey={'a'.repeat(64)} onApprove={() => {}} approving={false} />,
      { wrapper: TestApp },
    );
    expect(screen.getByText(/collaborator/i)).toBeInTheDocument();
  });

  it('calls onApprove with creatorPubkey + d-tag when the button is clicked', () => {
    const onApprove = vi.fn();
    render(
      <PendingInviteCard video={video} myPubkey={'a'.repeat(64)} onApprove={onApprove} approving={false} />,
      { wrapper: TestApp },
    );
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledWith({ creatorPubkey: 'b'.repeat(64), videoDTag: 'vid1' });
  });

  it('disables the button while approving', () => {
    render(
      <PendingInviteCard video={video} myPubkey={'a'.repeat(64)} onApprove={() => {}} approving={true} />,
      { wrapper: TestApp },
    );
    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled();
  });
});
