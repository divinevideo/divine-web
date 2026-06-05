# Notifications: video-anchored grouping + thumbnails (web) — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port divine-mobile's notifications redesign to divine-web — group video-anchored notifications (likes/comments/reposts) by `(videoEventId, kind)`, hydrate with video title + thumbnail, render with avatar stacks and a leading type-icon chip. Hide zaps for now.

**Architecture:** Sealed `VideoNotification | ActorNotification` type produced by a pure `groupRawNotifications` transform. A new `useHydratedNotifications` hook orchestrates raw-fetch + parallel `fetchVideoById` calls + profile batch + grouping. `NotificationsPage` switches on `notification.kind` to pick a row component. The "Unread" tab keeps an ungrouped view; all other tabs group.

**Tech Stack:** React 18, TypeScript, TanStack Query, Tailwind, shadcn/ui, `@phosphor-icons/react`, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-06-notifications-video-grouping-web-design.md`

**Branch / worktree:** Create a worktree off `main` named `notifications-video-grouping-web`. Land as a single PR. No feature flag.

---

## File map

**New (src):**
- `src/types/notification.ts` — **replaces** current flat type with sealed `VideoNotification | ActorNotification` union (zap removed).
- `src/lib/notificationGrouping.ts` — pure transform: `(raw, profiles, videos) → NotificationItem[]`.
- `src/hooks/useNotificationVideos.ts` — parallel `fetchVideoById` orchestrator; returns `Map<eventId, { title?: string; thumbnailUrl?: string }>` + per-id React Query cache entries.
- `src/hooks/useHydratedNotifications.ts` — wraps `useNotifications` + `useBatchedAuthors` + `useNotificationVideos` and runs the grouping transform.
- `src/components/notifications/NotificationAvatarStack.tsx` — overlapping avatars + `+N` overflow circle.
- `src/components/notifications/NotificationTypeIconChip.tsx` — colored 32×32 leading chip (heart/repost/chat-bubble/user-plus).
- `src/components/notifications/NotificationVideoThumbnail.tsx` — 72×72 thumbnail with brand border + placeholder.
- `src/components/notifications/VideoNotificationRow.tsx` — shared row for like/comment/repost.
- `src/components/notifications/ActorNotificationRow.tsx` — single-actor row for follows.

**New (tests):**
- `src/lib/notificationGrouping.test.ts`
- `src/hooks/useNotificationVideos.test.ts`
- `src/hooks/useHydratedNotifications.test.ts`
- `src/components/notifications/NotificationAvatarStack.test.tsx`
- `src/components/notifications/NotificationTypeIconChip.test.tsx`
- `src/components/notifications/NotificationVideoThumbnail.test.tsx`
- `src/components/notifications/VideoNotificationRow.test.tsx`
- `src/components/notifications/ActorNotificationRow.test.tsx`

**Modified:**
- `src/lib/notificationTransform.ts` — drop zap mapping; `transformNotification` returns the raw-only fields (no app-type yet); add `transformRawNotifications` returning a flat `RawNotification[]`.
- `src/hooks/useNotifications.ts` — drop `'zaps'` from `CATEGORY_TYPES`; keep returning the existing paginated response shape (raw → flat list of `RawNotification`, not yet grouped).
- `src/pages/NotificationsPage.tsx` — replace `<NotificationItem>` with `<VideoNotificationRow>` / `<ActorNotificationRow>`; drop the Zaps tab; use `useHydratedNotifications` instead of `useNotifications` directly.
- `src/lib/i18n/locales/en/common.json` — add new message keys (`notificationsPage.message.*`, `notificationsPage.video.untitled`); remove `notificationsPage.tabs.zaps` and `notificationsPage.empty.zaps`. Other locale files get the same additions/removals (English copy is fine as fallback for non-English locales in v1; translators will catch up).

**Deleted:**
- `src/components/NotificationItem.tsx` — replaced by the two new row components.
- `src/components/NotificationItem.test.tsx` if it exists.

---

## Test conventions

- Run a single file: `npx vitest run src/path/to/test.ts`
- Run a single test: `npx vitest run src/path/to/test.ts -t "name"`
- Type check: `npx tsc --noEmit`
- Brand guardrails: `npx vitest run tests/brand`
- All tests: `npm test`

Each task ends with a commit. Commit format: `type: description` (`feat`, `fix`, `refactor`, `test`).

Use TDD per @superpowers:test-driven-development: write the failing test first, watch it fail, write the minimum to pass, refactor, commit.

---

## Chunk 1: Types and pure transforms

### Task 1: Sealed notification type union

**Files:**
- Modify: `src/types/notification.ts`

- [ ] **Step 1: Read the current file**

Open `src/types/notification.ts` to confirm the existing shape before rewriting.

- [ ] **Step 2: Replace the contents**

Rewrite to:

```ts
// ABOUTME: Type definitions for the notifications feature
// ABOUTME: Sealed VideoNotification | ActorNotification union; zaps removed (hidden in v1)

/** Action types we surface in the UI. (Zaps are hidden for now.) */
export type NotificationType = 'like' | 'comment' | 'follow' | 'repost';

/** Raw notification types accepted by the backend filter API. */
export type NotificationApiType = 'reaction' | 'reply' | 'follow' | 'repost' | 'mention';

/** Tabs supported by the notifications page. */
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

/** Lightweight actor projection used inside grouped notifications. */
export interface ActorInfo {
  pubkey: string;
  displayName: string;
  avatarUrl?: string;
  nip05?: string;
}

interface BaseNotification {
  /** Stable id used as React key. For grouped rows, the newest underlying id. */
  id: string;
  /** All underlying raw notification ids (used for mark-as-read). */
  rawIds: string[];
  /** Unix seconds, of the newest underlying raw event. */
  timestamp: number;
  /** True iff every underlying raw event is read. */
  isRead: boolean;
}

/** One row per (video × kind). 1 actor or N actors — same row shape. */
export interface VideoNotification extends BaseNotification {
  kind: 'video';
  type: 'like' | 'comment' | 'repost';
  videoEventId: string;
  videoTitle?: string;
  videoThumbnailUrl?: string;
  actors: ActorInfo[];      // length 1..3
  totalCount: number;       // total people, may exceed actors.length
  /** Newest comment's body, for type === 'comment' only. */
  commentText?: string;
}

/** Actor-anchored — follows in v1. No video context. */
export interface ActorNotification extends BaseNotification {
  kind: 'actor';
  type: 'follow';
  actor: ActorInfo;
}

export type NotificationItem = VideoNotification | ActorNotification;

/** Intermediate raw notification used between fetch and grouping. */
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

/** Paginated response from the notifications API (raw stage). */
export interface NotificationsResponse {
  notifications: RawNotification[];
  unreadCount: number;
  nextCursor?: string;
  hasMore: boolean;
}

/** Raw notification shape from Funnelcake API. */
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
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in every file still referencing the deleted `Notification` interface or `'zap'` type. That's expected — later tasks delete/rewrite those files. **Do not fix them in this task.** Make a note of the failing paths.

- [ ] **Step 4: Commit**

```bash
git add src/types/notification.ts
git commit -m "refactor(notifications): sealed VideoNotification | ActorNotification type"
```

