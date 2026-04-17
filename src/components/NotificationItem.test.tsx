import { render, screen } from '@testing-library/react';
import type { HTMLAttributes, ImgHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Notification } from '@/types/notification';
import { NotificationItem } from './NotificationItem';

const mockNavigate = vi.fn();
const mockUseAuthor = vi.fn();

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: (pubkey?: string) => mockUseAuthor(pubkey),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AvatarImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
  AvatarFallback: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/lib/genUserName', () => ({
  genUserName: (pubkey: string) => `Generated ${pubkey.slice(0, 6)}`,
}));

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    type: 'repost',
    actorPubkey: 'a'.repeat(64),
    timestamp: 1700000000,
    isRead: false,
    targetEventId: 'video-1',
    sourceEventId: 'source-event-1',
    sourceKind: 6,
    ...overrides,
  };
}

describe('NotificationItem', () => {
  it('shows referenced video context for repost notifications', () => {
    mockUseAuthor.mockReturnValue({
      data: {
        metadata: {
          name: 'Fallback Name',
          picture: 'https://example.com/fallback-avatar.jpg',
        },
      },
    });

    render(
      <NotificationItem
        notification={{
          ...makeNotification(),
          sourceProfile: {
            displayName: 'Alice',
            picture: 'https://example.com/alice.jpg',
            nip05: 'alice@example.com',
          },
          referencedVideo: {
            title: 'Beach Day Sunset',
            thumbnail: 'https://example.com/thumb.jpg',
            dTag: 'sha256-tag',
          },
        } as Notification}
      />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Beach Day Sunset')).toBeInTheDocument();
    expect(screen.getByAltText('Beach Day Sunset')).toBeInTheDocument();
  });

  it('keeps comment text alongside the referenced video context', () => {
    mockUseAuthor.mockReturnValue({ data: { metadata: { name: 'Fallback Name' } } });

    render(
      <NotificationItem
        notification={{
          ...makeNotification({
            type: 'comment',
            commentText: 'This is amazing, love the editing',
          }),
          referencedVideo: {
            title: 'Beach Day Sunset',
            thumbnail: 'https://example.com/thumb.jpg',
            dTag: 'sha256-tag',
          },
        } as Notification}
      />,
    );

    expect(screen.getByText('Beach Day Sunset')).toBeInTheDocument();
    expect(screen.getByText('This is amazing, love the editing')).toBeInTheDocument();
  });

  it('does not render an empty video preview when enrichment is missing', () => {
    mockUseAuthor.mockReturnValue({ data: { metadata: { name: 'Fallback Name' } } });

    render(<NotificationItem notification={makeNotification()} />);

    expect(screen.queryByTestId('notification-video-preview')).not.toBeInTheDocument();
  });
});
