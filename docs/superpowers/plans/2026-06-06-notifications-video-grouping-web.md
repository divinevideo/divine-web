# Notifications Video Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group web notifications by video and action, hydrate each grouped row with actor profiles plus video title/thumbnail, and remove zap notifications from the UI for now.

**Architecture:** Keep `useNotifications` as the raw paginated Funnelcake fetcher. Add one pure grouping transform and one hydration hook that adapts raw pages into `VideoNotification | ActorNotification` rows. Replace the legacy single notification row with a small notifications component module that renders video rows and follow rows.

**Tech Stack:** React 18, TypeScript, TanStack Query, Tailwind, `@phosphor-icons/react`, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-06-notifications-video-grouping-web-design.md`

**KISS Updates From Review:**
- Do not add `useNotificationVideos.ts`; keep video hydration private inside `useHydratedNotifications`.
- Do not create five tiny presentational component files; put row helpers in `src/components/notifications/NotificationRows.tsx`.
- Do not rewrite unrelated notification behavior. Keep paging, unread-count polling, infinite scroll, and "New / Earlier" snapshot behavior.
- Use `rawIds` for New/Earlier grouping and any future targeted mark-read work; the page keeps the current mark-all-on-open behavior for this PR.
- Keep locale edits mechanical: remove zaps, add message/video keys in every `common.json` with English fallback copy where translation is not available.

---

## File Map

**Create:**
- `src/lib/notificationGrouping.ts` - pure `RawNotification[] + profiles + videos -> NotificationItem[]`.
- `src/lib/notificationGrouping.test.ts` - grouping rules and degraded hydration tests.
- `src/hooks/useHydratedNotifications.ts` - wraps `useNotifications`, `useBatchedAuthors`, internal video metadata query, and grouping.
- `src/hooks/useHydratedNotifications.test.ts` - integration-shaped hook test with mocked dependencies.
- `src/components/notifications/NotificationRows.tsx` - exports `VideoNotificationRow` and `ActorNotificationRow`; keeps avatar stack, type chip, and thumbnail helpers local.
- `src/components/notifications/NotificationRows.test.tsx` - row rendering and click behavior.
- `src/pages/NotificationsPage.test.tsx` if no page test exists - tab removal, sectioning, and grouped mark-as-read behavior.

**Modify:**
- `src/types/notification.ts` - replace flat `Notification` with raw-stage `RawNotification` plus sealed UI union.
- `src/lib/notificationTransform.ts` - map unsupported/zap types to `null`; drop non-follow rows missing `referenced_event_id`; return `RawNotification`.
- `src/lib/notificationTransform.test.ts` - cover zap filtering, null target filtering, follow preservation, and type mapping.
- `src/hooks/useNotifications.ts` - remove `zaps` category mapping only.
- `src/hooks/useNotifications.test.ts` - ensure category filters still map correctly and zaps are not supported.
- `src/pages/NotificationsPage.tsx` - use `useHydratedNotifications`, remove zaps tab/empty copy, render row union exhaustively.
- `src/lib/i18n/locales/*/common.json` - remove `notificationsPage.tabs.zaps` and `notificationsPage.empty.zaps`; add message/video keys.

**Delete:**
- `src/components/NotificationItem.tsx`.
- `src/components/NotificationItem.test.tsx` if present.

---

## Data Model

Use this shape in `src/types/notification.ts`. Keep `RawNotification` as the fetch/transform stage so `useNotifications` stays simple.

```ts
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
```

---

## Task 1: Raw Types And Transform

**Files:**
- Modify: `src/types/notification.ts`
- Modify: `src/lib/notificationTransform.ts`
- Modify: `src/lib/notificationTransform.test.ts`

- [ ] **Step 1: Write transform tests first**

Cover these cases in `src/lib/notificationTransform.test.ts`:
- `reaction -> like`, `reply -> comment`, `follow -> follow`, `repost -> repost`.
- `zap` and unknown notification types return `null` and are omitted from `transformNotificationsResponse`.
- Like/comment/repost rows without `referenced_event_id` are omitted.
- Follow rows without `referenced_event_id` are preserved.
- Follow deduplication keeps the newest row per `actorPubkey`; sort before deduping so the behavior does not depend on API order.

Run:

```bash
npx vitest run src/lib/notificationTransform.test.ts
```

Expected: fails until the transform is updated.

- [ ] **Step 2: Update types**

Replace `Notification` with `RawNotification` and the sealed `NotificationItem` union shown in [Data Model](#data-model). Remove `'zap'` from `NotificationType`, `NotificationApiType`, and `NotificationCategory`.

- [ ] **Step 3: Update transform**

Change `mapNotificationType` to return `NotificationType | null`. Change `transformNotification` to return `RawNotification | null`.

Implementation rules:
- `zap` and unknown types return `null`.
- `type !== 'follow' && !raw.referenced_event_id` returns `null`.
- `commentText` is set only for comments.
- `deduplicateFollows` sorts newest-first before taking the first follow per actor.

- [ ] **Step 4: Verify**

Run:

```bash
npx vitest run src/lib/notificationTransform.test.ts
```

Expected: pass.

Run:

```bash
npx tsc --noEmit
```

Expected: type errors remain in files still using the old flat `Notification` type. Do not fix unrelated files in this task.

- [ ] **Step 5: Commit**

```bash
git add src/types/notification.ts src/lib/notificationTransform.ts src/lib/notificationTransform.test.ts
git commit -m "refactor(notifications): use raw and grouped notification types"
```

---

## Task 2: Pure Grouping

**Files:**
- Create: `src/lib/notificationGrouping.ts`
- Create: `src/lib/notificationGrouping.test.ts`

- [ ] **Step 1: Write grouping tests first**

Cover:
- 1 like on a video produces one `VideoNotification`.
- 5 likes on one video produce one row with 3 displayed actors and `totalCount: 5`.
- Likes and comments on the same video produce separate rows.
- Notifications for different videos produce separate rows.
- Follow rows produce one `ActorNotification` per raw row and are never grouped.
- Output sorts by newest `timestamp` descending.
- Group `isRead` is true only when every raw row is read.
- `rawIds` contains all raw ids in newest-first order.
- Missing profile falls back to `genUserName(pubkey)`.
- Missing video metadata still emits a row with undefined title/thumbnail.
- Comment groups use the newest comment text.

Run:

```bash
npx vitest run src/lib/notificationGrouping.test.ts
```

Expected: fails because the module does not exist.

- [ ] **Step 2: Implement `groupRawNotifications`**

Create:

```ts
export interface NotificationVideoMeta {
  title?: string;
  thumbnailUrl?: string;
}

export function groupRawNotifications(
  raw: RawNotification[],
  profiles: Map<string, ActorInfo>,
  videos: Map<string, NotificationVideoMeta>,
): NotificationItem[];
```

Implementation rules:
- Bucket video rows by `${targetEventId}::${type}`.
- Sort each bucket newest-first before deriving fields.
- `id` is the newest raw id.
- `rawIds` is every raw id in newest-first order.
- `actors` contains up to 3 unique actors, newest-first.
- `totalCount` is the number of unique actors in the bucket, not the number displayed.
- `timestamp` is the newest raw timestamp.
- `isRead` is `bucket.every((row) => row.isRead)`.
- `videoTitle` and `videoThumbnailUrl` come from the `videos` map.
- Follow rows resolve actor metadata and return singleton `ActorNotification`s.
- Final return value sorts all rows newest-first.

- [ ] **Step 3: Verify**

Run:

```bash
npx vitest run src/lib/notificationGrouping.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/notificationGrouping.ts src/lib/notificationGrouping.test.ts
git commit -m "feat(notifications): group raw notifications by video"
```

---

## Task 3: Hydrated Hook

**Files:**
- Create: `src/hooks/useHydratedNotifications.ts`
- Create: `src/hooks/useHydratedNotifications.test.ts`
- Modify: `src/hooks/useNotifications.ts`
- Modify: `src/hooks/useNotifications.test.ts`

- [ ] **Step 1: Trim raw category filters**

Remove `zaps: ['zap']` from `CATEGORY_TYPES` in `useNotifications.ts`.

Update `useNotifications.test.ts` so existing category filter tests still pass and there is no zaps case. Add a direct regression through `useNotifications({ category: 'all' })` if needed to verify no zap filter is sent for all notifications.

- [ ] **Step 2: Write hydrated hook tests first**

Mock `useNotifications`, `useBatchedAuthors`, and `fetchVideoById`.

Cover:
- `category: 'all'` groups two likes on one video into one row.
- `category: 'unread'` keeps those two raw rows as two singleton rows.
- Profile metadata maps to `displayName`, `avatarUrl`, and `nip05`.
- A failed `fetchVideoById` call still returns the notification row with missing metadata.
- The hook exposes paging state and functions from `useNotifications`.

Run:

```bash
npx vitest run src/hooks/useHydratedNotifications.test.ts
```

Expected: fails because the hook does not exist.

- [ ] **Step 3: Implement `useHydratedNotifications`**

Implementation shape:
- Call `useNotifications(filters)`.
- Flatten `data.pages[].notifications` into `flatRaw`.
- Collect unique actor pubkeys and call `useBatchedAuthors(pubkeys)`.
- Collect unique non-follow `targetEventId`s.
- Keep video fetching private to this hook, but cache each video by id. Use `useQueryClient()` plus an aggregate `useQuery` that calls `queryClient.ensureQueryData()` for each id.
- Per-id query key: `['notification-video', id]`.
- Aggregate query key: `['notification-videos', sortedIds.join(',')]`.
- `staleTime: 10 * 60 * 1000`, `gcTime: 30 * 60 * 1000`.
- Catch per-video failures and store `{}` for that id.
- Convert author query data into `Map<string, ActorInfo>` using `display_name || name || genUserName(pubkey)` and `getSafeProfileImage(metadata.picture)`.
- For `category === 'unread'`, call `groupRawNotifications([raw], profiles, videos)` for each raw notification and flatten the results. This preserves one raw row per item while reusing the same UI union.
- For other categories, call `groupRawNotifications(flatRaw, profiles, videos)`.
- Return the grouped `items` plus the loading/error/paging fields from `useNotifications`.

- [ ] **Step 4: Verify**

Run:

```bash
npx vitest run src/hooks/useNotifications.test.ts src/hooks/useHydratedNotifications.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNotifications.ts src/hooks/useNotifications.test.ts src/hooks/useHydratedNotifications.ts src/hooks/useHydratedNotifications.test.ts
git commit -m "feat(notifications): hydrate grouped notification rows"
```

---

## Task 4: Notification Rows

**Files:**
- Create: `src/components/notifications/NotificationRows.tsx`
- Create: `src/components/notifications/NotificationRows.test.tsx`
- Delete: `src/components/NotificationItem.tsx`
- Delete: `src/components/NotificationItem.test.tsx` if present

- [ ] **Step 1: Write row tests first**

Cover:
- A single-actor like row shows one avatar, no overflow, the actor name, `liked your video`, the title, and a 72x72 thumbnail image.
- A `totalCount: 14` like row with 3 actors shows `+11` and "13 others".
- A comment row with `commentText` shows the muted quote and timestamp text.
- Missing thumbnail renders a placeholder with accessible text like "Video thumbnail unavailable".
- Thumbnail click navigates to `/video/:videoEventId`.
- Row body click navigates to `/video/:videoEventId`.
- Avatar click navigates to the actor profile path and does not trigger row navigation.
- Follow row shows one avatar, `followed you`, and navigates to profile.

Run:

```bash
npx vitest run src/components/notifications/NotificationRows.test.tsx
```

Expected: fails because the module does not exist.

- [ ] **Step 2: Implement rows**

Export:

```ts
export function VideoNotificationRow({ notification }: { notification: VideoNotification }): JSX.Element
export function ActorNotificationRow({ notification }: { notification: ActorNotification }): JSX.Element
```

Keep these helpers local to the file:
- `NotificationAvatarStack`
- `NotificationTypeIconChip`
- `NotificationVideoThumbnail`
- `formatGroupedMessage`

UI rules:
- Use `Heart`, `Repeat`, `ChatCircle`, `UserPlus`, and `Play` or `Image` from `@phosphor-icons/react`.
- No `lucide-react`.
- Leading chip is 32x32. Like red, repost green, comment blue, follow violet. Use `weight="fill"` when unread and `weight="bold"` when read.
- Video thumbnail is fixed `h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[14px] border border-border`.
- Use a non-button row container (`div role="button" tabIndex={0}`) for whole-row navigation so avatar and thumbnail buttons are valid nested controls. Handle `Enter`/`Space` on the row container. Stop propagation in nested click handlers.
- Use `useSubdomainNavigate()` and `buildProfileLinkPath()` for navigation.
- Message text uses existing i18n keys:
  - `notificationsPage.message.liked`
  - `notificationsPage.message.commented`
  - `notificationsPage.message.reposted`
  - `notificationsPage.message.followed`
  - `notificationsPage.message.andOthers_one`
  - `notificationsPage.message.andOthers_other`
  - `notificationsPage.video.untitled`
- Use `formatRelativeTime(notification.timestamp)` from `notificationTransform`.
- Apply `bg-muted/30` to unread rows.

- [ ] **Step 3: Delete old row component**

Delete `src/components/NotificationItem.tsx` after the new rows compile.

- [ ] **Step 4: Verify**

Run:

```bash
npx vitest run src/components/notifications/NotificationRows.test.tsx
npx tsc --noEmit
```

Expected: row tests pass. Type errors may remain in `NotificationsPage.tsx` until Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/components/notifications/NotificationRows.tsx src/components/notifications/NotificationRows.test.tsx
git rm src/components/NotificationItem.tsx
git rm src/components/NotificationItem.test.tsx 2>/dev/null || true
git commit -m "feat(notifications): add grouped notification rows"
```

---

## Task 5: Notifications Page Integration And Copy

**Files:**
- Modify: `src/pages/NotificationsPage.tsx`
- Create/modify: `src/pages/NotificationsPage.test.tsx`
- Modify: `src/lib/i18n/locales/*/common.json`

- [ ] **Step 1: Write page tests first**

Cover:
- The tabs render `All`, `Unread`, `Likes`, `Comments`, `Follows`, `Reposts`; `Zaps` is absent.
- `category: 'all'` preserves the existing `New` / `Earlier` split using initially unread raw ids.
- Grouped rows call `markRead.mutate(undefined)` on first all-page load as the existing behavior does.
- If later changing to targeted mark-read, grouped rows must pass every `rawIds` entry. For this plan, keep mark-all on page open to avoid changing backend semantics.
- The render switch is exhaustive: video rows use `VideoNotificationRow`, actor rows use `ActorNotificationRow`.

Run:

```bash
npx vitest run src/pages/NotificationsPage.test.tsx
```

Expected: fails before integration.

- [ ] **Step 2: Update page**

Make these focused edits:
- Import `useHydratedNotifications` instead of `useNotifications`.
- Import `VideoNotificationRow` and `ActorNotificationRow` from `src/components/notifications/NotificationRows`.
- Replace `Notification[]` with `NotificationItem[]`.
- Remove `'zaps'` from `NOTIFICATION_TAB_VALUES`.
- Remove the zaps empty-state entry.
- Flatten data via `items` returned by the hydrated hook; do not read `data.pages` in the page anymore.
- Keep the first-load mark-all behavior for `category === 'all'`.
- Use `notification.rawIds.some((id) => initialUnreadIds.has(id))` for the `New` section, because grouped ids only point at the newest raw row.
- Render rows with:

```tsx
notification.kind === 'video'
  ? <VideoNotificationRow key={notification.id} notification={notification} />
  : <ActorNotificationRow key={notification.id} notification={notification} />
