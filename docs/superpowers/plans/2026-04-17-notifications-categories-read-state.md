# Notifications Categories And Read State Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-backed notification category tabs, preserve implicit mark-all-read on page open, and keep the first loaded `All` view visually split into `New` and `Earlier`.

**Architecture:** Extend the notification client and hook layer to accept server-side filters, then update the notifications page to drive those filters through tabs and local sectioning state. Keep the backend as the source of truth for unread status, but snapshot the first page’s unread IDs locally so the page can still show what was new when it opened.

**Tech Stack:** React 18, TypeScript, TanStack Query, Vitest, Testing Library, Tailwind, shared `Tabs` UI primitives

---

## File Map

- Modify: `src/types/notification.ts`
- Modify: `src/lib/funnelcakeClient.ts`
- Modify: `src/lib/funnelcakeClient.test.ts`
- Create: `src/hooks/useNotifications.test.ts`
- Modify: `src/hooks/useNotifications.ts`
- Create: `src/pages/NotificationsPage.test.tsx`
- Modify: `src/pages/NotificationsPage.tsx`
- Modify: `src/pages/ConversationPage.tsx`

## Chunk 1: Filterable Notification Data Layer

### Task 1: Add notification filter types

**Files:**
- Modify: `src/types/notification.ts`
- Test: `src/hooks/useNotifications.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
expectTypeOf<NotificationCategory>().toEqualTypeOf<
  'all' | 'unread' | 'likes' | 'comments' | 'follows' | 'reposts' | 'zaps'
>();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vitest run src/hooks/useNotifications.test.ts`
Expected: FAIL because the notification filter types do not exist yet

- [ ] **Step 3: Write minimal implementation**

Add `NotificationCategory` plus a small filter interface in `src/types/notification.ts` that hook and page code can share.

- [ ] **Step 4: Run test to verify it passes**

Run: `vitest run src/hooks/useNotifications.test.ts`
Expected: PASS for the new type usage

- [ ] **Step 5: Commit**

```bash
git add src/types/notification.ts src/hooks/useNotifications.test.ts
git commit -m "test: add notification filter types"
```

### Task 2: Forward notification filters to the REST client

**Files:**
- Modify: `src/lib/funnelcakeClient.ts:1196-1280`
- Modify: `src/lib/funnelcakeClient.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('passes types and unread_only when fetching notifications', async () => {
  await fetchNotifications(API_URL, TEST_PUBKEY, signer, {
    limit: 30,
    before: 'cursor-1',
    unreadOnly: true,
    types: ['like', 'follow'],
  });

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('types=like%2Cfollow'),
    expect.objectContaining({ headers: expect.any(Object) }),
  );
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('unread_only=true'),
    expect.any(Object),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vitest run src/lib/funnelcakeClient.test.ts`
Expected: FAIL because `fetchNotifications` ignores `types` and `unreadOnly`

- [ ] **Step 3: Write minimal implementation**

Extend the `fetchNotifications` options object to include `types` and `unreadOnly`, then include them in the authenticated request params using the backend’s expected query names.

- [ ] **Step 4: Run test to verify it passes**

Run: `vitest run src/lib/funnelcakeClient.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/funnelcakeClient.ts src/lib/funnelcakeClient.test.ts
git commit -m "test: cover notification filter params"
```

### Task 3: Make `useNotifications` filter-aware

**Files:**
- Create: `src/hooks/useNotifications.test.ts`
- Modify: `src/hooks/useNotifications.ts`
- Modify: `src/types/notification.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('uses category-specific query keys and request filters', async () => {
  renderHook(() => useNotifications({ category: 'likes' }), { wrapper });

  await waitFor(() => {
    expect(fetchNotifications).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ types: ['like'], unreadOnly: false }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vitest run src/hooks/useNotifications.test.ts`
Expected: FAIL because the hook does not accept category filters

- [ ] **Step 3: Write minimal implementation**

Update `useNotifications` to accept a filter object, derive backend params from category, and include the filter in the query key. Keep `useUnreadNotificationCount` and `useMarkNotificationsRead` behavior unchanged except for shared typing if needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `vitest run src/hooks/useNotifications.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNotifications.ts src/hooks/useNotifications.test.ts src/types/notification.ts
git commit -m "test: add filtered notifications hook"
```

## Chunk 2: Notifications Page Tabs And Sectioning

### Task 4: Add notifications page tests for tabs and implicit read behavior

**Files:**
- Create: `src/pages/NotificationsPage.test.tsx`
- Modify: `src/pages/NotificationsPage.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('marks all notifications read once and keeps initial unread rows in a New section', async () => {
  renderPage();

  expect(await screen.findByText('New')).toBeInTheDocument();
  expect(screen.getByText('Earlier')).toBeInTheDocument();

  await waitFor(() => {
    expect(mockMarkReadMutate).toHaveBeenCalledWith(undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vitest run src/pages/NotificationsPage.test.tsx`
Expected: FAIL because the page has no sections and marks specific IDs instead of "all"

- [ ] **Step 3: Write minimal implementation**

Create a page test that mocks the notification hooks and verifies:
- the tab list renders
- the default `All` tab sections rows into `New` and `Earlier`
- the page only triggers mark-all-read once for the initial `All` load
- switching to another tab requests that filtered dataset

- [ ] **Step 4: Run test to verify it passes**

Run: `vitest run src/pages/NotificationsPage.test.tsx`
Expected: PASS after the page implementation lands

- [ ] **Step 5: Commit**

```bash
git add src/pages/NotificationsPage.test.tsx src/pages/NotificationsPage.tsx
git commit -m "test: cover notifications page tabs"
```

### Task 5: Implement tabs, sectioning, and filtered empty states

**Files:**
- Modify: `src/pages/NotificationsPage.tsx`
- Test: `src/pages/NotificationsPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('shows a category-specific empty state for Likes', async () => {
  mockUseNotificationsState.notifications = [];
  renderPage({ category: 'likes' });
  expect(await screen.findByText(/No like notifications yet/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vitest run src/pages/NotificationsPage.test.tsx`
Expected: FAIL because the page only has one generic empty state

- [ ] **Step 3: Write minimal implementation**

Use the shared `Tabs` components, track the selected category in page state, call `useNotifications({ category })`, derive `newNotifications` from the initial unread snapshot for `All`, and add category-aware empty copy.

- [ ] **Step 4: Run test to verify it passes**

Run: `vitest run src/pages/NotificationsPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/NotificationsPage.tsx src/pages/NotificationsPage.test.tsx
git commit -m "feat: add notification category tabs"
```

## Chunk 3: Verification And Baseline Cleanup

### Task 6: Remove the pre-existing lint blocker from `ConversationPage`

**Files:**
- Modify: `src/pages/ConversationPage.tsx:1-20`

- [ ] **Step 1: Write the failing test**

No new test. This is a baseline cleanup required because `origin/main` currently fails lint on an unused import.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL with `Loader2 is defined but never used`

- [ ] **Step 3: Write minimal implementation**

Remove the unused `Loader2` import from `src/pages/ConversationPage.tsx` and avoid any behavioral changes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS for lint, the new notification tests, and the full build

- [ ] **Step 5: Commit**

```bash
git add src/pages/ConversationPage.tsx src/pages/NotificationsPage.tsx src/pages/NotificationsPage.test.tsx src/hooks/useNotifications.ts src/hooks/useNotifications.test.ts src/lib/funnelcakeClient.ts src/lib/funnelcakeClient.test.ts src/types/notification.ts
git commit -m "feat: add notification category tabs and read-state sections"
```