---

### Task 2: Strip zaps from raw transform

**Files:**
- Modify: `src/lib/notificationTransform.ts`
- Modify: `src/lib/notificationTransform.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/lib/notificationTransform.test.ts`, add (or rewrite the file to contain only) these:

```ts
import { describe, it, expect } from 'vitest';
import {
  mapNotificationType,
  transformNotification,
  deduplicateFollows,
  transformNotificationsResponse,
  formatRelativeTime,
} from './notificationTransform';
import type { RawApiNotification } from '@/types/notification';

const baseRaw: RawApiNotification = {
  id: 'n1',
  source_pubkey: 'pk',
  source_event_id: 'se',
  source_kind: 7,
  referenced_event_id: 'video1',
  notification_type: 'reaction',
  created_at: 1700000000,
  read: false,
};

describe('mapNotificationType', () => {
  it('maps known types', () => {
    expect(mapNotificationType('reaction')).toBe('like');
    expect(mapNotificationType('reply')).toBe('comment');
    expect(mapNotificationType('follow')).toBe('follow');
    expect(mapNotificationType('repost')).toBe('repost');
  });

  it('returns null for unknown or zap types', () => {
    expect(mapNotificationType('zap')).toBeNull();
    expect(mapNotificationType('something-else')).toBeNull();
  });
});

describe('transformNotificationsResponse', () => {
  it('drops zap notifications', () => {
    const result = transformNotificationsResponse({
      notifications: [
        { ...baseRaw, id: 'n-like', notification_type: 'reaction' },
        { ...baseRaw, id: 'n-zap', notification_type: 'zap' },
      ],
      unread_count: 2,
      has_more: false,
    });
    expect(result.notifications.map((n) => n.id)).toEqual(['n-like']);
  });

  it('drops video-anchored rows missing referenced_event_id', () => {
    const result = transformNotificationsResponse({
      notifications: [
        { ...baseRaw, id: 'with-target' },
        { ...baseRaw, id: 'no-target', referenced_event_id: undefined },
      ],
      unread_count: 0,
      has_more: false,
    });
    expect(result.notifications.map((n) => n.id)).toEqual(['with-target']);
  });

  it('keeps follow rows with no referenced_event_id', () => {
    const result = transformNotificationsResponse({
      notifications: [
        { ...baseRaw, id: 'f1', notification_type: 'follow', referenced_event_id: undefined },
      ],
      unread_count: 0,
      has_more: false,
    });
    expect(result.notifications.map((n) => n.id)).toEqual(['f1']);
  });
});

describe('deduplicateFollows', () => {
  it('keeps only the most recent follow per actor', () => {
    const olderRaw = { ...baseRaw, id: 'old', notification_type: 'follow', created_at: 1, referenced_event_id: undefined };
    const newerRaw = { ...baseRaw, id: 'new', notification_type: 'follow', created_at: 2, referenced_event_id: undefined };
    const transformed = [olderRaw, newerRaw].map(transformNotification).filter((n) => n !== null);
    const result = deduplicateFollows(transformed as never[]);
    expect(result.map((n) => n.id)).toEqual(['new']);
  });
});

describe('formatRelativeTime', () => {
  it('uses "just now" under 60s', () => {
    const ts = Math.floor(Date.now() / 1000) - 30;
    expect(formatRelativeTime(ts)).toBe('just now');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/notificationTransform.test.ts`
Expected: failures because `mapNotificationType` still returns `'like'` for unknown, returns `'zap'` for `'zap'`, and `transformNotification` returns a non-null value for everything.

- [ ] **Step 3: Update `mapNotificationType` and `transformNotification`**

In `src/lib/notificationTransform.ts`, rewrite to:

```ts
// ABOUTME: Pure transforms for the raw Funnelcake notification feed
// ABOUTME: Drops zaps and video-anchored rows missing referenced_event_id

import type {
  NotificationType,
  RawApiNotification,
  RawNotification,
  RawNotificationsApiResponse,
  NotificationsResponse,
} from '@/types/notification';

/** Map an API notification_type to our app type. Returns null for unsupported types (incl. zap). */
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
    default:
      return null;
  }
}

/** Returns null for unsupported types (zap, unknown). */
export function transformNotification(raw: RawApiNotification): RawNotification | null {
  const type = mapNotificationType(raw.notification_type);
  if (type === null) return null;

  // Video-anchored rows without a referenced event id aren't actionable; drop them.
  if (type !== 'follow' && !raw.referenced_event_id) return null;

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

/** Keep only the most recent follow per actor (raw API may emit duplicates). */
export function deduplicateFollows(notifications: RawNotification[]): RawNotification[] {
  // Sort newest first; assumes already mostly newest-first from API but be explicit.
  const sorted = [...notifications].sort((a, b) => b.timestamp - a.timestamp);
  const seen = new Set<string>();
  return sorted.filter((n) => {
    if (n.type !== 'follow') return true;
    if (seen.has(n.actorPubkey)) return false;
    seen.add(n.actorPubkey);
    return true;
  });
}

export function transformNotificationsResponse(
  raw: RawNotificationsApiResponse,
): NotificationsResponse {
  const all = (raw.notifications ?? [])
    .map(transformNotification)
    .filter((n): n is RawNotification => n !== null);
  return {
    notifications: deduplicateFollows(all),
    unreadCount: raw.unread_count ?? 0,
    nextCursor: raw.next_cursor,
    hasMore: raw.has_more ?? false,
  };
}

/** Format a Unix timestamp into a relative time string. */
export function formatRelativeTime(timestampSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestampSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  const date = new Date(timestampSeconds * 1000);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// generateNotificationMessage and other message helpers move to the
// grouping/row layer (they need actor counts and translation context),
// so they're intentionally not exported here anymore.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/notificationTransform.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notificationTransform.ts src/lib/notificationTransform.test.ts
git commit -m "refactor(notifications): drop zaps and null-target rows from raw transform"
```

---

### Task 3: Pure grouping function

