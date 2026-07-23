// ABOUTME: Tests for notification transform functions
// ABOUTME: Verifies API response mapping to app types

import { describe, it, expect } from 'vitest';
import {
  mapNotificationType,
  transformNotification,
  transformNotificationsResponse,
  deduplicateFollows,
  formatRelativeTime,
} from './notificationTransform';
import type { RawApiNotification, RawNotificationsApiResponse, RawNotification } from '@/types/notification';

describe('notificationTransform', () => {
  describe('mapNotificationType', () => {
    it('maps "reaction" to "like"', () => {
      expect(mapNotificationType('reaction')).toBe('like');
    });

    it('maps "reply" to "comment"', () => {
      expect(mapNotificationType('reply')).toBe('comment');
    });

    it('maps "follow" to "follow"', () => {
      expect(mapNotificationType('follow')).toBe('follow');
    });

    it('maps "repost" to "repost"', () => {
      expect(mapNotificationType('repost')).toBe('repost');
    });

    it('returns null for "zap"', () => {
      expect(mapNotificationType('zap')).toBeNull();
    });

    it('returns null for unknown types', () => {
      expect(mapNotificationType('unknown')).toBeNull();
      expect(mapNotificationType('')).toBeNull();
    });

    it('preserves "mention" notifications through the existing video path', () => {
      expect(mapNotificationType('mention')).toBe('like');
    });
  });

  describe('transformNotification', () => {
    const raw: RawApiNotification = {
      id: 'notif-123',
      source_pubkey: 'abc123',
      source_event_id: 'event-456',
      source_kind: 7,
      referenced_event_id: 'video-789',
      notification_type: 'reaction',
      created_at: 1700000000,
      read: false,
      content: '+',
    };

    it('transforms a reaction notification', () => {
      const result = transformNotification(raw);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('notif-123');
      expect(result!.type).toBe('like');
      expect(result!.actorPubkey).toBe('abc123');
      expect(result!.timestamp).toBe(1700000000);
      expect(result!.isRead).toBe(false);
      expect(result!.targetEventId).toBe('video-789');
      expect(result!.sourceEventId).toBe('event-456');
      expect(result!.sourceKind).toBe(7);
      expect(result!.commentText).toBeUndefined();
    });

    it('includes commentText for reply notifications', () => {
      const reply: RawApiNotification = {
        ...raw,
        notification_type: 'reply',
        source_kind: 1111,
        content: 'Great video!',
      };
      const result = transformNotification(reply);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('comment');
      expect(result!.commentText).toBe('Great video!');
    });

    it('does not include commentText for non-reply types', () => {
      const result = transformNotification(raw);
      expect(result!.commentText).toBeUndefined();
    });

    it('returns null for zap notifications', () => {
      const zap: RawApiNotification = {
        ...raw,
        notification_type: 'zap',
      };
      expect(transformNotification(zap)).toBeNull();
    });

    it('returns null for unknown notification types', () => {
      const unknown: RawApiNotification = {
        ...raw,
        notification_type: 'unknown_type',
      };
      expect(transformNotification(unknown)).toBeNull();
    });

    it('transforms mention notifications instead of dropping them', () => {
      const mention: RawApiNotification = {
        ...raw,
        notification_type: 'mention',
        source_kind: 1,
      };

      const result = transformNotification(mention);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('like');
      expect(result!.targetEventId).toBe('video-789');
    });

    it('returns null for like without referenced_event_id', () => {
      const noRef: RawApiNotification = {
        ...raw,
        notification_type: 'reaction',
        referenced_event_id: undefined,
      };
      expect(transformNotification(noRef)).toBeNull();
    });

    it('returns null for comment without referenced_event_id', () => {
      const noRef: RawApiNotification = {
        ...raw,
        notification_type: 'reply',
        referenced_event_id: undefined,
        content: 'hello',
      };
      expect(transformNotification(noRef)).toBeNull();
    });

    it('returns null for repost without referenced_event_id', () => {
      const noRef: RawApiNotification = {
        ...raw,
        notification_type: 'repost',
        referenced_event_id: undefined,
      };
      expect(transformNotification(noRef)).toBeNull();
    });

    it('preserves follow rows without referenced_event_id', () => {
      const follow: RawApiNotification = {
        id: 'notif-follow',
        source_pubkey: 'follower-pk',
        source_event_id: 'follow-event',
        source_kind: 3,
        notification_type: 'follow',
        created_at: 1700000000,
        read: false,
        // no referenced_event_id
      };
      const result = transformNotification(follow);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('follow');
      expect(result!.targetEventId).toBeUndefined();
    });
  });

  describe('transformNotificationsResponse', () => {
    it('transforms a full API response', () => {
      const raw: RawNotificationsApiResponse = {
        notifications: [
          {
            id: 'n1',
            source_pubkey: 'pk1',
            source_event_id: 'e1',
            source_kind: 7,
            referenced_event_id: 'video-1',
            notification_type: 'reaction',
            created_at: 1700000000,
            read: false,
          },
          {
            id: 'n2',
            source_pubkey: 'pk2',
            source_event_id: 'e2',
            source_kind: 3,
            notification_type: 'follow',
            created_at: 1700000001,
            read: true,
          },
        ],
        unread_count: 5,
        next_cursor: 'cursor-abc',
        has_more: true,
      };

      const result = transformNotificationsResponse(raw);
      expect(result.notifications).toHaveLength(2);
      // deduplicateFollows sorts newest-first, so follow (ts=1700000001) comes before like (ts=1700000000)
      expect(result.notifications[0].type).toBe('follow');
      expect(result.notifications[1].type).toBe('like');
      expect(result.unreadCount).toBe(5);
      expect(result.nextCursor).toBe('cursor-abc');
      expect(result.hasMore).toBe(true);
    });

    it('handles empty notifications array', () => {
      const raw: RawNotificationsApiResponse = {
        notifications: [],
        unread_count: 0,
        has_more: false,
      };

      const result = transformNotificationsResponse(raw);
      expect(result.notifications).toHaveLength(0);
      expect(result.unreadCount).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it('omits zap notifications from the response', () => {
      const raw: RawNotificationsApiResponse = {
        notifications: [
          {
            id: 'n1',
            source_pubkey: 'pk1',
            source_event_id: 'e1',
            source_kind: 9,
            referenced_event_id: 'video-1',
            notification_type: 'zap',
            created_at: 1700000000,
            read: false,
          },
          {
            id: 'n2',
            source_pubkey: 'pk2',
            source_event_id: 'e2',
            source_kind: 7,
            referenced_event_id: 'video-1',
            notification_type: 'reaction',
            created_at: 1700000001,
            read: false,
          },
        ],
        unread_count: 2,
        has_more: false,
      };
      const result = transformNotificationsResponse(raw);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].type).toBe('like');
    });

    it('omits unknown notification types from the response', () => {
      const raw: RawNotificationsApiResponse = {
        notifications: [
          {
            id: 'n1',
            source_pubkey: 'pk1',
            source_event_id: 'e1',
            source_kind: 0,
            referenced_event_id: 'video-1',
            notification_type: 'some_future_type',
            created_at: 1700000000,
            read: false,
          },
        ],
        unread_count: 0,
        has_more: false,
      };
      const result = transformNotificationsResponse(raw);
      expect(result.notifications).toHaveLength(0);
    });

    it('omits like/comment/repost rows without referenced_event_id', () => {
      const raw: RawNotificationsApiResponse = {
        notifications: [
          {
            id: 'n1',
            source_pubkey: 'pk1',
            source_event_id: 'e1',
            source_kind: 7,
            // no referenced_event_id
            notification_type: 'reaction',
            created_at: 1700000000,
            read: false,
          },
          {
            id: 'n2',
            source_pubkey: 'pk2',
            source_event_id: 'e2',
            source_kind: 3,
            notification_type: 'follow',
            created_at: 1700000001,
            read: false,
          },
        ],
        unread_count: 0,
        has_more: false,
      };
      const result = transformNotificationsResponse(raw);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].type).toBe('follow');
    });
  });

  describe('deduplicateFollows', () => {
    const makeNotif = (overrides: Partial<RawNotification> & { id: string; type: 'like' | 'comment' | 'follow' | 'repost'; actorPubkey: string }): RawNotification => ({
      timestamp: 1700000000,
      isRead: false,
      sourceEventId: 'se1',
      sourceKind: 3,
      ...overrides,
    });

    it('removes duplicate follow notifications from same actor, keeps newest', () => {
      const notifications = [
        makeNotif({ id: 'n3', type: 'follow', actorPubkey: 'pk1', timestamp: 1700000001 }),
        makeNotif({ id: 'n1', type: 'follow', actorPubkey: 'pk1', timestamp: 1700000003 }),
        makeNotif({ id: 'n2', type: 'follow', actorPubkey: 'pk1', timestamp: 1700000002 }),
      ];

      const result = deduplicateFollows(notifications);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('n1'); // newest by timestamp
    });

    it('keeps newest regardless of input order', () => {
      // API order is reversed from timestamp order
      const notifications = [
        makeNotif({ id: 'oldest', type: 'follow', actorPubkey: 'pk1', timestamp: 1700000001 }),
        makeNotif({ id: 'newest', type: 'follow', actorPubkey: 'pk1', timestamp: 1700000005 }),
      ];

      const result = deduplicateFollows(notifications);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('newest');
    });

    it('keeps follows from different actors', () => {
      const notifications = [
        makeNotif({ id: 'n1', type: 'follow', actorPubkey: 'pk1' }),
        makeNotif({ id: 'n2', type: 'follow', actorPubkey: 'pk2' }),
      ];

      const result = deduplicateFollows(notifications);
      expect(result).toHaveLength(2);
    });

    it('does not deduplicate non-follow types', () => {
      const notifications = [
        makeNotif({ id: 'n1', type: 'like', actorPubkey: 'pk1' }),
        makeNotif({ id: 'n2', type: 'like', actorPubkey: 'pk1' }),
      ];

      const result = deduplicateFollows(notifications);
      expect(result).toHaveLength(2); // both kept — likes from same person on different videos are valid
    });

    it('handles mixed types correctly', () => {
      const notifications = [
        makeNotif({ id: 'n1', type: 'follow', actorPubkey: 'pk1', timestamp: 1700000003 }),
        makeNotif({ id: 'n2', type: 'like', actorPubkey: 'pk1', timestamp: 1700000002 }),
        makeNotif({ id: 'n3', type: 'follow', actorPubkey: 'pk1', timestamp: 1700000001 }),
      ];

      const result = deduplicateFollows(notifications);
      expect(result).toHaveLength(2); // follow n1 + like n2 (follow n3 deduped)
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "just now" for timestamps less than 60s ago', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(formatRelativeTime(now - 30)).toBe('just now');
    });

    it('returns minutes for timestamps less than 1 hour ago', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(formatRelativeTime(now - 300)).toBe('5m ago');
    });

    it('returns hours for timestamps less than 1 day ago', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(formatRelativeTime(now - 7200)).toBe('2h ago');
    });

    it('returns days for timestamps less than 1 week ago', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(formatRelativeTime(now - 172800)).toBe('2d ago');
    });

    it('returns formatted date for timestamps older than 1 week', () => {
      // Use a fixed old timestamp
      const result = formatRelativeTime(1700000000);
      // Should be a date string like "Nov 14" or similar locale-dependent format
      expect(result).toBeTruthy();
      expect(result).not.toContain('ago');
    });
  });
});
