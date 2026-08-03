// ABOUTME: Tests for groupRawNotifications pure transform
// ABOUTME: Verifies bucketing, sorting, actor deduplication, and follow singleton logic

import { describe, it, expect, beforeEach } from 'vitest';
import { groupRawNotifications } from './notificationGrouping';
import type { NotificationVideoMeta } from './notificationGrouping';
import type { ActorInfo, RawNotification, VideoNotification, ActorNotification } from '@/types/notification';

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

let _seq = 0;
function makeRaw(
  overrides: Partial<RawNotification> & {
    id?: string;
    type: RawNotification['type'];
    actorPubkey: string;
  },
): RawNotification {
  _seq++;
  return {
    id: `raw-${_seq}`,
    timestamp: 1_700_000_000 + _seq,
    isRead: false,
    sourceEventId: `source-${_seq}`,
    sourceKind: 7,
    ...overrides,
  };
}

const HEX_VIDEO_ID = 'a'.repeat(64);
const VIDEO_D_TAG = 'vine-1712345678-ab12cd3';
const VIDEO_COORDINATE = `34236:${'f'.repeat(64)}:${VIDEO_D_TAG}`;

function makeActor(pubkey: string, displayName?: string): ActorInfo {
  return { pubkey, displayName: displayName ?? `User ${pubkey.slice(0, 4)}` };
}

