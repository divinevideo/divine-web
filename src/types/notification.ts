// ABOUTME: Type definitions for the notifications feature
// ABOUTME: RawNotification (fetch stage) + sealed VideoNotification|ActorNotification UI union

export type NotificationType = 'like' | 'comment' | 'follow' | 'repost';

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
  type: 'like' | 'comment' | 'repost';
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
  sourceEventId: string;
  sourceKind: number;
  commentText?: string;
  /** Comment to scroll to when opening the video's comment sheet. */
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
  /** Integer in the schema: 0 = unread, 1 = read. Not a boolean. */
  read: number;
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
  /** Specific comment to scroll to; set for `comment` and `reply`. */
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
