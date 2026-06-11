// ABOUTME: Tests for NotificationItem profile navigation behavior
// ABOUTME: Guards against routing through the unreliable /u/<nip05> resolver

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import type { Notification } from '@/types/notification';
import { NotificationItem } from './NotificationItem';

const { mockNavigate, authorMocks } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  authorMocks: {
    metadata: { display_name: 'Follower' } as Record<string, unknown>,
  },
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: { metadata: authorMocks.metadata },
    isLoading: false,
  }),
}));

const ACTOR_PUBKEY = 'a'.repeat(64);

function buildNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notification-1',
    type: 'follow',
    actorPubkey: ACTOR_PUBKEY,
    timestamp: 1_700_000_000,
    isRead: true,
    sourceEventId: 'b'.repeat(64),
    sourceKind: 3,
    ...overrides,
  };
}

describe('NotificationItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorMocks.metadata = { display_name: 'Follower' };
  });

  it('navigates follow notifications directly to the actor npub profile', () => {
    render(<NotificationItem notification={buildNotification()} />);

    fireEvent.click(screen.getByRole('button'));

    expect(mockNavigate).toHaveBeenCalledWith(
      `/profile/${nip19.npubEncode(ACTOR_PUBKEY)}`,
    );
  });

  it('keeps the direct npub link when actor metadata includes a NIP-05 alias', () => {
    authorMocks.metadata = {
      display_name: 'Follower',
      nip05: 'follower@divine.video',
    };

    render(<NotificationItem notification={buildNotification()} />);

    fireEvent.click(screen.getByRole('button'));

    expect(mockNavigate).toHaveBeenCalledWith(
      `/profile/${nip19.npubEncode(ACTOR_PUBKEY)}`,
    );
  });

  it('navigates to the target video for non-follow notifications', () => {
    render(
      <NotificationItem
        notification={buildNotification({
          type: 'like',
          targetEventId: 'c'.repeat(64),
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(mockNavigate).toHaveBeenCalledWith(`/video/${'c'.repeat(64)}`);
  });
});
