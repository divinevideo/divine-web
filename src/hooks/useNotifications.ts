// ABOUTME: React Query hooks for notification data fetching and mutations
// ABOUTME: Provides infinite scroll, unread count polling, and mark-as-read

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchNotifications, fetchUnreadCount, markNotificationsRead } from '@/lib/funnelcakeClient';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';
import { debugLog } from '@/lib/debug';
import type { NotificationsResponse } from '@/types/notification';

const NOTIFICATIONS_PAGE_SIZE = 30;

/**
 * Infinite query for paginated notifications list.
 * Fetches pages of notifications with cursor-based pagination.
 */
export function useNotifications() {
  const { user } = useCurrentUser();
  const pubkey = user?.pubkey;
  const signer = user?.signer;
  const apiUrl = DEFAULT_FUNNELCAKE_URL;

  return useInfiniteQuery<NotificationsResponse, Error>({
    queryKey: ['notifications', pubkey],

    queryFn: async ({ pageParam, signal }) => {
      if (!pubkey || !signer) {
        return { notifications: [], unreadCount: 0, hasMore: false };
      }

      debugLog('[useNotifications] Fetching page', { before: pageParam });

      return fetchNotifications(apiUrl, pubkey, signer, {
        limit: NOTIFICATIONS_PAGE_SIZE,
        before: pageParam as string | undefined,
        signal,
      });
    },

    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || !lastPage.nextCursor) return undefined;
      return lastPage.nextCursor;
    },

    initialPageParam: undefined as string | undefined,

    enabled: !!pubkey && !!signer,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Lightweight polling query for the unread notification count.
 * Used by the notification bell badge in header and bottom nav.
 * Polls every 60 seconds and on window focus.
 */
export function useUnreadNotificationCount() {
  const { user } = useCurrentUser();
  const pubkey = user?.pubkey;
  const signer = user?.signer;
  const apiUrl = DEFAULT_FUNNELCAKE_URL;

  return useQuery<number, Error>({
    queryKey: ['notifications-unread-count', pubkey],

    queryFn: async ({ signal }) => {
      if (!pubkey || !signer) return 0;

      debugLog('[useNotifications] Fetching unread count');
      return fetchUnreadCount(apiUrl, pubkey, signer, signal);
    },

    enabled: !!pubkey && !!signer,
    staleTime: 30 * 1000,      // 30 seconds
    gcTime: 5 * 60 * 1000,     // 5 minutes
    refetchInterval: 60 * 1000, // Poll every 60 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Mutation hook for marking notifications as read.
 * Uses optimistic updates: immediately marks as read in the cache,
 * then syncs to server in the background.
 */
export function useMarkNotificationsRead() {
  const { user } = useCurrentUser();
  const pubkey = user?.pubkey;
  const signer = user?.signer;
  const apiUrl = DEFAULT_FUNNELCAKE_URL;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationIds?: string[]) => {
      if (!pubkey || !signer) {
        throw new Error('Not authenticated');
      }
      return markNotificationsRead(apiUrl, pubkey, signer, notificationIds);
    },

    onMutate: async (notificationIds) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notifications', pubkey] });
      await queryClient.cancelQueries({ queryKey: ['notifications-unread-count', pubkey] });

      // Snapshot previous values for potential rollback
      const previousNotifications = queryClient.getQueryData(['notifications', pubkey]);
      const previousCount = queryClient.getQueryData(['notifications-unread-count', pubkey]);

      // Optimistic update: mark notifications as read in cache
      queryClient.setQueryData(
        ['notifications', pubkey],
        (old: { pages: NotificationsResponse[]; pageParams: unknown[] } | undefined) => {
          if (!old) return old;
          const idsSet = notificationIds ? new Set(notificationIds) : null;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              notifications: page.notifications.map((n) => {
                if (!idsSet || idsSet.has(n.id)) {
                  return { ...n, isRead: true };
                }
                return n;
              }),
            })),
          };
        },
      );

      // Optimistic update: set unread count to 0 if marking all, else decrement
      if (!notificationIds || notificationIds.length === 0) {
        queryClient.setQueryData(['notifications-unread-count', pubkey], 0);
      } else {
        queryClient.setQueryData(
          ['notifications-unread-count', pubkey],
          (old: number | undefined) => Math.max(0, (old ?? 0) - notificationIds.length),
        );
      }

      return { previousNotifications, previousCount };
    },

    // On server error, don't revert (per plan: server will sync on next refresh)
    onSettled: () => {
      // Refetch in background to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', pubkey] });
    },
  });
}
