import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationItem, VideoNotification, ActorNotification } from '@/types/notification';
import { initializeI18n } from '@/lib/i18n';
import NotificationsPage from './NotificationsPage';

const { mockMarkReadMutate, mockUseHydratedNotifications } = vi.hoisted(() => ({
  mockMarkReadMutate: vi.fn(),
  mockUseHydratedNotifications: vi.fn(),
}));

vi.mock('@/hooks/useHydratedNotifications', () => ({
  useHydratedNotifications: (filters?: { category?: string }) =>
    mockUseHydratedNotifications(filters),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useMarkNotificationsRead: () => ({
    mutate: mockMarkReadMutate,
  }),
}));

vi.mock('@/components/notifications/NotificationRows', () => ({
  VideoNotificationRow: ({ notification }: { notification: VideoNotification }) => (
    <div data-testid="video-notification-row">{notification.id}</div>
  ),
  ActorNotificationRow: ({ notification }: { notification: ActorNotification }) => (
    <div data-testid="actor-notification-row">{notification.id}</div>
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div>loading</div>,
}));

function buildVideoNotification(overrides: Partial<VideoNotification> = {}): VideoNotification {
  return {
    id: 'video-notif-1',
    kind: 'video',
    type: 'like',
    rawIds: ['raw-1'],
    timestamp: 1_700_000_000,
    isRead: true,
    videoEventId: 'a'.repeat(64),
    videoTitle: 'Test Video',
    actors: [{ pubkey: 'b'.repeat(64), displayName: 'Alice' }],
    totalCount: 1,
    ...overrides,
  };
}

function buildActorNotification(overrides: Partial<ActorNotification> = {}): ActorNotification {
  return {
    id: 'actor-notif-1',
    kind: 'actor',
    type: 'follow',
    rawIds: ['raw-2'],
    timestamp: 1_700_000_000,
    isRead: true,
    actor: { pubkey: 'c'.repeat(64), displayName: 'Bob' },
    ...overrides,
  };
}

function makeHookResult(items: NotificationItem[], overrides = {}) {
  return {
    items,
    isLoading: false,
    isError: false,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    unreadCount: 0,
    ...overrides,
  };
}

describe('NotificationsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });
    await initializeI18n({ force: true, languages: ['en-US'] });

    mockUseHydratedNotifications.mockImplementation((filters?: { category?: string }) => {
      const category = filters?.category ?? 'all';

      if (category === 'likes') {
        return makeHookResult([
          buildVideoNotification({ id: 'like-1', type: 'like', isRead: true }),
        ]);
      }

      return makeHookResult([
        buildVideoNotification({ id: 'new-1', rawIds: ['raw-new-1'], isRead: false }),
        buildActorNotification({ id: 'earlier-1', rawIds: ['raw-earlier-1'], isRead: true }),
      ]);
    });
  });

  it('renders All, Unread, Likes, Comments, Follows, Reposts tabs and NOT Zaps', async () => {
    render(<NotificationsPage />);

    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Unread' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Likes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Comments' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Follows' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Reposts' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Zaps' })).not.toBeInTheDocument();
  });

  it('shows New and Earlier sections and marks all read on open (category all)', async () => {
    render(<NotificationsPage />);

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(await screen.findByText('New')).toBeInTheDocument();
    expect(screen.getByText('Earlier')).toBeInTheDocument();
    expect(screen.getByText('new-1')).toBeInTheDocument();
    expect(screen.getByText('earlier-1')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockMarkReadMutate).toHaveBeenCalledWith(undefined);
    });
  });

  it('renders VideoNotificationRow for video kind and ActorNotificationRow for actor kind', async () => {
    render(<NotificationsPage />);

    await screen.findByText('new-1');

    expect(screen.getAllByTestId('video-notification-row').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('actor-notification-row').length).toBeGreaterThan(0);
  });

  it('switches to Likes tab and shows video rows without New/Earlier split', async () => {
    const user = userEvent.setup();

    render(<NotificationsPage />);

    await user.click(screen.getByRole('tab', { name: 'Likes' }));

    expect(await screen.findByText('like-1')).toBeInTheDocument();
    expect(screen.queryByText('new-1')).not.toBeInTheDocument();
    expect(screen.queryByText('Earlier')).not.toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument();
  });

  it('category unread does NOT use the New/Earlier split', async () => {
    mockUseHydratedNotifications.mockImplementation((filters?: { category?: string }) => {
      const category = filters?.category ?? 'all';
      if (category === 'unread') {
        return makeHookResult([
          buildVideoNotification({ id: 'unread-1', rawIds: ['raw-u-1'], isRead: false }),
        ]);
      }
      return makeHookResult([]);
    });

    const user = userEvent.setup();
    render(<NotificationsPage />);

    await user.click(screen.getByRole('tab', { name: 'Unread' }));

    expect(await screen.findByText('unread-1')).toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.queryByText('Earlier')).not.toBeInTheDocument();
  });
});