```

- [ ] **Step 3: Update locale files**

For every `src/lib/i18n/locales/*/common.json`:
- Remove `notificationsPage.tabs.zaps`.
- Remove `notificationsPage.empty.zaps`.
- Add:

```json
"message": {
  "liked": "liked your video",
  "commented": "commented on your video",
  "reposted": "reposted your video",
  "followed": "followed you",
  "andOthers_one": "{{count}} other",
  "andOthers_other": "{{count}} others"
},
"video": {
  "untitled": "your video"
}
```

Use English fallback copy in non-English locales for this PR. Keep JSON valid and do not touch unrelated translation keys.

- [ ] **Step 4: Verify**

Run:

```bash
npx vitest run src/pages/NotificationsPage.test.tsx
npx tsc --noEmit
npx eslint src/pages/NotificationsPage.tsx src/components/notifications/NotificationRows.tsx src/hooks/useHydratedNotifications.ts src/lib/notificationGrouping.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/NotificationsPage.tsx src/pages/NotificationsPage.test.tsx src/lib/i18n/locales/*/common.json
git commit -m "feat(notifications): render grouped notification page"
```

---

## Task 6: Final Verification

**Files:**
- No new files unless verification exposes a bug.

- [ ] **Step 1: Run focused notification tests**

```bash
npx vitest run \
  src/lib/notificationTransform.test.ts \
  src/lib/notificationGrouping.test.ts \
  src/hooks/useNotifications.test.ts \
  src/hooks/useHydratedNotifications.test.ts \
  src/components/notifications/NotificationRows.test.tsx \
  src/pages/NotificationsPage.test.tsx
