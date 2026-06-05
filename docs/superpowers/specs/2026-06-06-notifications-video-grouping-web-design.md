# Notifications: video-anchored grouping + thumbnails (web)

**Date:** 2026-06-06
**Owner:** rabble
**Status:** Proposal — spec for implementation
**Related:**
- `divine-mobile/docs/superpowers/specs/2026-05-04-notifications-video-grouping-thumbnails-design.md` (mobile equivalent; this spec ports its decisions to web)
- `src/pages/NotificationsPage.tsx` (current implementation)
- `src/components/NotificationItem.tsx` (current row)
- `src/hooks/useNotifications.ts` (data layer)

---

## Problem

The web notifications page (`/notifications`) renders the Funnelcake notification feed as a flat list, one row per raw event:

- 14 likes on one video = 14 visually-identical rows.
- No video title or thumbnail anywhere on the row, so the user can't tell *which* of their videos got liked.
- Visually noisy and hard to scan compared to the mobile app.

Mobile already solved this with `(videoEventId, kind)` grouping, avatar stacks, and thumbnails. Web should adopt the same model and layout, adapted to the wider container.

## Goals

1. **One row per `(video, kind)`.** Likes on video X collapse into a single row regardless of count.
2. **Video thumbnail + bold title on every video-anchored row** so the user immediately knows which of their videos was touched.
3. **Avatar stack with overflow count** (e.g., "+11") for multi-actor groups.
4. **Leading colored type icon** (heart / repost / chat-bubble) for at-a-glance action recognition.
5. Keep the existing "All / Unread / Likes / Comments / Follows / Reposts" tab structure and the "New / Earlier" split.

## Non-goals

