// ABOUTME: Notifications page showing social interactions (likes, comments, follows, reposts, zaps)
// ABOUTME: Simple list with infinite scroll, marks all as read on page open

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications, useMarkNotificationsRead } from '@/hooks/useNotifications';
import { NotificationItem } from '@/components/NotificationItem';
import { Skeleton } from '@/components/ui/skeleton';
import type { Notification } from '@/types/notification';
import { AppPage, AppPageHeader } from '@/components/AppPage';

export default function NotificationsPage() {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications();

  const markRead = useMarkNotificationsRead();
  const hasMarkedRead = useRef(false);

  // Flatten all pages into a single array of notifications
  const notifications: Notification[] = useMemo(
    () => data?.pages.flatMap((p) => p.notifications) ?? [],
    [data?.pages],
  );

  // Mark all as read on page open (once, when first page loads)
  useEffect(() => {
    if (hasMarkedRead.current) return;
    if (notifications.length === 0) return;

    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length > 0) {
      hasMarkedRead.current = true;
      markRead.mutate(unreadIds);
    }
  }, [notifications, markRead]);

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
    <AppPage width="feed">
      <AppPageHeader
        eyebrow="Inbox activity"
        title={(
          <span className="inline-flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notifications
          </span>
        )}
        description="Likes, comments, follows, reposts, and other signals from around the network."
      />

      {/* Loading skeleton */}
      {isLoading && (
        <div className="app-surface space-y-4 px-3 py-3 sm:px-4">
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
        <div className="app-surface py-12 text-center">
          <p className="text-destructive mb-2">Failed to load notifications</p>
          <p className="text-sm text-muted-foreground">
            {error?.message || 'Please try again later'}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && notifications.length === 0 && (
        <div className="app-surface py-16 text-center">
          <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-1">No notifications yet</p>
          <p className="text-sm text-muted-foreground">
            When people interact with your content, you'll see it here
          </p>
        </div>
      )}

      {/* Notification list */}
      {notifications.length > 0 && (
        <div className="app-surface overflow-hidden divide-y divide-border/80">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasNextPage && <div ref={sentinelRef} className="h-4" />}

      {/* Loading more indicator */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </AppPage>
  );
}
