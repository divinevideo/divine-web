// ABOUTME: Type definitions for the notifications feature
// ABOUTME: RawNotification (fetch stage) + sealed VideoNotification|ActorNotification UI union

export type NotificationType = 'like' | 'comment' | 'follow' | 'repost';
export type NotificationApiType = 'reaction' | 'reply' | 'follow' | 'repost' | 'mention';

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
}

export interface NotificationsResponse {
  notifications: RawNotification[];
  unreadCount: number;
  nextCursor?: string;
  hasMore: boolean;
}

export interface RawApiNotification {
  id: string;
  source_pubkey: string;
  source_event_id: string;
  source_kind: number;
  referenced_event_id?: string;
  notification_type: string;
  created_at: number;
  read: boolean;
  content?: string;
}

export interface RawNotificationsApiResponse {
  notifications: RawApiNotification[];
  unread_count: number;
  next_cursor?: string;
  has_more: boolean;
}
