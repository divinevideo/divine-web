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

/** `kind:pubkey:d-tag`, e.g. `34236:<64-hex>:my-vine`. */
const ADDRESSABLE_COORDINATE = /^\d+:[0-9a-f]{64}:/i;

/**
 * Reduce an identifier to something the app can actually resolve.
 *
 * `/api/videos/{id}` documents exactly two accepted forms — a 64-char event id
 * or a d-tag — and `/video/:id` resolves through it. A full `kind:pubkey:d-tag`
 * coordinate is neither: the single lookup 404s and `/api/videos/bulk` returns
 * 500 for the whole batch, so one addressable row would strand every thumbnail
 * on the page. The d-tag suffix does resolve, so that is what we keep.
 */
function toResolvableIdentifier(value: string | null | undefined): string | undefined {
  if (!value) return undefined;

  const coordinate = ADDRESSABLE_COORDINATE.exec(value);
  // d-tags may themselves contain ':', so keep everything after kind:pubkey.
  return (coordinate ? value.slice(coordinate[0].length) : value) || undefined;
}

/**
 * Resolve the event this notification points at.
 *
 * `root_event_id` is the API's designated navigation target: for kind 1111
 * comments and replies it is the NIP-22 uppercase `E` tag (the video), whereas
 * `referenced_event_id` is the lowercase `e` (the parent comment). Reposts
 * published with only an `a` tag — which is what divine-web itself publishes —
 * have no 64-char event id at all, so we fall back to the d-tag the response
 * carries alongside the coordinate.
 */
function resolveTargetEventId(raw: RawApiNotification): string | undefined {
  return (
    toResolvableIdentifier(raw.root_event_id) ??
    toResolvableIdentifier(raw.referenced_event_id) ??
    toResolvableIdentifier(raw.root_d_tag) ??
    toResolvableIdentifier(raw.referenced_d_tag) ??
    toResolvableIdentifier(raw.referenced_video?.d_tag) ??
    toResolvableIdentifier(raw.root_addressable_id)
  );
}

/**
 * Resolve the identity used to group rows about the same video.
 *
 * `resolveTargetEventId` answers "what can we fetch and navigate to", and its
 * answer legitimately differs per row: divine-web publishes reposts with only an
 * `a` tag, so those resolve to a d-tag, while divine-mobile adds an `e` tag and
 * those resolve to a hex event id. Keying buckets on that value splits a single
 * video into two rows the moment it is reposted from both clients.
 *
 * `root_addressable_id` is derived from the `a` tag (or the resolved event) in
 * both shapes, so it is identical across them and is the stable identity. It is
 * deliberately *not* used for fetching — see `toResolvableIdentifier`.
 */
function resolveGroupingKey(raw: RawApiNotification): string | undefined {
  return raw.root_addressable_id || undefined;
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
    // `read` is an integer (0/1) on the wire. Coerce rather than pass through:
    // RawNotification.isRead is a boolean and grouping copies it straight onto
    // ActorNotification, so an uncoerced 0 reaches the UI union as a number.
    isRead: Boolean(raw.read),
    targetEventId,
    groupingKey: resolveGroupingKey(raw) ?? targetEventId,
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