function makeVideoMeta(title?: string, thumbnailUrl?: string): NotificationVideoMeta {
  return { title, thumbnailUrl };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('groupRawNotifications', () => {
  beforeEach(() => {
    _seq = 0;
  });

  // 1. 1 like on a video produces one VideoNotification
  it('produces one VideoNotification for a single like', () => {
    const raw = makeRaw({ type: 'like', actorPubkey: 'pk1', targetEventId: 'video-1' });
    const profiles = new Map([['pk1', makeActor('pk1', 'Alice')]]);
    const videos = new Map([['video-1', makeVideoMeta('My Video')]]);

    const result = groupRawNotifications([raw], profiles, videos);

    expect(result).toHaveLength(1);
    const item = result[0] as VideoNotification;
    expect(item.kind).toBe('video');
    expect(item.type).toBe('like');
    expect(item.videoEventId).toBe('video-1');
    expect(item.totalCount).toBe(1);
    expect(item.actors).toHaveLength(1);
    expect(item.actors[0].pubkey).toBe('pk1');
    expect(item.actors[0].displayName).toBe('Alice');
  });

  // 2. 5 likes on one video → one row with 3 displayed actors and totalCount: 5
  it('groups 5 likes on one video into one row with 3 displayed actors and totalCount 5', () => {
    const raws = ['pk1', 'pk2', 'pk3', 'pk4', 'pk5'].map((pk, i) =>
      makeRaw({ id: `like-${i}`, type: 'like', actorPubkey: pk, targetEventId: 'video-1', timestamp: 1_700_000_000 + i }),
    );
    const profiles = new Map(
      ['pk1', 'pk2', 'pk3', 'pk4', 'pk5'].map((pk) => [pk, makeActor(pk)]),
    );
    const videos = new Map([['video-1', makeVideoMeta('My Video')]]);

    const result = groupRawNotifications(raws, profiles, videos);

    expect(result).toHaveLength(1);
    const item = result[0] as VideoNotification;
    expect(item.kind).toBe('video');
    expect(item.totalCount).toBe(5);
    expect(item.actors).toHaveLength(3);
  });

  // 3. Likes and comments on the same video produce separate rows
  it('produces separate rows for likes and comments on the same video', () => {
    const raws = [
      makeRaw({ type: 'like', actorPubkey: 'pk1', targetEventId: 'video-1' }),
      makeRaw({ type: 'comment', actorPubkey: 'pk2', targetEventId: 'video-1', commentText: 'Nice!' }),
    ];
    const profiles = new Map([
      ['pk1', makeActor('pk1')],
      ['pk2', makeActor('pk2')],
    ]);
    const videos = new Map([['video-1', makeVideoMeta()]]);

    const result = groupRawNotifications(raws, profiles, videos);

    expect(result).toHaveLength(2);
    const types = result.map((r) => (r as VideoNotification).type);
    expect(types).toContain('like');
    expect(types).toContain('comment');
  });

  // 4. Notifications for different videos produce separate rows
  it('produces separate rows for different videos', () => {
    const raws = [
      makeRaw({ type: 'like', actorPubkey: 'pk1', targetEventId: 'video-1' }),
      makeRaw({ type: 'like', actorPubkey: 'pk2', targetEventId: 'video-2' }),
    ];
    const profiles = new Map([
      ['pk1', makeActor('pk1')],
      ['pk2', makeActor('pk2')],
    ]);
    const videos = new Map([
      ['video-1', makeVideoMeta('Video 1')],
      ['video-2', makeVideoMeta('Video 2')],
    ]);

    const result = groupRawNotifications(raws, profiles, videos);

    expect(result).toHaveLength(2);
    const ids = result.map((r) => (r as VideoNotification).videoEventId);
    expect(ids).toContain('video-1');
    expect(ids).toContain('video-2');
  });

  // 5. Follow rows produce one ActorNotification per raw row, never grouped
  it('produces one ActorNotification per follow, never grouped', () => {
    const raws = [
      makeRaw({ type: 'follow', actorPubkey: 'pk1' }),
      makeRaw({ type: 'follow', actorPubkey: 'pk2' }),
    ];
    const profiles = new Map([
      ['pk1', makeActor('pk1', 'Alice')],
      ['pk2', makeActor('pk2', 'Bob')],
    ]);
    const videos = new Map<string, NotificationVideoMeta>();

    const result = groupRawNotifications(raws, profiles, videos);

    expect(result).toHaveLength(2);
    for (const item of result) {
      expect(item.kind).toBe('actor');
      expect((item as ActorNotification).type).toBe('follow');
    }
  });

  // 6. Output sorts by newest timestamp descending
  it('sorts output by newest timestamp descending', () => {
    const raws = [
      makeRaw({ id: 'old', type: 'like', actorPubkey: 'pk1', targetEventId: 'video-1', timestamp: 1_000 }),
      makeRaw({ id: 'new', type: 'like', actorPubkey: 'pk2', targetEventId: 'video-2', timestamp: 2_000 }),
      makeRaw({ id: 'follow-mid', type: 'follow', actorPubkey: 'pk3', timestamp: 1_500 }),
    ];
    const profiles = new Map([
      ['pk1', makeActor('pk1')],
      ['pk2', makeActor('pk2')],
      ['pk3', makeActor('pk3')],
    ]);
    const videos = new Map([
      ['video-1', makeVideoMeta()],
      ['video-2', makeVideoMeta()],
    ]);

    const result = groupRawNotifications(raws, profiles, videos);

    expect(result).toHaveLength(3);
    expect(result[0].timestamp).toBe(2_000);
    expect(result[1].timestamp).toBe(1_500);
    expect(result[2].timestamp).toBe(1_000);
  });

  // 7. Group isRead is true only when every raw row is read
  it('isRead is true only when all rows in the group are read', () => {
    const raws = [
      makeRaw({ type: 'like', actorPubkey: 'pk1', targetEventId: 'video-1', isRead: true }),
      makeRaw({ type: 'like', actorPubkey: 'pk2', targetEventId: 'video-1', isRead: false }),
    ];
    const profiles = new Map([
      ['pk1', makeActor('pk1')],
      ['pk2', makeActor('pk2')],
    ]);
    const videos = new Map([['video-1', makeVideoMeta()]]);

    const result = groupRawNotifications(raws, profiles, videos);
    expect(result).toHaveLength(1);
    expect(result[0].isRead).toBe(false);

    // All read
    const allRead = raws.map((r) => ({ ...r, isRead: true }));
    const result2 = groupRawNotifications(allRead, profiles, videos);
    expect(result2[0].isRead).toBe(true);
  });

  // 8. rawIds contains all raw ids in newest-first order
  it('rawIds contains all raw ids in newest-first order', () => {
    const raws = [
      makeRaw({ id: 'r1', type: 'like', actorPubkey: 'pk1', targetEventId: 'video-1', timestamp: 1_000 }),
      makeRaw({ id: 'r2', type: 'like', actorPubkey: 'pk2', targetEventId: 'video-1', timestamp: 3_000 }),
      makeRaw({ id: 'r3', type: 'like', actorPubkey: 'pk3', targetEventId: 'video-1', timestamp: 2_000 }),
    ];
    const profiles = new Map([
      ['pk1', makeActor('pk1')],
      ['pk2', makeActor('pk2')],
      ['pk3', makeActor('pk3')],
    ]);
    const videos = new Map([['video-1', makeVideoMeta()]]);

    const result = groupRawNotifications(raws, profiles, videos);
    expect(result).toHaveLength(1);
    // newest-first: r2 (3000), r3 (2000), r1 (1000)
    expect(result[0].rawIds).toEqual(['r2', 'r3', 'r1']);
  });

  // 9. Missing profile falls back to genUserName(pubkey)
  it('falls back to genUserName when profile is missing', () => {
    const raw = makeRaw({ type: 'like', actorPubkey: 'aaaa', targetEventId: 'video-1' });
    const profiles = new Map<string, ActorInfo>(); // empty
    const videos = new Map([['video-1', makeVideoMeta()]]);

    const result = groupRawNotifications([raw], profiles, videos);
    expect(result).toHaveLength(1);
    const item = result[0] as VideoNotification;
    expect(item.actors[0].pubkey).toBe('aaaa');
    // displayName should be non-empty string from genUserName
    expect(typeof item.actors[0].displayName).toBe('string');
    expect(item.actors[0].displayName.length).toBeGreaterThan(0);
  });

  // 10. Missing video metadata still emits a row with undefined title/thumbnail
  it('emits a row with undefined title and thumbnail when video metadata is missing', () => {
    const raw = makeRaw({ type: 'like', actorPubkey: 'pk1', targetEventId: 'video-999' });
    const profiles = new Map([['pk1', makeActor('pk1')]]);
    const videos = new Map<string, NotificationVideoMeta>(); // no entry for video-999

    const result = groupRawNotifications([raw], profiles, videos);
    expect(result).toHaveLength(1);
    const item = result[0] as VideoNotification;
    expect(item.videoEventId).toBe('video-999');
    expect(item.videoTitle).toBeUndefined();
    expect(item.videoThumbnailUrl).toBeUndefined();
  });

  // 11. Comment groups use the newest comment text
  it('uses the newest comment text for comment groups', () => {
    const raws = [
      makeRaw({ type: 'comment', actorPubkey: 'pk1', targetEventId: 'video-1', commentText: 'Old comment', timestamp: 1_000 }),
      makeRaw({ type: 'comment', actorPubkey: 'pk2', targetEventId: 'video-1', commentText: 'Newest comment', timestamp: 3_000 }),
      makeRaw({ type: 'comment', actorPubkey: 'pk3', targetEventId: 'video-1', commentText: 'Middle comment', timestamp: 2_000 }),
    ];
    const profiles = new Map([
      ['pk1', makeActor('pk1')],
      ['pk2', makeActor('pk2')],
      ['pk3', makeActor('pk3')],
    ]);
    const videos = new Map([['video-1', makeVideoMeta()]]);

    const result = groupRawNotifications(raws, profiles, videos);
    expect(result).toHaveLength(1);
    const item = result[0] as VideoNotification;
    expect(item.commentText).toBe('Newest comment');
  });

  // Extra: actors are unique by pubkey (same user liking twice = one actor entry)
  it('deduplicates actors by pubkey within a group', () => {
    const raws = [
      makeRaw({ id: 'r1', type: 'like', actorPubkey: 'pk1', targetEventId: 'video-1', timestamp: 1_000 }),
      makeRaw({ id: 'r2', type: 'like', actorPubkey: 'pk1', targetEventId: 'video-1', timestamp: 2_000 }),
    ];
    const profiles = new Map([['pk1', makeActor('pk1')]]);
    const videos = new Map([['video-1', makeVideoMeta()]]);

    const result = groupRawNotifications(raws, profiles, videos);
    expect(result).toHaveLength(1);
    const item = result[0] as VideoNotification;
    expect(item.actors).toHaveLength(1);
    expect(item.totalCount).toBe(1); // 1 unique actor
  });

  // Extra: id is the newest raw id in the bucket
  it('sets id to the newest raw id in the bucket', () => {
    const raws = [
      makeRaw({ id: 'older', type: 'like', actorPubkey: 'pk1', targetEventId: 'video-1', timestamp: 1_000 }),
      makeRaw({ id: 'newest', type: 'like', actorPubkey: 'pk2', targetEventId: 'video-1', timestamp: 9_000 }),
    ];
    const profiles = new Map([
      ['pk1', makeActor('pk1')],
      ['pk2', makeActor('pk2')],
    ]);
    const videos = new Map([['video-1', makeVideoMeta()]]);

    const result = groupRawNotifications(raws, profiles, videos);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('newest');
  });

  // Extra: follow actor uses profile data
  it('follow actor uses profile displayName and avatarUrl', () => {
    const raw = makeRaw({ type: 'follow', actorPubkey: 'pk1' });
    const profiles = new Map([['pk1', { pubkey: 'pk1', displayName: 'Carol', avatarUrl: 'https://example.com/carol.jpg' }]]);
    const videos = new Map<string, NotificationVideoMeta>();

    const result = groupRawNotifications([raw], profiles, videos);
    expect(result).toHaveLength(1);
    const item = result[0] as ActorNotification;
    expect(item.kind).toBe('actor');
    expect(item.actor.displayName).toBe('Carol');
    expect(item.actor.avatarUrl).toBe('https://example.com/carol.jpg');
  });

  // Extra: rows without targetEventId (non-follow) are filtered out
  it('filters out non-follow rows with missing targetEventId', () => {
    const raws = [
      makeRaw({ type: 'like', actorPubkey: 'pk1' }), // no targetEventId
      makeRaw({ type: 'follow', actorPubkey: 'pk2' }), // follow: OK without targetEventId
    ];
    const profiles = new Map([
      ['pk1', makeActor('pk1')],
      ['pk2', makeActor('pk2')],
    ]);
    const videos = new Map<string, NotificationVideoMeta>();

    const result = groupRawNotifications(raws, profiles, videos);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('actor');
  });

  describe('addressable identity', () => {
    // divine-web publishes reposts with only an `a` tag, so they resolve to a
    // d-tag; divine-mobile adds an `e` tag, so those resolve to a hex event id.
    // Both carry the same addressable coordinate.
    const webRepost = () =>
      makeRaw({
        type: 'repost',
        actorPubkey: 'pk-web',
        targetEventId: VIDEO_D_TAG,
        groupingKey: VIDEO_COORDINATE,
      });
    const mobileRepost = () =>
      makeRaw({
        type: 'repost',
        actorPubkey: 'pk-mobile',
        targetEventId: HEX_VIDEO_ID,
        groupingKey: VIDEO_COORDINATE,
      });

    it('groups reposts of one video into a single row across differing clients', () => {
      const result = groupRawNotifications(
        [webRepost(), mobileRepost()],
        new Map([
          ['pk-web', makeActor('pk-web')],
          ['pk-mobile', makeActor('pk-mobile')],
        ]),
        new Map<string, NotificationVideoMeta>(),
      );

      expect(result).toHaveLength(1);
      expect((result[0] as VideoNotification).totalCount).toBe(2);
    });

    it('navigates the grouped row by hex event id rather than the author-chosen d-tag', () => {
      const result = groupRawNotifications(
        [webRepost(), mobileRepost()],
        new Map(),
        new Map<string, NotificationVideoMeta>(),
      );

      // The d-tag row is newer, but a d-tag resolves globally in the API and can
      // land on another author's video, so the unambiguous id wins.
      expect((result[0] as VideoNotification).videoEventId).toBe(HEX_VIDEO_ID);
    });

    it('still separates genuinely different videos that share a type', () => {
      const other = makeRaw({
        type: 'repost',
        actorPubkey: 'pk-other',
        targetEventId: 'b'.repeat(64),
        groupingKey: `34236:${'e'.repeat(64)}:another-vine`,
      });

      const result = groupRawNotifications(
        [webRepost(), other],
        new Map(),
        new Map<string, NotificationVideoMeta>(),
      );

      expect(result).toHaveLength(2);
    });

    it('falls back to targetEventId when the API supplied no coordinate', () => {
      const result = groupRawNotifications(
        [
          makeRaw({ type: 'like', actorPubkey: 'pk1', targetEventId: HEX_VIDEO_ID }),
          makeRaw({ type: 'like', actorPubkey: 'pk2', targetEventId: HEX_VIDEO_ID }),
        ],
        new Map(),
        new Map<string, NotificationVideoMeta>(),
      );

      expect(result).toHaveLength(1);
      expect((result[0] as VideoNotification).totalCount).toBe(2);
    });
  });
});