**Files:**
- Create: `src/lib/notificationGrouping.ts`
- Create: `src/lib/notificationGrouping.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/notificationGrouping.test.ts
import { describe, it, expect } from 'vitest';
import { groupRawNotifications } from './notificationGrouping';
import type { ActorInfo, RawNotification } from '@/types/notification';

const profile = (pubkey: string, displayName: string): ActorInfo => ({
  pubkey,
  displayName,
});

const profiles = new Map<string, ActorInfo>([
  ['a', profile('a', 'Alice')],
  ['b', profile('b', 'Bob')],
  ['c', profile('c', 'Carol')],
  ['d', profile('d', 'Dave')],
  ['e', profile('e', 'Eve')],
]);

const videos = new Map<string, { title?: string; thumbnailUrl?: string }>([
  ['v1', { title: 'First video', thumbnailUrl: 'https://example.com/v1.jpg' }],
  ['v2', { title: 'Second video' }],
]);

function raw(over: Partial<RawNotification>): RawNotification {
  return {
    id: 'r-' + Math.random().toString(36).slice(2),
    type: 'like',
    actorPubkey: 'a',
    timestamp: 1700000000,
    isRead: false,
    targetEventId: 'v1',
    sourceEventId: 's',
    sourceKind: 7,
    ...over,
  };
}

describe('groupRawNotifications', () => {
  it('groups 5 likes on the same video into one row with 3 actors + totalCount 5', () => {
    const result = groupRawNotifications(
      [
        raw({ id: '1', actorPubkey: 'a', timestamp: 5 }),
        raw({ id: '2', actorPubkey: 'b', timestamp: 4 }),
        raw({ id: '3', actorPubkey: 'c', timestamp: 3 }),
        raw({ id: '4', actorPubkey: 'd', timestamp: 2 }),
        raw({ id: '5', actorPubkey: 'e', timestamp: 1 }),
      ],
      profiles,
      videos,
    );
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('video');
    if (result[0].kind !== 'video') return;
    expect(result[0].totalCount).toBe(5);
    expect(result[0].actors.map((a) => a.pubkey)).toEqual(['a', 'b', 'c']);
    expect(result[0].timestamp).toBe(5);
    expect(result[0].videoTitle).toBe('First video');
    expect(result[0].videoThumbnailUrl).toBe('https://example.com/v1.jpg');
    expect(result[0].rawIds).toEqual(['1', '2', '3', '4', '5']);
  });

  it('separates rows by (video, type)', () => {
    const result = groupRawNotifications(
      [
        raw({ id: 'L', type: 'like', targetEventId: 'v1' }),
        raw({ id: 'C', type: 'comment', targetEventId: 'v1', commentText: 'hi' }),
      ],
      profiles,
      videos,
    );
    expect(result).toHaveLength(2);
    expect(new Set(result.map((r) => r.kind === 'video' ? r.type : null))).toEqual(new Set(['like', 'comment']));
  });

  it('groups across all timestamps with no time bucket', () => {
    const result = groupRawNotifications(
      [
        raw({ id: '1', timestamp: 100 }),
        raw({ id: '2', timestamp: 1, actorPubkey: 'b' }), // year-old
      ],
      profiles,
      videos,
    );
    expect(result).toHaveLength(1);
    if (result[0].kind !== 'video') return;
    expect(result[0].totalCount).toBe(2);
    expect(result[0].timestamp).toBe(100); // newest wins
  });

  it('produces one ActorNotification per follow event (no grouping)', () => {
    const result = groupRawNotifications(
      [
        raw({ id: 'f1', type: 'follow', actorPubkey: 'a', targetEventId: undefined }),
        raw({ id: 'f2', type: 'follow', actorPubkey: 'b', targetEventId: undefined }),
      ],
      profiles,
      new Map(),
    );
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.kind === 'actor')).toBe(true);
  });

  it('sorts final list newest first', () => {
    const result = groupRawNotifications(
      [
        raw({ id: 'older', type: 'follow', actorPubkey: 'a', targetEventId: undefined, timestamp: 10 }),
        raw({ id: 'newer', type: 'like', targetEventId: 'v2', timestamp: 20 }),
      ],
      profiles,
      videos,
    );
    expect(result.map((r) => r.id)).toEqual(['newer', 'older']);
  });

  it('isRead true only when every underlying row is read', () => {
    const allRead = groupRawNotifications(
      [
        raw({ id: '1', isRead: true }),
        raw({ id: '2', isRead: true, actorPubkey: 'b' }),
      ],
      profiles,
      videos,
    );
    expect(allRead[0].isRead).toBe(true);

    const mixed = groupRawNotifications(
      [
        raw({ id: '1', isRead: true }),
        raw({ id: '2', isRead: false, actorPubkey: 'b' }),
      ],
      profiles,
      videos,
    );
    expect(mixed[0].isRead).toBe(false);
  });

  it('falls back to a generated display name when profile is missing', () => {
    const result = groupRawNotifications(
      [raw({ id: '1', actorPubkey: 'zzz' })],
      new Map(),
      videos,
    );
    if (result[0].kind !== 'video') return;
    expect(result[0].actors[0].displayName.length).toBeGreaterThan(0);
  });

  it('renders rows even when video metadata is missing', () => {
    const result = groupRawNotifications(
      [raw({ id: '1', targetEventId: 'unknown' })],
      profiles,
      new Map(),
    );
    if (result[0].kind !== 'video') return;
    expect(result[0].videoTitle).toBeUndefined();
    expect(result[0].videoThumbnailUrl).toBeUndefined();
  });

  it('comment groups carry the newest comment text', () => {
    const result = groupRawNotifications(
      [
        raw({ id: '1', type: 'comment', timestamp: 5, commentText: 'newest' }),
        raw({ id: '2', type: 'comment', timestamp: 4, commentText: 'older', actorPubkey: 'b' }),
      ],
      profiles,
      videos,
    );
    if (result[0].kind !== 'video') return;
    expect(result[0].commentText).toBe('newest');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/notificationGrouping.test.ts`
Expected: fails — module not found.

- [ ] **Step 3: Implement `groupRawNotifications`**

```ts
// src/lib/notificationGrouping.ts
// ABOUTME: Pure transform from raw notifications + hydrated profile/video
// ABOUTME: maps to the grouped VideoNotification | ActorNotification list

import { genUserName } from '@/lib/genUserName';
import type {
  ActorInfo,
  ActorNotification,
  NotificationItem,
  RawNotification,
  VideoNotification,
} from '@/types/notification';

const MAX_STACK_ACTORS = 3;

interface VideoMeta { title?: string; thumbnailUrl?: string }

function resolveActor(
  pubkey: string,
  profiles: Map<string, ActorInfo>,
): ActorInfo {
  const hit = profiles.get(pubkey);
  if (hit) return hit;
  return { pubkey, displayName: genUserName(pubkey) };
}

function groupKey(n: RawNotification): string {
  // Video-anchored: bucket by (videoEventId, type). Follows never reach here.
  return `${n.targetEventId}::${n.type}`;
}

export function groupRawNotifications(
  raw: RawNotification[],
  profiles: Map<string, ActorInfo>,
  videos: Map<string, VideoMeta>,
): NotificationItem[] {
  const videoBuckets = new Map<string, RawNotification[]>();
  const actorRows: ActorNotification[] = [];

  for (const n of raw) {
    if (n.type === 'follow') {
      actorRows.push({
        kind: 'actor',
        type: 'follow',
        id: n.id,
        rawIds: [n.id],
        timestamp: n.timestamp,
        isRead: n.isRead,
        actor: resolveActor(n.actorPubkey, profiles),
      });
      continue;
    }
    // Video-anchored rows without a targetEventId are filtered out at the
    // transform layer, but defensive-skip here too.
    if (!n.targetEventId) continue;
    const key = groupKey(n);
    const bucket = videoBuckets.get(key);
    if (bucket) bucket.push(n);
    else videoBuckets.set(key, [n]);
  }

  const videoRows: VideoNotification[] = [];
  for (const bucket of videoBuckets.values()) {
    bucket.sort((a, b) => b.timestamp - a.timestamp);
    const newest = bucket[0];
    const meta = videos.get(newest.targetEventId!);
    const actors: ActorInfo[] = [];
    const seenActorPubkeys = new Set<string>();
    for (const n of bucket) {
      if (seenActorPubkeys.has(n.actorPubkey)) continue;
      seenActorPubkeys.add(n.actorPubkey);
      actors.push(resolveActor(n.actorPubkey, profiles));
      if (actors.length >= MAX_STACK_ACTORS) break;
    }
    videoRows.push({
      kind: 'video',
      type: newest.type as 'like' | 'comment' | 'repost',
      id: newest.id,
      rawIds: bucket.map((n) => n.id),
      timestamp: newest.timestamp,
      isRead: bucket.every((n) => n.isRead),
      videoEventId: newest.targetEventId!,
      videoTitle: meta?.title,
      videoThumbnailUrl: meta?.thumbnailUrl,
      actors,
      totalCount: seenActorPubkeys.size,
      commentText: newest.type === 'comment' ? newest.commentText : undefined,
    });
  }

  return [...videoRows, ...actorRows].sort((a, b) => b.timestamp - a.timestamp);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/notificationGrouping.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notificationGrouping.ts src/lib/notificationGrouping.test.ts
git commit -m "feat(notifications): pure groupRawNotifications transform"
```

