# Notifications Video Context Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show which video each content notification refers to by consuming the existing enriched notifications payload in the web client.

**Architecture:** Extend the notification types and transform layer to retain optional `source_profile` and `referenced_video` enrichment from the backend, then update the notification row UI to render a compact referenced-video preview for content notifications. Keep all new behavior optional so older or partial payloads still fall back to the current generic rendering.

**Tech Stack:** React 18, TypeScript, TanStack Query, Vitest, Testing Library, Tailwind, existing notification hooks and components

---

## File Map

- Modify: `src/types/notification.ts`
- Modify: `src/lib/notificationTransform.ts`
- Modify: `src/lib/notificationTransform.test.ts`
- Modify: `src/components/NotificationItem.tsx`
- Modify: `src/components/NotificationItem.test.tsx`

## Chunk 1: Preserve Enriched Notification Data

### Task 1: Add optional enrichment types to notification models

**Files:**
- Modify: `src/types/notification.ts`
- Test: `src/lib/notificationTransform.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('preserves referenced video enrichment from the API payload', () => {
  const result = transformNotification({
    ...rawNotification,
    referenced_video: {
      title: 'Beach Day Sunset',
      thumbnail: 'https://media.divine.video/thumb.jpg',
      d_tag: 'sha256-tag',
    },
  });

  expect(result.referencedVideo?.title).toBe('Beach Day Sunset');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notificationTransform.test.ts`
Expected: FAIL because the transform drops `referenced_video`

- [ ] **Step 3: Write minimal implementation**

Add optional `sourceProfile` and `referencedVideo` fields to the app `Notification` type plus matching optional raw API fields in `RawApiNotification`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notificationTransform.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/notification.ts src/lib/notificationTransform.test.ts
git commit -m "test: cover enriched notification payloads"
```

### Task 2: Retain enrichment in the transform layer

**Files:**
- Modify: `src/lib/notificationTransform.ts`
- Test: `src/lib/notificationTransform.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('maps source profile enrichment onto the app notification', () => {
  const result = transformNotification({
    ...rawNotification,
    source_profile: {
      display_name: 'Alice',
      picture: 'https://media.divine.video/alice.jpg',
      nip05: 'alice@example.com',
    },
  });

  expect(result.sourceProfile?.displayName).toBe('Alice');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notificationTransform.test.ts`
Expected: FAIL because `source_profile` is ignored

- [ ] **Step 3: Write minimal implementation**

Map `source_profile` and `referenced_video` into normalized app-level fields in `transformNotification` while leaving current type and timestamp behavior unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notificationTransform.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/notificationTransform.ts src/lib/notificationTransform.test.ts
git commit -m "feat: retain notification enrichment fields"
```

## Chunk 2: Render Referenced Video Context

### Task 3: Add row tests for referenced video previews

**Files:**
- Modify: `src/components/NotificationItem.test.tsx`
- Modify: `src/components/NotificationItem.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('shows the referenced video title for repost notifications', () => {
  render(<NotificationItem notification={makeNotification({
    type: 'repost',
    referencedVideo: { title: 'Beach Day Sunset' },
  })} />);

  expect(screen.getByText('Beach Day Sunset')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/NotificationItem.test.tsx`
Expected: FAIL because the row does not render video context

- [ ] **Step 3: Write minimal implementation**

Render a compact referenced-video preview for `like`, `comment`, `repost`, and `zap` notifications. Prefer enriched actor metadata for display name and avatar when present, then fall back to `useAuthor`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/NotificationItem.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/NotificationItem.tsx src/components/NotificationItem.test.tsx
git commit -m "feat: show referenced video context in notifications"
```

### Task 4: Cover missing-enrichment fallbacks

**Files:**
- Modify: `src/components/NotificationItem.test.tsx`
- Test: `src/components/NotificationItem.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('does not render an empty preview when referenced video enrichment is missing', () => {
  render(<NotificationItem notification={makeNotification({ referencedVideo: undefined })} />);

  expect(screen.queryByTestId('notification-video-preview')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/NotificationItem.test.tsx`
Expected: FAIL until the preview is gated correctly

- [ ] **Step 3: Write minimal implementation**

Gate the preview on usable `referencedVideo` content and keep the existing generic text-only row when enrichment is absent.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/NotificationItem.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/NotificationItem.tsx src/components/NotificationItem.test.tsx
git commit -m "test: cover notification preview fallbacks"
```

## Chunk 3: Verification

### Task 5: Run targeted and full verification

**Files:**
- Modify: `src/types/notification.ts`
- Modify: `src/lib/notificationTransform.ts`
- Modify: `src/lib/notificationTransform.test.ts`
- Modify: `src/components/NotificationItem.tsx`
- Modify: `src/components/NotificationItem.test.tsx`

- [ ] **Step 1: Run targeted tests**

Run: `npx vitest run src/lib/notificationTransform.test.ts src/components/NotificationItem.test.tsx`
Expected: PASS

- [ ] **Step 2: Run full verification**

Run: `npm run test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/types/notification.ts src/lib/notificationTransform.ts src/lib/notificationTransform.test.ts src/components/NotificationItem.tsx src/components/NotificationItem.test.tsx
git commit -m "feat: add notification video context"
```
