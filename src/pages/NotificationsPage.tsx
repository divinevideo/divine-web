// ABOUTME: Notifications page showing social interactions (likes, comments, follows, reposts, zaps)
// ABOUTME: Simple list with infinite scroll, marks all as read on page open

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Bell } from '@phosphor-icons/react';
import { useNotifications, useMarkNotificationsRead } from '@/hooks/useNotifications';
import { NotificationItem } from '@/components/NotificationItem';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Notification, NotificationCategory } from '@/types/notification';

const NOTIFICATION_TABS: Array<{ value: NotificationCategory; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'likes', label: 'Likes' },
  { value: 'comments', label: 'Comments' },
  { value: 'follows', label: 'Follows' },
  { value: 'reposts', label: 'Reposts' },
  { value: 'zaps', label: 'Zaps' },
];

const EMPTY_STATE_COPY: Record<
  NotificationCategory,
  { title: string; description: string }
> = {
  all: {
    title: 'All quiet. Nothing to flag.',
    description: 'When people react to your stuff, it lands right here.',
  },
  unread: {
    title: 'You are all caught up.',
    description: 'New activity will show up here first.',
  },
  likes: {
    title: 'No like notifications yet.',
    description: 'When someone likes one of your videos, it will show up here.',
  },
  comments: {
    title: 'No comment notifications yet.',
    description: 'Replies and comments on your videos will show up here.',
  },
  follows: {
    title: 'No follow notifications yet.',
    description: 'New followers will show up here.',
  },
  reposts: {
    title: 'No repost notifications yet.',
    description: 'Reposts of your videos will show up here.',
  },
  zaps: {
    title: 'No zap notifications yet.',
    description: 'Zaps on your videos will show up here.',
  },
};

export default function NotificationsPage() {
  const [category, setCategory] = useState<NotificationCategory>('all');
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications({ category });

  const markRead = useMarkNotificationsRead();
  const hasCapturedInitialUnread = useRef(false);
  const [initialUnreadIds, setInitialUnreadIds] = useState<Set<string>>(() => new Set());

  // Flatten all pages into a single array of notifications
  const notifications: Notification[] = useMemo(
    () => data?.pages.flatMap((p) => p.notifications) ?? [],
    [data?.pages],
  );

  const newNotifications = useMemo(
    () => notifications.filter((notification) => initialUnreadIds.has(notification.id)),
    [notifications, initialUnreadIds],
  );

  const earlierNotifications = useMemo(
    () => notifications.filter((notification) => !initialUnreadIds.has(notification.id)),
    [notifications, initialUnreadIds],
  );

  // Mark all as read on page open (once, when first page loads).
  // Keep a snapshot of initially unread rows so the list can still show
  // what was new when the user arrived, even after optimistic updates flip
  // everything to read in the cache.
  useEffect(() => {
    if (category !== 'all') return;
    if (hasCapturedInitialUnread.current) return;
    if (notifications.length === 0) return;

    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    hasCapturedInitialUnread.current = true;

    if (unreadIds.length === 0) return;

    setInitialUnreadIds(new Set(unreadIds));
    markRead.mutate(undefined);
  }, [category, notifications, markRead]);

  const emptyState = EMPTY_STATE_COPY[category];

  const renderNotifications = (items: Notification[]) => (
    <div className="divide-y divide-border">
      {items.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  );

  // Infinite scroll observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        { rootMargin: '200px' },
      );

      observerRef.current.observe(node);
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" />
          Notifications
        </h1>
      </div>

      <Tabs value={category} onValueChange={(value) => setCategory(value as NotificationCategory)}>
        <TabsList className="mb-6 flex w-full justify-start overflow-x-auto">
          {NOTIFICATION_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="text-center py-12">
          <p className="text-destructive mb-2">Failed to load notifications</p>
          <p className="text-sm text-muted-foreground">
            {error?.message || 'Please try again later'}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && notifications.length === 0 && (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-1">{emptyState.title}</p>
          <p className="text-sm text-muted-foreground">{emptyState.description}</p>
        </div>
      )}

      {/* Notification list */}
      {notifications.length > 0 && (
        category === 'all' && initialUnreadIds.size > 0 ? (
          <div className="space-y-6">
            {newNotifications.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground">
                  New
                </h2>
                {renderNotifications(newNotifications)}
              </section>
            )}
            {earlierNotifications.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground">
                  Earlier
                </h2>
                {renderNotifications(earlierNotifications)}
              </section>
            )}
          </div>
        ) : (
          renderNotifications(notifications)
        )
      )}

      {/* Infinite scroll sentinel */}
      {hasNextPage && <div ref={sentinelRef} className="h-4" />}

      {/* Loading more indicator */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