---

## Chunk 2: Data hooks

### Task 4: Video metadata fetcher hook

**Files:**
- Create: `src/hooks/useNotificationVideos.ts`
- Create: `src/hooks/useNotificationVideos.test.ts`

- [ ] **Step 1: Inspect existing patterns**

Read `src/lib/funnelcakeClient.ts` (around lines 700-805) to confirm the `fetchVideoById` signature returns `FunnelcakeVideoRaw | null`. Note that `title` lives directly on the response and `thumbnail` is the field name.

- [ ] **Step 2: Write the failing tests**

```ts
// src/hooks/useNotificationVideos.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNotificationVideos } from './useNotificationVideos';
import * as funnelcake from '@/lib/funnelcakeClient';

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useNotificationVideos', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a Map keyed by event id with title + thumbnail', async () => {
    vi.spyOn(funnelcake, 'fetchVideoById').mockImplementation(async (_api, id) => {
      if (id === 'v1') return { id: 'v1', title: 'V1', thumbnail: 't1' } as never;
      if (id === 'v2') return { id: 'v2', title: 'V2', thumbnail: 't2' } as never;
      return null;
    });

    const { result } = renderHook(() => useNotificationVideos(['v1', 'v2']), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.data?.size).toBe(2));
    expect(result.current.data?.get('v1')).toEqual({ title: 'V1', thumbnailUrl: 't1' });
    expect(result.current.data?.get('v2')).toEqual({ title: 'V2', thumbnailUrl: 't2' });
  });

  it('returns an empty entry for ids that fail to resolve', async () => {
    vi.spyOn(funnelcake, 'fetchVideoById').mockImplementation(async (_api, id) => {
      if (id === 'ok') return { id: 'ok', title: 'OK', thumbnail: 't' } as never;
      throw new Error('boom');
    });

    const { result } = renderHook(() => useNotificationVideos(['ok', 'bad']), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.data?.size).toBe(2));
    expect(result.current.data?.get('ok')?.title).toBe('OK');
    expect(result.current.data?.get('bad')).toEqual({});
  });

  it('does not refetch when given the same ids in a different order', async () => {
    const spy = vi.spyOn(funnelcake, 'fetchVideoById').mockResolvedValue(
      { id: 'x', title: 'X', thumbnail: 't' } as never,
    );
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useNotificationVideos(ids),
      { wrapper: wrapper(), initialProps: { ids: ['a', 'b'] } },
    );
    await waitFor(() => expect(result.current.data?.size).toBe(2));
    spy.mockClear();
    rerender({ ids: ['b', 'a'] });
    await waitFor(() => expect(result.current.data?.size).toBe(2));
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useNotificationVideos.test.ts`
Expected: fails — module not found.

- [ ] **Step 4: Implement the hook**

```ts
// src/hooks/useNotificationVideos.ts
// ABOUTME: Resolves video titles + thumbnails for a list of event ids by
// ABOUTME: fanning out parallel fetchVideoById calls, caching per id in RQ

import { useQuery } from '@tanstack/react-query';
import { API_CONFIG } from '@/config/api';
import { fetchVideoById } from '@/lib/funnelcakeClient';

export interface NotificationVideoMeta {
  title?: string;
  thumbnailUrl?: string;
}

export function useNotificationVideos(eventIds: string[]) {
  const apiUrl = API_CONFIG.funnelcake.baseUrl;
  // Stable cache key regardless of input order.
  const uniqueIds = Array.from(new Set(eventIds)).sort();

  return useQuery<Map<string, NotificationVideoMeta>>({
    queryKey: ['notification-videos', uniqueIds.join(',')],
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            const video = await fetchVideoById(apiUrl, id, undefined, signal);
            if (!video) return [id, {} as NotificationVideoMeta] as const;
            return [
              id,
              { title: video.title, thumbnailUrl: video.thumbnail },
            ] as const;
          } catch {
            return [id, {} as NotificationVideoMeta] as const;
          }
        }),
      );
      return new Map(results);
    },
    enabled: uniqueIds.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useNotificationVideos.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useNotificationVideos.ts src/hooks/useNotificationVideos.test.ts
git commit -m "feat(notifications): useNotificationVideos hook (parallel fan-out)"
```

---

### Task 5: Trim `useNotifications` (drop zaps)

**Files:**
- Modify: `src/hooks/useNotifications.ts`
- Modify: `src/hooks/useNotifications.test.ts`

- [ ] **Step 1: Update the test**

In `useNotifications.test.ts`, delete any test that exercises `'zaps'` and add a regression test that the `CATEGORY_TYPES` mapping has no `'zaps'` key. If the existing tests don't expose the mapping, just delete the zaps case.

- [ ] **Step 2: Edit `useNotifications.ts`**

In the `CATEGORY_TYPES` constant, delete the `zaps: ['zap']` entry. The signature of `useNotifications` and the returned shape stay the same — what comes back from Funnelcake is already filtered to omit zaps by the raw transform in Task 2.

- [ ] **Step 3: Type-check and test**

Run: `npx vitest run src/hooks/useNotifications.test.ts` — all pass.
Run: `npx tsc --noEmit` — still has the expected errors in `NotificationsPage.tsx` and `NotificationItem.tsx` (those are addressed later).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useNotifications.ts src/hooks/useNotifications.test.ts
git commit -m "refactor(notifications): drop zaps from category filter"
```

---

### Task 6: `useHydratedNotifications` hook

**Files:**
- Create: `src/hooks/useHydratedNotifications.ts`
- Create: `src/hooks/useHydratedNotifications.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/hooks/useHydratedNotifications.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHydratedNotifications } from './useHydratedNotifications';
import * as notificationsHook from './useNotifications';
import * as authorsHook from './useBatchedAuthors';
import * as videosHook from './useNotificationVideos';
import type { RawNotification } from '@/types/notification';

const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

function rawLike(over: Partial<RawNotification> = {}): RawNotification {
  return {
    id: 'r',
    type: 'like',
    actorPubkey: 'a',
    timestamp: 1,
    isRead: false,
    targetEventId: 'v1',
    sourceEventId: 's',
    sourceKind: 7,
    ...over,
  };
}

