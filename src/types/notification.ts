// ABOUTME: Type definitions for the notifications feature
// ABOUTME: Maps Funnelcake API notification responses to app-level types

/** Notification types supported by the app */
export type NotificationType = 'like' | 'comment' | 'follow' | 'repost' | 'zap';

/** A single notification in app format */
export interface Notification {
  id: string;
  type: NotificationType;
  actorPubkey: string;
  timestamp: number;       // Unix seconds
  isRead: boolean;
  targetEventId?: string;  // The video being referenced
  sourceEventId: string;   // The event that caused the notification
  sourceKind: number;
  commentText?: string;    // For comment notifications
}

/** Paginated response from the notifications API */
export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  nextCursor?: string;
  hasMore: boolean;
}

/** Raw notification shape from Funnelcake API */
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

/** Raw paginated response from Funnelcake API */
export interface RawNotificationsApiResponse {
  notifications: RawApiNotification[];
  unread_count: number;
  next_cursor?: string;
  has_more: boolean;
}
