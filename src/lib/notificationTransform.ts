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
 *
 * The endpoint emits `reaction`, `reply`, `repost`, `mention`, `comment`,
 * `follow`, `zap`, and `list_add`. We render four of them:
 *
 * - `reply` and `comment` are both comments to the reader. The backend splits
 *   them (top-level comment vs threaded reply); the distinction is carried by
 *   `reply_context`, not by a separate row type in the UI.
 * - `mention` is the materializer's catch-all for any source kind it does not
 *   recognise, so it has no single truthful verb. Relabelling it as a like put
 *   false statements on screen and inflated like counts, because grouping
 *   buckets on target + type. It is dropped until it has a real render path.
 * - `zap` is hidden by product decision; `list_add` has no row design yet.
 */
export function mapNotificationType(apiType: string): NotificationType | null {
  switch (apiType) {
    case 'reaction':
      return 'like';
    case 'reply':
    case 'comment':
      return 'comment';
    case 'follow':
      return 'follow';
    case 'repost':
      return 'repost';
    default:
      return null;
  }
}

/**
 * Resolve the event this notification points at.
 *
 * `root_event_id` is the API's designated navigation target: for kind 1111
 * comments and replies it is the NIP-22 uppercase `E` tag (the video), whereas
 * `referenced_event_id` is the lowercase `e` (the parent comment). Reposts
 * published with only an `a` tag — which is what divine-web itself publishes —
 * have no 64-char event id at all and are addressed by `root_addressable_id`.
 */
function resolveTargetEventId(raw: RawApiNotification): string | undefined {
  return raw.root_event_id || raw.referenced_event_id || raw.root_addressable_id || undefined;
}

function resolveActorProfile(raw: RawApiNotification): RawNotification['actorProfile'] {
  const profile = raw.source_profile;
  if (!profile) return undefined;

  return {
    displayName: profile.display_name ?? undefined,
    avatarUrl: profile.picture ?? undefined,
    nip05: profile.nip05 ?? undefined,
  };
}

function resolveVideoMeta(raw: RawApiNotification): RawNotification['videoMeta'] {
  const video = raw.referenced_video;
  const title = video?.title ?? raw.referenced_event_title ?? undefined;
  const thumbnailUrl = video?.thumbnail ?? undefined;

  if (!title && !thumbnailUrl) return undefined;

  return { title, thumbnailUrl };
}

/**
 * Transform a single raw API notification to app RawNotification type.
 * Returns null when:
 * - the type maps to null (mention, zap, list_add, unknown)
 * - type is not 'follow' and no target event can be resolved
 */
export function transformNotification(raw: RawApiNotification): RawNotification | null {
  const type = mapNotificationType(raw.notification_type);

  if (type === null) {
    return null;
  }

  const targetEventId = resolveTargetEventId(raw);

  if (type !== 'follow' && !targetEventId) {
    return null;
  }

  return {
    // The response carries no `id`; source_event_id is the stable identity.
    id: raw.source_event_id,
    type,
    actorPubkey: raw.source_pubkey,
    timestamp: raw.created_at,
    isRead: raw.read,
    targetEventId,
    sourceEventId: raw.source_event_id,
    sourceKind: raw.source_kind,
    commentText:
      type === 'comment' ? raw.comment_content ?? raw.content ?? undefined : undefined,
    targetCommentId: raw.target_comment_id ?? undefined,
    actorProfile: resolveActorProfile(raw),
    videoMeta: resolveVideoMeta(raw),
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
