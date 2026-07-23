// ABOUTME: Pure transform functions for notification API responses
// ABOUTME: Maps raw Funnelcake notification data to app-level RawNotification types

import type {
  NotificationType,
  NotificationsResponse,
  RawApiNotification,
  RawNotification,
  RawNotificationsApiResponse,
} from '@/types/notification';

/**
 * Map the API notification_type string to our app NotificationType.
 * Returns null for 'zap' and unknown types (they are filtered out).
 */
export function mapNotificationType(apiType: string): NotificationType | null {
  switch (apiType) {
    case 'reaction':
      return 'like';
    case 'reply':
      return 'comment';
    case 'follow':
      return 'follow';
    case 'repost':
      return 'repost';
    case 'mention':
      return 'like';
    default:
      return null;
  }
}

/**
 * Transform a single raw API notification to app RawNotification type.
 * Returns null when:
 * - the type maps to null (zap, unknown)
 * - type is not 'follow' and referenced_event_id is missing
 */
export function transformNotification(raw: RawApiNotification): RawNotification | null {
  const type = mapNotificationType(raw.notification_type);

  if (type === null) {
    return null;
  }

  if (type !== 'follow' && !raw.referenced_event_id) {
    return null;
  }

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
 * Deduplicate follow notifications — keep only the most recent per actor.
 * Sorts newest-first before deduping so behavior does not depend on API order.
 */
export function deduplicateFollows(notifications: RawNotification[]): RawNotification[] {
  // Sort newest-first so the first occurrence we encounter per actor is always the newest
  const sorted = [...notifications].sort((a, b) => b.timestamp - a.timestamp);

  const seenFollows = new Set<string>();
  const result: RawNotification[] = [];

  for (const n of sorted) {
    if (n.type !== 'follow') {
      result.push(n);
    } else if (!seenFollows.has(n.actorPubkey)) {
      seenFollows.add(n.actorPubkey);
      result.push(n);
    }
  }

  return result;
}

/**
 * Transform a full API response into the app NotificationsResponse.
 */
export function transformNotificationsResponse(
  raw: RawNotificationsApiResponse,
): NotificationsResponse {
  const transformed = (raw.notifications ?? [])
    .map(transformNotification)
    .filter((n): n is RawNotification => n !== null);

  return {
    notifications: deduplicateFollows(transformed),
    unreadCount: raw.unread_count ?? 0,
    nextCursor: raw.next_cursor,
    hasMore: raw.has_more ?? false,
  };
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