- Backend changes. The Funnelcake notifications endpoint stays as-is; hydration is client-side.
- Realtime/WebSocket notification merging (web doesn't have realtime notifications today; out of scope).
- Zap notifications. **Hide zaps entirely from the UI for now** (remove the "Zaps" tab, drop zap rows from "All"). Revisit in a follow-up once we decide whether zaps anchor to a video or to the actor.
- Push notifications.
- Comment-reply quoting redesign (we keep the current single-comment quote behavior).

---

## Design

### Type model: sealed split

Replace the current flat `Notification` type with a sealed union mirroring mobile.

```ts
// src/types/notification.ts

export type NotificationType = 'like' | 'comment' | 'follow' | 'repost';
// 'zap' removed — hidden for now (see Non-goals).

interface BaseNotification {
  id: string;
  timestamp: number;   // Unix seconds, of the newest event in the group
  isRead: boolean;
}

export interface ActorInfo {
  pubkey: string;
  displayName: string;
  avatarUrl?: string;
}

/** One row per (video × kind). 1 actor or N actors — same row shape. */
export interface VideoNotification extends BaseNotification {
  kind: 'video';
  type: 'like' | 'comment' | 'repost';
  videoEventId: string;
  videoTitle?: string;
  videoThumbnailUrl?: string;
  actors: ActorInfo[];      // length 1..3
  totalCount: number;       // total people; may exceed actors.length
  /** First comment text in the group (for type === 'comment' only). */
  commentText?: string;
}

/** Actor-anchored — follows. No video. */
export interface ActorNotification extends BaseNotification {
  kind: 'actor';
  type: 'follow';
  actor: ActorInfo;
}

export type NotificationItem = VideoNotification | ActorNotification;
```

The current `Notification` interface and `NotificationItem.tsx` (the renderer) go away. Callers exhaustively switch on `notification.kind`.

### Data layer: group + hydrate after fetch

`useNotifications` continues to call Funnelcake and returns the raw paginated response. A new layer transforms raw → grouped + hydrated `NotificationItem[]`:

```ts
// src/lib/notificationGrouping.ts (new)

export function groupRawNotifications(
  raw: RawApiNotification[],
  profiles: Map<string /* pubkey */, ProfileMetadata>,
  videos: Map<string /* eventId */, { title?: string; thumbnailUrl?: string }>,
): NotificationItem[];
```

**Grouping rule:**

- Filter out zap notifications (`notification_type === 'zap'`).
- Filter out video-anchored notifications (`reaction`, `reply`, `repost`) with a null `referenced_event_id` — they're not actionable.
- Group video-anchored by `(referenced_event_id, type)`.
  - `actors` = first 3 sorted newest-first.
  - `totalCount` = full group size.
  - `timestamp` = newest event's timestamp.
  - `isRead` = true iff every notification in the group is read.
  - For `type: 'comment'`, `commentText` = the first (newest) raw notification's `content`.
- Follow notifications → one `ActorNotification` per raw event, no further grouping.
- Final list is sorted by `timestamp` desc.

**Hydration:**

A new hook `useHydratedNotifications(filters)` wraps `useNotifications`, then in parallel:

1. Collects all unique actor pubkeys → resolves via the existing `useBatchedAuthors`/profile cache.
2. Collects all unique `referenced_event_id`s → calls `fetchVideoById` for each in parallel (the existing `/api/videos/{id}` endpoint returns title + thumbnail). Results are cached in a `Map` and via React Query (`['notification-video', eventId]`) with `staleTime: 10 * 60 * 1000` so re-renders and tab switches don't re-fetch.
3. Once both are resolved, runs `groupRawNotifications(raw, profilesMap, videosMap)`.

Failures per-video are tolerated: the row renders with a placeholder thumbnail and falls back to "your video" (no title) — exactly mobile's degraded path.

### Filter tabs

- **All:** grouped, with the existing "New / Earlier" sections preserved.
- **Likes / Comments / Follows / Reposts:** grouped by video×type within that single type.
- **Unread:** ungrouped, raw chronological. Rationale: users come here to triage individual unread events; collapsing across days hides what's new.
- **Zaps tab:** removed.

### Layout — web row

Web container is `max-w-2xl` (≈672px), so we have more room than mobile's full-width row. Two row shapes:

**`VideoNotification` row:**

```
┌─ NotificationsPage row ──────────────────────────────────────────────────┐
│  [♥]    (○○○+11)  Samm and 13 others liked your video                    │
│ red-chip avatars-row  **Bridge in Amsterdam** · 29m         [▶ 72×72]   │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Leading type-icon chip** (32×32, rounded): heart for like (red), repost arrow for repost (green), chat bubble for comment (blue). Filled icon when unread, outline when read.
- **Avatar stack** in the message column (NOT in the leading chip column — web has the room): up to 3 overlapping 28×28 avatars + a "+N" overflow circle if `totalCount > actors.length`. Each avatar is a clickable link to that actor's profile.
- **Message text:** `<bold>{actors[0].displayName}</bold> {verb}` + (for video types) ` <bold>{videoTitle}</bold>` + `· {relativeTime}` in muted ink. If `totalCount > 1`: `<bold>{actors[0].displayName}</bold> and <bold>{totalCount - 1} others</bold> {verb}…`. Single actor name even if 50 — matches mobile.
- **Comment quote** (for `type: 'comment'`): below the message, in a muted rounded box with the relative time appended inside the quote (matches mobile's `NotificationCommentQuote`).
- **Video thumbnail** on the right: 72×72 with the brand `Card` border + 14px radius. Clickable → opens the video. (If `videoThumbnailUrl` is missing, render a placeholder square with the brand `BrandLogo` muted icon.)
- **Unread state:** subtle `bg-muted/30` background on the whole row + the type-icon chip is filled instead of outlined. No bright dot.

**`ActorNotification` (follow) row** keeps roughly today's layout:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [+]   (●)  **Erica** followed you · 52m                                  │
│ violet                                                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

- Leading violet user-plus icon chip.
- Single 28×28 avatar.
- Bold name + " followed you" + relative time. No thumbnail column.
- Clickable row → actor's profile.

**Tap targets:**

- Click on row body (anywhere except thumbnail / avatar stack) → navigate to the video (video rows) or profile (actor rows).
- Click on thumbnail → navigate to the video.
- Click on a single avatar in the stack → that actor's profile.
- Click on the "+N" overflow → no-op for v1 (mobile punts the "see all actors" sheet to a follow-up; we do the same).

### Components

New files:

- `src/types/notification.ts` — replaces the existing flat type with the sealed union above.
- `src/lib/notificationGrouping.ts` — pure transform `raw + profiles + videos → NotificationItem[]`.
- `src/lib/notificationGrouping.test.ts` — unit tests for the grouping rules.
- `src/hooks/useHydratedNotifications.ts` — orchestrates raw fetch + profile batch + video batch + group.
- `src/hooks/useHydratedNotifications.test.ts`.
- `src/components/notifications/VideoNotificationRow.tsx` — the new shared row for like/comment/repost.
- `src/components/notifications/ActorNotificationRow.tsx` — single-row for follows.
- `src/components/notifications/NotificationAvatarStack.tsx` — overlapping avatars + overflow circle.
- `src/components/notifications/NotificationTypeIconChip.tsx` — colored leading chip.
- `src/components/notifications/NotificationVideoThumbnail.tsx` — 72×72 thumbnail with brand border + placeholder.
- Tests alongside each component.

Modified:

- `src/pages/NotificationsPage.tsx` — switch on `notification.kind` to choose row; drop the Zaps tab; keep tabs + "New / Earlier" sections + infinite scroll + mark-as-read.
- `src/hooks/useNotifications.ts` — drop `'zaps'` from `CATEGORY_TYPES`. The raw shape it returns doesn't change; hydration moves to the new hook.
- Delete `src/components/NotificationItem.tsx` after the new rows are in.
- Delete the legacy `Notification` interface and any tests that imported it (replace with new types).

### Brand alignment

- All icons from `@phosphor-icons/react` per CLAUDE.md (`Heart`, `Repeat`, `ChatCircle`, `UserPlus`). `weight="fill"` for unread / `weight="bold"` for read — matches active-state convention.
- Type-icon chip colors come from the existing brand accent set (red/green/blue/violet are existing utilities). No new utilities required.
- Thumbnail uses `Card variant="brand"` (no shadow, just the border + 14px radius) for visual consistency with `VideoCard`. No gradients.
- Message text uses `text-foreground` for bold spans and `text-muted-foreground` for verb + timestamp. No `uppercase`.

---

## Testing strategy

**`notificationGrouping.test.ts`:**

- Single like on video X → 1 `VideoNotification` with `actors.length === 1`, `totalCount === 1`.
- 5 likes on video X → 1 `VideoNotification` with `actors.length === 3`, `totalCount === 5`.
- 5 likes on 5 different videos → 5 separate `VideoNotification`s.
- Likes + comments on the same video → 2 `VideoNotification`s (different `type`).
- Zap raw row → filtered out (not present in output).
- Video-anchored raw row with `referenced_event_id == null` → filtered out.
- Follow raw row → `ActorNotification`, never grouped.
- Output sorted by `timestamp` desc.
- Group `isRead` is true iff every raw row in the group is read.
- Hydration failures (missing video in `videos` map) → row still produced, with `videoTitle`/`videoThumbnailUrl` undefined.

**`useHydratedNotifications.test.ts`:**

- Returns grouped data once raw + profiles + videos resolve.
- Profile fetch error → degraded actor (displayName falls back to `genUserName`), no throw.
- Video fetch error for one ID → that group still renders with placeholder.
- Filter tab `'unread'` → returns ungrouped raw-as-individual notifications (each raw row becomes its own one-actor `VideoNotification` / `ActorNotification`).

**Component tests:**

- `VideoNotificationRow` with 1 actor → 1 avatar, no overflow circle, single-name message.
- `VideoNotificationRow` with 5 actors / `totalCount: 14` → 3 avatars + "+11" overflow, "Samm and 13 others" message.
- `VideoNotificationRow` with `type: 'comment'` and `commentText` → comment quote rendered with timestamp appended.
- `VideoNotificationRow` clicking thumbnail vs row body vs avatar → fires correct navigation.
- `VideoNotificationRow` missing `videoThumbnailUrl` → placeholder thumbnail rendered.
- `ActorNotificationRow` (follow) → single avatar, "followed you" message, navigates to profile on click.
- `NotificationAvatarStack` with `actors.length === 1`, no overflow → renders just the one avatar, no `+N`.
- `NotificationsPage` Zaps tab → not present.
- `NotificationsPage` Unread tab → renders ungrouped raw items.

**Brand guardrail tests** already enforce no `uppercase`, no gradients, no `lucide-react`. New components must pass.

---

## Migration

Single PR. The old `NotificationItem` component and the flat `Notification` type are local to the notifications feature — no external consumers. Replace exhaustively, no compatibility shim.

i18n: The existing keys under `notificationsPage.tabs.zaps` and `notificationsPage.empty.zaps` become unused — remove them. New keys needed:

- `notificationsPage.message.liked` — "liked your video"
- `notificationsPage.message.commented` — "commented on your video"
- `notificationsPage.message.reposted` — "reposted your video"
- `notificationsPage.message.followed` — "followed you"
- `notificationsPage.message.andOthers` — "and {{count}} others" (plural-aware)
- `notificationsPage.video.untitled` — placeholder label when title is missing

---

## Open questions

1. **Overflow click — sheet or no-op?** Mobile punted the "see who else" sheet to a follow-up. Recommend the same here; the "+N" circle is non-interactive in v1.
2. **Video unavailable (404)** — render with placeholder + tap is a no-op + brief toast on click? Or hide the row entirely? Recommend **render with placeholder, tap is a no-op + toast** — matches mobile's "Video not found" handling.
3. **Mark-as-read semantics with grouping** — when a grouped row is marked read, we mark *all* underlying raw notification IDs read in one mutation call. The mutation already accepts an array of IDs.

---

## Rollout

Single PR. No feature flag. Strictly an improvement; degraded path (network failures) is no worse than today.

1. Land types + grouping transform + tests.
2. Land hydration hook + tests.
3. Land row components + tests.
4. Update `NotificationsPage` to use new rows + drop Zaps + tests.
5. Delete old `NotificationItem.tsx` + flat type.
6. Manual QA: scroll a real notifications page with mixed likes/comments/reposts/follows, verify thumbnails, verify grouping, verify Unread tab stays ungrouped.

---

## Out of scope (file separately)

- Zaps treatment — needs a product decision on whether zaps anchor to video (group like likes) or to the actor (one row per zap).
- "See all actors" bottom sheet for the overflow circle.
- Realtime notification merging (web has no realtime notification path today).
- Per-kind notification settings (mute likes, etc.).
- Funnelcake server-side embedding of `referenced_event_title` / `thumbnail_url` (would let us delete the client-side `fetchVideoById` fan-out; track separately).
