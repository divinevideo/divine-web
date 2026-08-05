// ABOUTME: Type definitions for the notifications feature
// ABOUTME: RawNotification (fetch stage) + sealed VideoNotification|ActorNotification UI union

/**
 * `commentLike` has no API counterpart. The backend emits `reaction` for every
 * kind 7; `target_comment_id` is what separates a like on your comment from a
 * like on your video, and the two need different copy and different buckets.
 */
export type NotificationType = 'like' | 'commentLike' | 'comment' | 'follow' | 'repost';

/**
 * Values the notifications endpoint actually emits for `notification_type`.
 * Source: `components.schemas.Notification` in https://api.divine.video/openapi.json
 * — `reaction`, `reply`, `repost`, `mention`, `comment`, `follow`, `zap`, `list_add`.
 *
 * Only the subset we request or render is named here; `mention`, `zap`, and
 * `list_add` are deliberately not surfaced (see `mapNotificationType`).
 */
export type NotificationApiType = 'reaction' | 'reply' | 'comment' | 'follow' | 'repost';

export type NotificationCategory =
  | 'all'
  | 'unread'
  | 'likes'
  | 'comments'
  | 'follows'
  | 'reposts';

export interface NotificationFilters {
  category: NotificationCategory;
}

export interface ActorInfo {
  pubkey: string;
  displayName: string;
  avatarUrl?: string;
  nip05?: string;
}

interface BaseGroupedNotification {
  id: string;
  rawIds: string[];
  timestamp: number;
  isRead: boolean;
}

export interface VideoNotification extends BaseGroupedNotification {
  kind: 'video';
  type: 'like' | 'commentLike' | 'comment' | 'repost';
  videoEventId: string;
  videoTitle?: string;
  videoThumbnailUrl?: string;
  actors: ActorInfo[];
  totalCount: number;
  commentText?: string;
}

export interface ActorNotification extends BaseGroupedNotification {
  kind: 'actor';
  type: 'follow';
  actor: ActorInfo;
}

export type NotificationItem = VideoNotification | ActorNotification;

export interface RawNotification {
  id: string;
  type: NotificationType;
  actorPubkey: string;
  timestamp: number;
  isRead: boolean;
  targetEventId?: string;
  /**
   * Stable identity of the target for grouping purposes.
   *
   * `targetEventId` is whatever the app can *resolve* — a hex event id for some
   * rows and a d-tag for others, depending on how the reposting client tagged
   * the event. Bucketing on it splits one video across two rows. The addressable
   * coordinate is the same for both shapes, so it is what identity keys off.
   */
  groupingKey?: string;
  sourceEventId: string;
  sourceKind: number;
  commentText?: string;
  /**
   * The comment this notification concerns, when there is one.
   *
   * Carried through from `target_comment_id` but not yet consumed: the rows
   * navigate to the video, and VideoPage has no comment anchor to land on. Kept
   * because it is the signal that distinguishes a like on your comment from a
   * like on your video — see the note in `mapNotificationType`.
   */
  targetCommentId?: string;
  /** Actor profile embedded in the response, when the API supplied one. */
  actorProfile?: EmbeddedActorProfile;
  /** Video metadata embedded in the response, when the API supplied one. */
  videoMeta?: EmbeddedVideoMeta;
}

export interface EmbeddedActorProfile {
  displayName?: string;
  avatarUrl?: string;
  nip05?: string;
}

export interface EmbeddedVideoMeta {
  title?: string;
  thumbnailUrl?: string;
}

export interface NotificationsResponse {
  notifications: RawNotification[];
  unreadCount: number;
  nextCursor?: string;
  hasMore: boolean;
}

/** Embedded actor profile — `NotificationSourceProfile` in the OpenAPI schema. */
export interface RawApiSourceProfile {
  display_name?: string | null;
  picture?: string | null;
  nip05?: string | null;
}

/** Embedded video metadata — `NotificationReferencedVideo` in the OpenAPI schema. */
export interface RawApiReferencedVideo {
  title?: string | null;
  thumbnail?: string | null;
  d_tag?: string | null;
  blurhash?: string | null;
}

/**
 * One row of `GET /api/notifications`, mirroring `components.schemas.Notification`.
 *
 * Note there is no `id` property — the response identifies a notification by
 * `source_event_id`. Anything modelled here that the schema does not return
 * silently becomes `undefined` at runtime, so keep this in step with
 * https://api.divine.video/openapi.json.
 */
export interface RawApiNotification {
  source_pubkey: string;
  source_event_id: string;
  source_kind: number;
  notification_type: string;
  created_at: number;
  /**
   * The schema and the serializer disagree: `components.schemas.Notification`
   * declares `{"type": "integer", "minimum": 0}`, but the Rust struct carries
   * `#[serde(serialize_with = "serialize_u8_as_bool")]`, so the wire value is
   * `true`/`false`. Accept either and let `Boolean()` in the transform settle
   * it — do not narrow this to one of the two, and do not compare against `1`.
   */
  read: number | boolean;
  content?: string | null;
  /** Reaction/repost target, or for kind 1111 the NIP-22 lowercase `e` (parent). */
  referenced_event_id?: string | null;
  /** Root navigation target. Prefer this over `referenced_event_id`. */
  root_event_id?: string | null;
  /** Root video d-tag. Resolvable by `/api/videos/{id}` and `/video/:id`. */
  root_d_tag?: string | null;
  /** d-tag of the referenced addressable event. */
  referenced_d_tag?: string | null;
  /**
   * `kind:pubkey:d-tag` root, populated for addressable targets. Not a
   * resolvable identifier — see `resolveTargetEventId`.
   */
  root_addressable_id?: string | null;
  /**
   * The comment this notification concerns.
   *
   * Set for `comment` and `reply` (where it equals `source_event_id`), and
   * ALSO for a `reaction` whose referenced event is a kind 1111 comment —
   * which is what separates a like on your comment from a like on your video.
   * The published OpenAPI description still says "`None` for other types";
   * that text is stale. The materializer sets it from the referenced event at
   * divine-funnelcake `crates/clickhouse/src/client.rs` (`target_comment_id`),
   * and `mapNotificationType` depends on that behaviour.
   */
  target_comment_id?: string | null;
  referenced_event_title?: string | null;
  referenced_video?: RawApiReferencedVideo | null;
  source_profile?: RawApiSourceProfile | null;
  comment_content?: string | null;
}

export interface RawNotificationsApiResponse {
  notifications: RawApiNotification[];
  unread_count: number;
  next_cursor?: string;
  has_more: boolean;
}