```

Expected: pass.

- [ ] **Step 2: Run the full repo gate**

```bash
npm run test
```

Expected: type-check, lint, unit tests, and build all pass.

- [ ] **Step 3: Browser QA**

Start the app:

```bash
npm run dev
```

Open `http://localhost:8080/notifications` and verify:
- Zaps tab is gone.
- Likes/comments/reposts are grouped by video and action.
- Video rows show thumbnail/title when metadata exists and placeholder/`your video` when it does not.
- Unread tab keeps individual raw notification rows.
- "New" and "Earlier" sections remain stable after mark-all-on-open.
- Row, thumbnail, and avatar click targets navigate correctly.
- Layout fits at desktop width and at mobile width without text overlap.

- [ ] **Step 4: Optional visual guardrail**

If Playwright visual tests are healthy locally, run:

```bash
npm run test:visual
```

Expected: pass or document any unrelated baseline issue before handoff.

- [ ] **Step 5: Final commit if needed**

Only if verification required fixes:

```bash
git add <changed-files>
git commit -m "fix(notifications): polish grouped notification behavior"
```

---

## Execution Notes

- Start execution from a fresh branch/worktree if keeping this work separate from `fix/comment-count-mismatch-retry`:

```bash
git fetch origin main
git worktree add ../divine-web-notifications-video-grouping-web -b notifications-video-grouping-web origin/main
```

- The spec and this plan were authored while on `fix/comment-count-mismatch-retry`; copy or cherry-pick only these two docs if the fresh worktree starts from `origin/main`.
- Keep this as one PR unless implementation uncovers an independent prerequisite bug.
- Do not add a compatibility shim for the old `Notification` type or `NotificationItem` component.
- Do not add backend behavior, realtime merging, push notifications, or zap UI.
