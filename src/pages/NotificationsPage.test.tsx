import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Notification } from '@/types/notification';
import { initializeI18n } from '@/lib/i18n';
import NotificationsPage from './NotificationsPage';

const { mockMarkReadMutate, mockUseNotifications } = vi.hoisted(() => ({
  mockMarkReadMutate: vi.fn(),
  mockUseNotifications: vi.fn(),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: (filters?: { category?: string }) => mockUseNotifications(filters),
  useMarkNotificationsRead: () => ({
    mutate: mockMarkReadMutate,
  }),
}));

vi.mock('@/components/NotificationItem', () => ({
  NotificationItem: ({ notification }: { notification: Notification }) => (
    <div>{notification.id}</div>
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div>loading</div>,
}));

function buildNotification(overrides: Partial<Notification>): Notification {
  return {
    id: 'notification-1',
    type: 'like',
    actorPubkey: 'a'.repeat(64),
    timestamp: 1_700_000_000,
    isRead: true,
    sourceEventId: 'b'.repeat(64),
    sourceKind: 7,
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

    mockUseNotifications.mockImplementation((filters?: { category?: string }) => {
      const category = filters?.category ?? 'all';

      if (category === 'likes') {
        return {
          data: {
            pages: [
              {
                notifications: [
                  buildNotification({ id: 'like-1', type: 'like', isRead: true }),
                ],
              },
            ],
          },
          isLoading: false,
          isError: false,
          error: null,
          fetchNextPage: vi.fn(),
          hasNextPage: false,
          isFetchingNextPage: false,
        };
      }

      return {
        data: {
          pages: [
            {
              notifications: [
                buildNotification({ id: 'new-1', isRead: false }),
                buildNotification({ id: 'earlier-1', type: 'follow', isRead: true }),
              ],
            },
          ],
        },
        isLoading: false,
        isError: false,
        error: null,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
      };
    });
  });

  it('shows New and Earlier sections and marks all read on open', async () => {
    render(<NotificationsPage />);

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Likes')).toBeInTheDocument();
    expect(await screen.findByText('New')).toBeInTheDocument();
    expect(screen.getByText('Earlier')).toBeInTheDocument();
    expect(screen.getByText('new-1')).toBeInTheDocument();
    expect(screen.getByText('earlier-1')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockMarkReadMutate).toHaveBeenCalledWith(undefined);
    });
  });

  it('switches to a category tab and shows the filtered notification list', async () => {
    const user = userEvent.setup();

    render(<NotificationsPage />);

    await user.click(screen.getByRole('tab', { name: 'Likes' }));

    expect(await screen.findByText('like-1')).toBeInTheDocument();
    expect(screen.queryByText('new-1')).not.toBeInTheDocument();
    expect(screen.queryByText('Earlier')).not.toBeInTheDocument();
  });
});
