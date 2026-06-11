// ABOUTME: Tests for VideoReactionsModal profile link behavior
// ABOUTME: Guards against routing through the unreliable /u/<nip05> resolver

import { render, screen } from '@testing-library/react';
import type { HTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import type { VideoReactions } from '@/hooks/useVideoReactions';
import { VideoReactionsModal } from './VideoReactionsModal';

const { authorMocks } = vi.hoisted(() => ({
  authorMocks: {
    metadata: { display_name: 'Alice' } as Record<string, unknown>,
  },
}));

vi.mock('@/components/SmartLink', () => ({
  SmartLink: ({
    children,
    ownerPubkey: _ownerPubkey,
    to,
    ...props
  }: HTMLAttributes<HTMLAnchorElement> & { ownerPubkey?: string; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: { metadata: authorMocks.metadata },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useBatchedAuthors', () => ({
  useBatchedAuthors: () => ({ data: {} }),
}));

vi.mock('@/lib/generateProfile', () => ({
  enhanceAuthorData: (
    data: { metadata?: Record<string, unknown> } | undefined,
    pubkey: string,
  ) => ({
    metadata: data?.metadata ?? { name: pubkey },
  }),
}));

const LIKER_PUBKEY = 'a'.repeat(64);

const reactions: VideoReactions = {
  likes: [
    {
      pubkey: LIKER_PUBKEY,
      eventId: 'e'.repeat(64),
      timestamp: 1_700_000_000,
      type: 'like',
    },
  ],
  reposts: [],
};

describe('VideoReactionsModal', () => {
  beforeEach(() => {
    authorMocks.metadata = { display_name: 'Alice' };
  });

  it('links reaction users directly to their npub profile', () => {
    render(
      <VideoReactionsModal
        open
        onOpenChange={vi.fn()}
        reactions={reactions}
        type="likes"
      />,
    );

    const link = screen.getByText('Alice').closest('a');
    expect(link).toHaveAttribute('href', `/${nip19.npubEncode(LIKER_PUBKEY)}`);
  });

  it('keeps the direct npub link when metadata includes a NIP-05 alias', () => {
    authorMocks.metadata = {
      display_name: 'Alice',
      nip05: 'alice@divine.video',
    };

    render(
      <VideoReactionsModal
        open
        onOpenChange={vi.fn()}
        reactions={reactions}
        type="likes"
      />,
    );

    const link = screen.getByText('Alice').closest('a');
    expect(link).toHaveAttribute('href', `/${nip19.npubEncode(LIKER_PUBKEY)}`);
  });
});
