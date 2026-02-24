// ABOUTME: Pure transform functions for notification API responses
// ABOUTME: Maps raw Funnelcake notification data to app-level Notification types

import type {
  Notification,
  NotificationType,
  NotificationsResponse,
  RawApiNotification,
  RawNotificationsApiResponse,
} from '@/types/notification';

/**
 * Map the API notification_type string to our app NotificationType.
 */
export function mapNotificationType(apiType: string): NotificationType {
  switch (apiType) {
    case 'reaction':
      return 'like';
    case 'reply':
      return 'comment';
    case 'follow':
      return 'follow';
    case 'repost':
      return 'repost';
    case 'zap':
      return 'zap';
    default:
      return 'like'; // Fallback for unknown types
  }
}

/**
 * Transform a single raw API notification to app Notification type.
 */
export function transformNotification(raw: RawApiNotification): Notification {
  const type = mapNotificationType(raw.notification_type);

  return {
    id: raw.id,
    type,
    actorPubkey: raw.source_pubkey,
    timestamp: raw.created_at,
    isRead: raw.read,
    targetEventId: raw.referenced_event_id,
    sourceEventId: raw.source_event_id,
    sourceKind: raw.source_kind,
    commentText: type === 'comment' ? raw.content : undefined,
  };
}

/**
 * Transform a full API response into the app NotificationsResponse.
 */
export function transformNotificationsResponse(
  raw: RawNotificationsApiResponse,
): NotificationsResponse {
  return {
    notifications: (raw.notifications ?? []).map(transformNotification),
    unreadCount: raw.unread_count ?? 0,
    nextCursor: raw.next_cursor,
    hasMore: raw.has_more ?? false,
  };
}

/**
 * Generate a human-readable notification message.
 *
 * @param type - The notification type
 * @param actorName - Display name of the actor (optional)
 */
export function generateNotificationMessage(
  type: NotificationType,
  actorName?: string,
): string {
  const name = actorName || 'Someone';

  switch (type) {
    case 'like':
      return `${name} liked your video`;
    case 'comment':
      return `${name} commented on your video`;
    case 'follow':
      return `${name} started following you`;
    case 'repost':
      return `${name} reposted your video`;
    case 'zap':
      return `${name} zapped your video`;
    default:
      return `${name} interacted with your content`;
  }
}

/**
 * Format a Unix timestamp into a relative time string.
 */
export function formatRelativeTime(timestampSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestampSeconds;

  if (diff < 60) return 'just now';
  if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    return `${mins}m ago`;
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours}h ago`;
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days}d ago`;
  }

  // Older than a week: show date
  const date = new Date(timestampSeconds * 1000);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