describe('useHydratedNotifications', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('groups all/likes/comments/follows/reposts but leaves "unread" ungrouped', async () => {
    vi.spyOn(notificationsHook, 'useNotifications').mockReturnValue({
      data: {
        pages: [{
          notifications: [
            rawLike({ id: '1', actorPubkey: 'a' }),
            rawLike({ id: '2', actorPubkey: 'b' }),
          ],
          unreadCount: 2,
          hasMore: false,
        }],
        pageParams: [undefined],
      },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      error: null,
    } as never);

    vi.spyOn(authorsHook, 'useBatchedAuthors').mockReturnValue({
      data: {
        a: { metadata: { name: 'Alice' } },
        b: { metadata: { name: 'Bob' } },
      },
    } as never);

    vi.spyOn(videosHook, 'useNotificationVideos').mockReturnValue({
      data: new Map([['v1', { title: 'V1', thumbnailUrl: 't' }]]),
    } as never);

    const { result: grouped } = renderHook(
      () => useHydratedNotifications({ category: 'all' }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(grouped.current.items).toHaveLength(1));
    expect(grouped.current.items[0].kind).toBe('video');

    const { result: ungrouped } = renderHook(
      () => useHydratedNotifications({ category: 'unread' }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(ungrouped.current.items).toHaveLength(2));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useHydratedNotifications.test.ts`
Expected: fails — module not found.

- [ ] **Step 3: Implement the hook**

```ts
// src/hooks/useHydratedNotifications.ts
// ABOUTME: Orchestrates raw notifications + author profiles + video metadata,
// ABOUTME: then runs groupRawNotifications. Unread tab stays ungrouped.

import { useMemo } from 'react';
import { useNotifications } from './useNotifications';
import { useBatchedAuthors } from './useBatchedAuthors';
import { useNotificationVideos } from './useNotificationVideos';
import { groupRawNotifications } from '@/lib/notificationGrouping';
import { genUserName } from '@/lib/genUserName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import type {
  ActorInfo,
  NotificationFilters,
  NotificationItem,
  RawNotification,
} from '@/types/notification';

interface HydratedResult {
  items: NotificationItem[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  unreadCount: number;
}

export function useHydratedNotifications(filters: NotificationFilters): HydratedResult {
  const notifications = useNotifications(filters);

  const flatRaw: RawNotification[] = useMemo(
    () => notifications.data?.pages.flatMap((p) => p.notifications) ?? [],
    [notifications.data?.pages],
  );

  const uniqueActorPubkeys = useMemo(
    () => Array.from(new Set(flatRaw.map((n) => n.actorPubkey))),
    [flatRaw],
  );

  const uniqueVideoIds = useMemo(
    () => Array.from(
      new Set(
        flatRaw
          .filter((n) => n.type !== 'follow' && n.targetEventId)
          .map((n) => n.targetEventId as string),
      ),
    ),
    [flatRaw],
  );

  const authors = useBatchedAuthors(uniqueActorPubkeys);
  const videos = useNotificationVideos(uniqueVideoIds);

  const items = useMemo(() => {
    const profilesMap = new Map<string, ActorInfo>();
    if (authors.data) {
      for (const [pubkey, author] of Object.entries(authors.data) as [string, { metadata?: { name?: string; display_name?: string; picture?: string; nip05?: string } }][]) {
        const metadata = author.metadata;
        profilesMap.set(pubkey, {
          pubkey,
          displayName:
            metadata?.display_name || metadata?.name || genUserName(pubkey),
          avatarUrl: getSafeProfileImage(metadata?.picture),
          nip05: metadata?.nip05,
        });
      }
    }

    if (filters.category === 'unread') {
      // No grouping: one row per raw notification. Reuse the grouper but
      // force unique keys by giving each item a fresh targetEventId-derived
      // group bucket — simpler: synthesize singletons.
      return flatRaw
        .map((n) => groupRawNotifications([n], profilesMap, videos.data ?? new Map()))
        .flat();
    }

    return groupRawNotifications(flatRaw, profilesMap, videos.data ?? new Map());
  }, [flatRaw, authors.data, videos.data, filters.category]);

  return {
    items,
    isLoading: notifications.isLoading,
    isError: notifications.isError,
    error: notifications.error,
    fetchNextPage: notifications.fetchNextPage,
    hasNextPage: !!notifications.hasNextPage,
    isFetchingNextPage: notifications.isFetchingNextPage,
    unreadCount: notifications.data?.pages[0]?.unreadCount ?? 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useHydratedNotifications.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useHydratedNotifications.ts src/hooks/useHydratedNotifications.test.ts
git commit -m "feat(notifications): useHydratedNotifications orchestrator"
```

---

## Chunk 3: Row components

### Task 7: `NotificationAvatarStack`

**Files:**
- Create: `src/components/notifications/NotificationAvatarStack.tsx`
- Create: `src/components/notifications/NotificationAvatarStack.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/notifications/NotificationAvatarStack.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NotificationAvatarStack } from './NotificationAvatarStack';
import type { ActorInfo } from '@/types/notification';

const actor = (i: number): ActorInfo => ({
  pubkey: 'p' + i,
  displayName: 'User ' + i,
});

describe('NotificationAvatarStack', () => {
  it('renders one avatar with no overflow circle when single actor', () => {
    render(<NotificationAvatarStack actors={[actor(1)]} totalCount={1} />);
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(0);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('renders +N overflow when totalCount > actors.length', () => {
    render(<NotificationAvatarStack actors={[actor(1), actor(2), actor(3)]} totalCount={14} />);
    expect(screen.getByText('+11')).toBeInTheDocument();
  });

  it('renders no overflow when totalCount === actors.length', () => {
    render(<NotificationAvatarStack actors={[actor(1), actor(2)]} totalCount={2} />);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/notifications/NotificationAvatarStack.test.tsx`
Expected: fails — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/notifications/NotificationAvatarStack.tsx
// ABOUTME: Overlapping avatar stack with optional "+N" overflow circle.
// ABOUTME: Up to 3 avatars; overflow when totalCount > actors.length.

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ActorInfo } from '@/types/notification';

interface Props {
  actors: ActorInfo[];
  totalCount: number;
  className?: string;
}

export function NotificationAvatarStack({ actors, totalCount, className }: Props) {
  const overflow = Math.max(0, totalCount - actors.length);
  return (
    <div className={cn('flex items-center', className)} aria-hidden={false}>
      {actors.map((actor, i) => (
        <Avatar
          key={actor.pubkey}
          size="sm"
          className={cn(
            'h-7 w-7 ring-2 ring-background',
            i > 0 && '-ml-2',
          )}
        >
          <AvatarImage src={actor.avatarUrl} alt={actor.displayName} />
          <AvatarFallback>{actor.displayName[0]?.toUpperCase() || '?'}</AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'flex h-7 min-w-7 items-center justify-center rounded-full bg-muted px-1 text-[11px] font-semibold text-muted-foreground ring-2 ring-background',
            actors.length > 0 && '-ml-2',
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/notifications/NotificationAvatarStack.test.tsx`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/notifications/NotificationAvatarStack.tsx src/components/notifications/NotificationAvatarStack.test.tsx
git commit -m "feat(notifications): NotificationAvatarStack with +N overflow"
```

---

### Task 8: `NotificationTypeIconChip`

**Files:**
- Create: `src/components/notifications/NotificationTypeIconChip.tsx`
- Create: `src/components/notifications/NotificationTypeIconChip.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/notifications/NotificationTypeIconChip.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NotificationTypeIconChip } from './NotificationTypeIconChip';

describe('NotificationTypeIconChip', () => {
  it('renders a chip with an svg icon for each type', () => {
    const { rerender } = render(
      <NotificationTypeIconChip type="like" isRead={false} />,
    );
    expect(screen.getByTestId('notification-type-chip')).toBeInTheDocument();
    rerender(<NotificationTypeIconChip type="comment" isRead={false} />);
    expect(screen.getByTestId('notification-type-chip')).toBeInTheDocument();
    rerender(<NotificationTypeIconChip type="repost" isRead={false} />);
    expect(screen.getByTestId('notification-type-chip')).toBeInTheDocument();
    rerender(<NotificationTypeIconChip type="follow" isRead={false} />);
    expect(screen.getByTestId('notification-type-chip')).toBeInTheDocument();
  });

  it('applies a different background for read vs unread', () => {
    const { rerender } = render(<NotificationTypeIconChip type="like" isRead={false} />);
    const unread = screen.getByTestId('notification-type-chip').className;
    rerender(<NotificationTypeIconChip type="like" isRead={true} />);
    const read = screen.getByTestId('notification-type-chip').className;
    expect(unread).not.toEqual(read);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/notifications/NotificationTypeIconChip.test.tsx`
Expected: fails — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/notifications/NotificationTypeIconChip.tsx
// ABOUTME: 32×32 leading icon chip for notification rows; colored per action,
// ABOUTME: filled vs outline based on read state.

import { Heart, ChatCircle, Repeat, UserPlus } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { NotificationType } from '@/types/notification';

interface Props {
  type: NotificationType;
  isRead: boolean;
}

const CONFIG: Record<NotificationType, { icon: React.ElementType; bgUnread: string; bgRead: string; icon_color: string }> = {
  like:    { icon: Heart,      bgUnread: 'bg-red-500/15',    bgRead: 'bg-muted',  icon_color: 'text-red-500' },
  comment: { icon: ChatCircle, bgUnread: 'bg-blue-500/15',   bgRead: 'bg-muted',  icon_color: 'text-blue-500' },
  repost:  { icon: Repeat,     bgUnread: 'bg-green-500/15',  bgRead: 'bg-muted',  icon_color: 'text-green-500' },
  follow:  { icon: UserPlus,   bgUnread: 'bg-violet-500/15', bgRead: 'bg-muted',  icon_color: 'text-violet-500' },
};

export function NotificationTypeIconChip({ type, isRead }: Props) {
  const { icon: Icon, bgUnread, bgRead, icon_color } = CONFIG[type];
  return (
    <span
      data-testid="notification-type-chip"
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        isRead ? bgRead : bgUnread,
      )}
    >
      <Icon
        className={cn('h-4 w-4', icon_color)}
        weight={isRead ? 'bold' : 'fill'}
      />
    </span>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/notifications/NotificationTypeIconChip.test.tsx`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/notifications/NotificationTypeIconChip.tsx src/components/notifications/NotificationTypeIconChip.test.tsx
git commit -m "feat(notifications): NotificationTypeIconChip leading icon"
```

---

### Task 9: `NotificationVideoThumbnail`

**Files:**
- Create: `src/components/notifications/NotificationVideoThumbnail.tsx`
- Create: `src/components/notifications/NotificationVideoThumbnail.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/notifications/NotificationVideoThumbnail.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationVideoThumbnail } from './NotificationVideoThumbnail';

describe('NotificationVideoThumbnail', () => {
  it('renders the image when thumbnailUrl is provided', () => {
    render(
      <NotificationVideoThumbnail
        thumbnailUrl="https://example.com/t.jpg"
        title="Bridge"
        onClick={() => {}}
      />,
    );
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/t.jpg');
  });

  it('renders a placeholder when thumbnailUrl is missing', () => {
    render(<NotificationVideoThumbnail onClick={() => {}} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('notification-video-thumb-placeholder')).toBeInTheDocument();
  });

  it('fires onClick on click and stops propagation', () => {
    const onClick = vi.fn();
    const onParent = vi.fn();
    render(
      <div onClick={onParent}>
        <NotificationVideoThumbnail thumbnailUrl="x" title="T" onClick={onClick} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onParent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/notifications/NotificationVideoThumbnail.test.tsx`
Expected: fails — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/notifications/NotificationVideoThumbnail.tsx
// ABOUTME: 72×72 rounded thumbnail for a notification's referenced video,
// ABOUTME: with a brand placeholder when the image is missing.

import { Play } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface Props {
  thumbnailUrl?: string;
  title?: string;
  onClick: () => void;
  className?: string;
}

export function NotificationVideoThumbnail({ thumbnailUrl, title, onClick, className }: Props) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={title ? `Open ${title}` : 'Open video'}
      className={cn(
        'group relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[14px] border-2 border-foreground/80',
        className,
      )}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title ?? ''}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          data-testid="notification-video-thumb-placeholder"
          className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground"
        >
          <Play className="h-6 w-6" weight="fill" />
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/notifications/NotificationVideoThumbnail.test.tsx`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/notifications/NotificationVideoThumbnail.tsx src/components/notifications/NotificationVideoThumbnail.test.tsx
git commit -m "feat(notifications): NotificationVideoThumbnail with placeholder"
```

---

### Task 10: `VideoNotificationRow`

**Files:**
- Create: `src/components/notifications/VideoNotificationRow.tsx`
- Create: `src/components/notifications/VideoNotificationRow.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/notifications/VideoNotificationRow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { VideoNotificationRow } from './VideoNotificationRow';
import type { VideoNotification } from '@/types/notification';

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => vi.fn(),
}));

function renderRow(props: { notification: VideoNotification }) {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <VideoNotificationRow {...props} />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

const base: VideoNotification = {
  kind: 'video',
  type: 'like',
  id: 'g1',
  rawIds: ['g1'],
  timestamp: Math.floor(Date.now() / 1000) - 30,
  isRead: false,
  videoEventId: 'v1',
  videoTitle: 'Bridge in Amsterdam',
  videoThumbnailUrl: 'https://example.com/t.jpg',
  actors: [{ pubkey: 'a', displayName: 'Samm' }],
  totalCount: 1,
};

describe('VideoNotificationRow', () => {
  it('renders single-actor message with bold video title', () => {
    renderRow({ notification: base });
    expect(screen.getByText('Samm')).toBeInTheDocument();
    expect(screen.getByText('Bridge in Amsterdam')).toBeInTheDocument();
    expect(screen.getByText(/liked your video/i)).toBeInTheDocument();
  });

  it('renders multi-actor message with "and N others"', () => {
    renderRow({
      notification: { ...base, totalCount: 14, actors: [{ pubkey: 'a', displayName: 'Samm' }, { pubkey: 'b', displayName: 'Bob' }, { pubkey: 'c', displayName: 'Carol' }] },
    });
    expect(screen.getByText(/13 others/)).toBeInTheDocument();
    expect(screen.getByText('+11')).toBeInTheDocument();
  });

  it('renders comment quote when type is comment and commentText is set', () => {
    renderRow({
      notification: { ...base, type: 'comment', commentText: 'so good', totalCount: 1 },
    });
    expect(screen.getByText(/so good/)).toBeInTheDocument();
  });

  it('renders a thumbnail with the title', () => {
    renderRow({ notification: base });
    expect(screen.getByRole('img', { name: 'Bridge in Amsterdam' })).toBeInTheDocument();
  });

  it('renders a placeholder thumbnail when videoThumbnailUrl is missing', () => {
    renderRow({ notification: { ...base, videoThumbnailUrl: undefined } });
    expect(screen.getByTestId('notification-video-thumb-placeholder')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/notifications/VideoNotificationRow.test.tsx`
Expected: fails — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/notifications/VideoNotificationRow.tsx
// ABOUTME: One row for a video-anchored grouped notification — leading
// ABOUTME: type-icon chip, avatar stack + message, 72×72 thumbnail.

import { useTranslation } from 'react-i18next';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { buildProfileLinkPath } from '@/lib/profileLinks';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/notificationTransform';
import { NotificationAvatarStack } from './NotificationAvatarStack';
import { NotificationTypeIconChip } from './NotificationTypeIconChip';
import { NotificationVideoThumbnail } from './NotificationVideoThumbnail';
import type { VideoNotification } from '@/types/notification';

interface Props {
  notification: VideoNotification;
}

const VERB_KEYS: Record<VideoNotification['type'], string> = {
  like: 'notificationsPage.message.liked',
  comment: 'notificationsPage.message.commented',
  repost: 'notificationsPage.message.reposted',
};

export function VideoNotificationRow({ notification }: Props) {
  const navigate = useSubdomainNavigate();
  const { t } = useTranslation();
  const { actors, totalCount, type, videoTitle, videoThumbnailUrl, videoEventId, isRead, timestamp, commentText } = notification;

  const openVideo = () => navigate(`/video/${videoEventId}`);
  const openActor = (pubkey: string, nip05?: string) =>
    navigate(buildProfileLinkPath({ pubkey, nip05, fallbackRoute: 'profile' }));

  const verb = t(VERB_KEYS[type]);
  const othersCount = totalCount - 1;
  const time = formatRelativeTime(timestamp);
  const titleText = videoTitle ?? t('notificationsPage.video.untitled');

  return (
    <button
      type="button"
      onClick={openVideo}
      className={cn(
        'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50',
        !isRead && 'bg-muted/30',
      )}
    >
      <NotificationTypeIconChip type={type} isRead={isRead} />

      <div className="flex-1 min-w-0">
        <div
          onClick={(e) => {
            // The avatars themselves are non-interactive in v1 to keep tap
            // semantics simple — clicking the stack opens the video.
            e.stopPropagation();
            openVideo();
          }}
          className="mb-2 inline-block"
        >
          <NotificationAvatarStack actors={actors} totalCount={totalCount} />
        </div>
        <p className="text-sm leading-snug">
          <span
            className="font-semibold text-foreground hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              openActor(actors[0].pubkey, actors[0].nip05);
            }}
          >
            {actors[0].displayName}
          </span>
          {othersCount > 0 && (
            <>
              <span className="text-muted-foreground"> {t('notificationsPage.message.andConnector')} </span>
              <span className="font-semibold text-foreground">
                {t('notificationsPage.message.andOthers', { count: othersCount })}
              </span>
            </>
          )}
          <span className="text-muted-foreground"> {verb} </span>
          <span className="font-semibold text-foreground">{titleText}</span>
          <span className="text-muted-foreground"> · {time}</span>
        </p>
        {type === 'comment' && commentText && (
          <p className="mt-1 line-clamp-2 rounded bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
            "{commentText}"
          </p>
        )}
      </div>

      <NotificationVideoThumbnail
        thumbnailUrl={videoThumbnailUrl}
        title={videoTitle}
        onClick={openVideo}
      />
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

You'll need to add the missing i18n keys in English so the tests render. In `src/lib/i18n/locales/en/common.json`, inside `notificationsPage`, add:

```json
"message": {
  "liked": "liked your video",
  "commented": "commented on your video",
  "reposted": "reposted your video",
  "followed": "followed you",
  "andConnector": "and",
  "andOthers_one": "{{count}} other",
  "andOthers_other": "{{count}} others"
},
"video": {
  "untitled": "your video"
}
```

(If the project uses a different pluralization format, follow the existing convention. Confirm by inspecting other plural keys in the file.)

Run: `npx vitest run src/components/notifications/VideoNotificationRow.test.tsx`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/notifications/VideoNotificationRow.tsx src/components/notifications/VideoNotificationRow.test.tsx src/lib/i18n/locales/en/common.json
git commit -m "feat(notifications): VideoNotificationRow with avatar stack + thumbnail"
```

---

### Task 11: `ActorNotificationRow`

**Files:**
- Create: `src/components/notifications/ActorNotificationRow.tsx`
- Create: `src/components/notifications/ActorNotificationRow.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/notifications/ActorNotificationRow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { ActorNotificationRow } from './ActorNotificationRow';
import type { ActorNotification } from '@/types/notification';

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => vi.fn(),
}));

const base: ActorNotification = {
  kind: 'actor',
  type: 'follow',
  id: 'f1',
  rawIds: ['f1'],
  timestamp: Math.floor(Date.now() / 1000) - 60,
  isRead: false,
  actor: { pubkey: 'a', displayName: 'Erica' },
};

describe('ActorNotificationRow', () => {
  it('renders follower name and "followed you"', () => {
    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <ActorNotificationRow notification={base} />
        </I18nextProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Erica')).toBeInTheDocument();
    expect(screen.getByText(/followed you/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/notifications/ActorNotificationRow.test.tsx`
Expected: fails — module not found.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/notifications/ActorNotificationRow.tsx
// ABOUTME: One row for actor-anchored notifications (follows). Single avatar.
// ABOUTME: No video thumbnail. Whole row navigates to actor's profile.

import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { buildProfileLinkPath } from '@/lib/profileLinks';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/notificationTransform';
import { NotificationTypeIconChip } from './NotificationTypeIconChip';
import type { ActorNotification } from '@/types/notification';

interface Props { notification: ActorNotification }

export function ActorNotificationRow({ notification }: Props) {
  const navigate = useSubdomainNavigate();
  const { t } = useTranslation();
  const { actor, isRead, timestamp } = notification;

  const openProfile = () =>
    navigate(buildProfileLinkPath({ pubkey: actor.pubkey, nip05: actor.nip05, fallbackRoute: 'profile' }));

  return (
    <button
      type="button"
      onClick={openProfile}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50',
        !isRead && 'bg-muted/30',
      )}
    >
      <NotificationTypeIconChip type="follow" isRead={isRead} />
      <Avatar size="sm" className="h-7 w-7">
        <AvatarImage src={actor.avatarUrl} alt={actor.displayName} />
        <AvatarFallback>{actor.displayName[0]?.toUpperCase() || '?'}</AvatarFallback>
      </Avatar>
      <p className="flex-1 text-sm">
        <span className="font-semibold text-foreground">{actor.displayName}</span>
        <span className="text-muted-foreground"> {t('notificationsPage.message.followed')} · {formatRelativeTime(timestamp)}</span>
      </p>
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/notifications/ActorNotificationRow.test.tsx`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/notifications/ActorNotificationRow.tsx src/components/notifications/ActorNotificationRow.test.tsx
git commit -m "feat(notifications): ActorNotificationRow for follows"
```

---

## Chunk 4: Page integration and cleanup

### Task 12: Wire `NotificationsPage` to new rows, drop Zaps tab

**Files:**
- Modify: `src/pages/NotificationsPage.tsx`
- Modify: `src/pages/NotificationsPage.test.tsx`
- Modify: `src/lib/i18n/locales/en/common.json` (remove zaps keys)

- [ ] **Step 1: Read current tests, prune zap-related cases**

Open `src/pages/NotificationsPage.test.tsx`. Delete any test that exercises the `'zaps'` tab. Add (or adapt) two new tests:

```tsx
it('does not render a Zaps tab', () => {
  // setup as for existing tests
  expect(screen.queryByRole('tab', { name: /zaps/i })).not.toBeInTheDocument();
});

it('renders a VideoNotificationRow when given a grouped video notification', async () => {
  // mock useHydratedNotifications to return one VideoNotification
  // assert the thumbnail + message render
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/NotificationsPage.test.tsx`
Expected: fails.

- [ ] **Step 3: Edit `NotificationsPage.tsx`**

Key changes:
- Remove `'zaps'` from `NOTIFICATION_TAB_VALUES` and `EMPTY_STATE_COPY`.
- Replace `useNotifications` with `useHydratedNotifications(filters)`.
- Replace `notifications.map((n) => <NotificationItem … />)` with:

```tsx
{items.map((item) =>
  item.kind === 'video'
    ? <VideoNotificationRow key={item.id} notification={item} />
    : <ActorNotificationRow key={item.id} notification={item} />
)}
```

- The `newNotifications` / `earlierNotifications` split still works — it filters the hydrated `items` against `initialUnreadIds`. Capture `initialUnreadIds` from `item.rawIds` (the union of every group's raw ids that were unread on first load).

Concrete adjustments:

```tsx
// inside the effect that captures initial unread
const unreadIds = items
  .filter((n) => !n.isRead)
  .flatMap((n) => n.rawIds);
```

And the membership check becomes:

```tsx
const isNew = (item: NotificationItem) =>
  item.rawIds.some((id) => initialUnreadIds.has(id));
```

- [ ] **Step 4: Run tests + type-check**

Run: `npx vitest run src/pages/NotificationsPage.test.tsx`
Run: `npx tsc --noEmit`
Expected: notifications-page tests pass; the only remaining type errors should be from `src/components/NotificationItem.tsx` (deleted in the next task).

- [ ] **Step 5: Drop zap keys from English locale**

Open `src/lib/i18n/locales/en/common.json` and delete `notificationsPage.tabs.zaps` and `notificationsPage.empty.zaps`. Do the same for every other locale file in `src/lib/i18n/locales/*/common.json` (a quick script: `for f in src/lib/i18n/locales/*/common.json; do node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('$f','utf8'));delete j.notificationsPage?.tabs?.zaps;delete j.notificationsPage?.empty?.zaps;fs.writeFileSync('$f', JSON.stringify(j, null, 2)+'\n');"; done`).

- [ ] **Step 6: Commit**

```bash
git add src/pages/NotificationsPage.tsx src/pages/NotificationsPage.test.tsx src/lib/i18n/locales
git commit -m "feat(notifications): page wired to grouped rows; zaps tab removed"
```

---

### Task 13: Delete the old `NotificationItem` and verify

**Files:**
- Delete: `src/components/NotificationItem.tsx`
- Delete: `src/components/NotificationItem.test.tsx` (if it exists)

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -rn "NotificationItem" src/ | grep -v "notifications/" | grep -v ".test."`
Expected: no results (or only matches inside the deleted files).

- [ ] **Step 2: Delete files**

```bash
git rm src/components/NotificationItem.tsx
git rm src/components/NotificationItem.test.tsx 2>/dev/null || true
```

- [ ] **Step 3: Full test + type-check sweep**

Run: `npx tsc --noEmit`
Run: `npm test`
Run: `npx vitest run tests/brand`
Expected: all green. If anything fails, fix root cause (do NOT skip tests).

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(notifications): delete legacy NotificationItem"
```

---

### Task 14: Manual QA + screenshot diff

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Open the notifications page logged in as a user with real activity**

Open `http://localhost:5173/notifications`.

- [ ] **Step 3: Check each tab**

For each of **All / Unread / Likes / Comments / Follows / Reposts** verify:
- Zaps tab is gone.
- Video rows show the colored type-icon chip, an avatar stack with `+N` when applicable, a bold video title, and a 72×72 thumbnail.
- Comment rows show the quoted comment text under the message.
- Follow rows show no thumbnail and the violet user-plus chip.
- Unread tab shows raw, ungrouped rows in chronological order.
- Network panel: hydrating a page issues a `POST /api/users/bulk` (or WS fallback) and one `GET /api/videos/{id}` per unique referenced event id. No N×N waterfalls.
- Marking-as-read still works (refresh and verify the row no longer has the "New" treatment).
- Clicking a row navigates to the video; clicking an avatar navigates to that user's profile (open the avatar stack click handlers in the row component if the design requires per-avatar navigation — v1 keeps avatars purely visual; navigation is the row click).

- [ ] **Step 4: Capture before/after screenshots**

Take a screenshot of the page and attach it to the PR description.

- [ ] **Step 5: Commit any QA fixes, push, open PR**

```bash
git push -u origin notifications-video-grouping-web
gh pr create --title "feat(notifications): video-anchored grouping + thumbnails" --body "$(cat <<'EOF'
## Summary
- Ports divine-mobile's notifications redesign to web
- Groups likes / comments / reposts by (videoEventId, kind)
- Adds avatar stack with "+N" overflow, leading colored type-icon chip, 72×72 video thumbnail
- Hides zaps from the UI

## Test plan
- [ ] All notifications page tabs render correctly (All / Unread / Likes / Comments / Follows / Reposts)
- [ ] Zaps tab is removed
- [ ] Video rows show thumbnails and bold titles
- [ ] Comment rows show the quoted comment text
- [ ] Follow rows show the violet user-plus chip and no thumbnail
- [ ] Unread tab shows ungrouped chronological rows
- [ ] Marking-as-read clears the "New" treatment after refresh
- [ ] No N×N network waterfalls — one bulk-users call + one fetchVideoById per unique referenced event id

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Open questions (carried from spec)

These are deliberately deferred to follow-ups:

- "See all actors" sheet when clicking the `+N` overflow circle.
- Per-avatar navigation in the stack (v1 keeps avatars visual, row click opens the video).
- Zaps treatment (likely a `VideoNotification` variant once we decide).
- Server-side `referenced_event_title` / `thumbnail_url` so we can drop the client-side video fan-out.
