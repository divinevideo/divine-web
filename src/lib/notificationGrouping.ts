// ABOUTME: Pure transform from raw notifications + hydrated profile/video maps
// ABOUTME: to the grouped VideoNotification | ActorNotification list

import { genUserName } from '@/lib/genUserName';
import type {
  ActorInfo,
  ActorNotification,
  NotificationItem,
  RawNotification,
  VideoNotification,
} from '@/types/notification';

export interface NotificationVideoMeta {
  title?: string;
  thumbnailUrl?: string;
}

/**
 * Group a flat list of RawNotifications into VideoNotification | ActorNotification rows.
 *
 * Rules:
 *  - Non-follow rows are bucketed by `${targetEventId}::${type}`.
 *  - Each bucket is sorted newest-first before deriving fields.
 *  - id         = newest raw id in the bucket (bucket[0].id after sort).
 *  - rawIds     = all raw ids newest-first.
 *  - actors     = up to 3 unique actors (by pubkey) newest-first.
 *  - totalCount = number of unique actor pubkeys in the bucket.
 *  - timestamp  = newest raw timestamp.
 *  - isRead     = bucket.every(row => row.isRead).
 *  - Follow rows are returned as singleton ActorNotifications (never bucketed).
 *  - Final output sorted newest-first by timestamp.
 */
export function groupRawNotifications(
  raw: RawNotification[],
  profiles: Map<string, ActorInfo>,
  videos: Map<string, NotificationVideoMeta>,
): NotificationItem[] {
  const buckets = new Map<string, RawNotification[]>();
  const followItems: ActorNotification[] = [];

  for (const row of raw) {
    if (row.type === 'follow') {
      followItems.push(makeActorNotification(row, profiles));
      continue;
    }

    // Defensive: skip non-follow rows with no targetEventId
    if (!row.targetEventId) {
      continue;
    }

    const key = `${row.targetEventId}::${row.type}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      buckets.set(key, [row]);
    }
  }

  const videoItems: VideoNotification[] = [];

  for (const [, bucket] of buckets) {
    // Sort newest-first
    bucket.sort((a, b) => b.timestamp - a.timestamp);

    const newestRow = bucket[0];
    const targetEventId = newestRow.targetEventId!;
    const type = newestRow.type as 'like' | 'comment' | 'repost';

    // Collect unique actor pubkeys newest-first
    const seenPubkeys = new Set<string>();
    const uniqueActors: ActorInfo[] = [];
    for (const row of bucket) {
      if (!seenPubkeys.has(row.actorPubkey)) {
        seenPubkeys.add(row.actorPubkey);
        uniqueActors.push(resolveActor(row.actorPubkey, profiles));
      }
    }

    const videoMeta = videos.get(targetEventId);

    const item: VideoNotification = {
      kind: 'video',
      id: newestRow.id,
      rawIds: bucket.map((r) => r.id),
      timestamp: newestRow.timestamp,
      isRead: bucket.every((r) => r.isRead),
      type,
      videoEventId: targetEventId,
      videoTitle: videoMeta?.title,
      videoThumbnailUrl: videoMeta?.thumbnailUrl,
      actors: uniqueActors.slice(0, 3),
      totalCount: seenPubkeys.size,
      commentText: type === 'comment' ? newestRow.commentText : undefined,
    };

    videoItems.push(item);
  }

  // Combine video + actor items and sort newest-first
  const combined: NotificationItem[] = [...videoItems, ...followItems];
  combined.sort((a, b) => b.timestamp - a.timestamp);
  return combined;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function resolveActor(pubkey: string, profiles: Map<string, ActorInfo>): ActorInfo {
  const profile = profiles.get(pubkey);
  if (profile) {
    return profile;
  }
  return {
    pubkey,
    displayName: genUserName(pubkey),
  };
}

function makeActorNotification(
  row: RawNotification,
  profiles: Map<string, ActorInfo>,
): ActorNotification {
  return {
    kind: 'actor',
    id: row.id,
    rawIds: [row.id],
    timestamp: row.timestamp,
    isRead: row.isRead,
    type: 'follow',
    actor: resolveActor(row.actorPubkey, profiles),
  };
}
