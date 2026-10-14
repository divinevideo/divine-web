# Disable New Videos Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the chronological New feed from Discovery and redirect old `/discovery/new` links to the Hot feed.

**Architecture:** `DiscoveryPage` will stop declaring, rendering, or accepting the `new` tab, so it cannot mount `VideoFeed` with `feedType="recent"`. `AppRouter` will own backward compatibility through a specific React Router redirect from `/discovery/new` to `/discovery/hot`, ahead of the existing parameterized Discovery route.

**Tech Stack:** React 18, TypeScript, React Router 6, Radix Tabs, Vitest, Testing Library.

**Design:** `docs/superpowers/specs/2026-07-26-disable-new-videos-discovery-design.md`

---

## File Structure

- Modify `src/pages/DiscoveryPage.test.tsx`: prove the New tab and recent feed are unavailable.
- Modify `src/pages/DiscoveryPage.tsx`: remove the New tab type, trigger, feed content, clock icon, and obsolete file description.
- Modify `src/AppRouter.test.tsx`: prove direct visits to `/discovery/new` resolve to `/discovery/hot`.
- Modify `src/AppRouter.tsx`: register the specific replace redirect.
- Modify `ARCHITECTURE.md`: record the route-level safety behavior because this document references `AppRouter`.

### Task 1: Remove New From Discovery

**Files:**
- Modify: `src/pages/DiscoveryPage.test.tsx`
- Modify: `src/pages/DiscoveryPage.tsx`

- [ ] **Step 1: Write the failing component test**

Change the `VideoFeed` mock in `src/pages/DiscoveryPage.test.tsx` so its feed
type is visible to user-facing test queries:

```tsx
vi.mock('@/components/VideoFeed', () => ({
  VideoFeed: ({ feedType }: { feedType: string }) => (
    <div data-testid={`video-feed-${feedType}`} />
  ),
}));
```

Add this test inside `describe('DiscoveryPage', ...)`:

```tsx
it('does not expose or render the all-new video feed', () => {
  render(
    <MemoryRouter initialEntries={['/discovery/new']}>
      <Routes>
        <Route path="/discovery/:tab" element={<DiscoveryPage />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.queryByRole('tab', { name: 'Nuevo' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('video-feed-recent')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/pages/DiscoveryPage.test.tsx -t "does not expose or render"
```

Expected: FAIL because the current page renders the localized New tab and
mounts `video-feed-recent` for `/discovery/new`.

- [ ] **Step 3: Remove the New tab and recent feed**

In `src/pages/DiscoveryPage.tsx`, change the file description and icon import:

```tsx
// ABOUTME: Discovery feed page showing public videos with tabs for Classics, Hot, and Hashtags
// ABOUTME: Each video tab uses a moderated or curated feed source
// ABOUTME: For You tab shows personalized recommendations when user is logged in
```

```tsx
import { Star, Hash, Flame, Sparkle as Sparkles } from '@phosphor-icons/react';
```

Change the allowed tab declarations to:

```tsx
type AllowedTab = 'foryou' | 'classics' | 'hot' | 'hashtags';
const ALL_TABS: AllowedTab[] = ['foryou', 'classics', 'hot', 'hashtags'];
const BASE_TABS: AllowedTab[] = ['classics', 'hot', 'hashtags'];
```

Change the tab grid count to match the remaining controls:

```tsx
<TabsList className={`w-full grid gap-1 ${isLoggedIn ? 'grid-cols-4' : 'grid-cols-3'}`}>
```

Delete the New trigger:

```tsx
<TabsTrigger value="new" className="gap-1.5 sm:gap-2">
  <Clock className="h-4 w-4" />
  <span className="hidden sm:inline">{t('discovery.new')}</span>
</TabsTrigger>
```

Delete the New content:

```tsx
<TabsContent value="new" className="mt-0 space-y-6">
  <VideoFeed
    feedType="recent"
    verifiedOnly={verifiedOnly}
    data-testid="video-feed-new"
    className="space-y-6"
    key="recent"
  />
</TabsContent>
```

- [ ] **Step 4: Run the focused component suite and verify GREEN**

Run:

```bash
npx vitest run src/pages/DiscoveryPage.test.tsx
```

Expected: PASS for the existing localization/category test and the new
all-new-feed regression test.

### Task 2: Redirect The Retired URL

**Files:**
- Modify: `src/AppRouter.test.tsx`
- Modify: `src/AppRouter.tsx`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Write the failing router test**

In `src/AppRouter.test.tsx`, add `waitFor` to the Testing Library import:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
```

Mock the Discovery page to keep the router test focused:

```tsx
vi.mock('./pages/DiscoveryPage', () => ({
  default: () => <div data-testid="discovery-page" />,
}));
```

Add this test inside `describe('AppRouter', ...)`:

```tsx
it('redirects the retired new-video feed to hot', async () => {
  window.history.pushState({}, '', '/discovery/new');

  render(<AppRouter />);

  await waitFor(() => {
    expect(window.location.pathname).toBe('/discovery/hot');
  });
  expect(screen.getByTestId('discovery-page')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/AppRouter.test.tsx -t "redirects the retired"
```

Expected: FAIL because the parameterized `/discovery/:tab` route currently
keeps the browser at `/discovery/new`.

- [ ] **Step 3: Add the specific replace redirect**

In `src/AppRouter.tsx`, add `Navigate` to the React Router import:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
```

Register the specific redirect immediately before the existing Discovery
routes:

```tsx
<Route path="/discovery/new" element={<Navigate to="/discovery/hot" replace />} />
<Route path="/discovery" element={<DiscoveryPage />} />
<Route path="/discovery/:tab" element={<DiscoveryPage />} />
```

- [ ] **Step 4: Document the route behavior**

Append this sentence to the Routing section of `ARCHITECTURE.md`:

```markdown
The retired `/discovery/new` chronological feed redirects to
`/discovery/hot`; Discovery does not expose or mount an all-new-video feed.
```

- [ ] **Step 5: Run both focused suites and verify GREEN**

Run:

```bash
npx vitest run src/AppRouter.test.tsx src/pages/DiscoveryPage.test.tsx
```

Expected: PASS for both files, including the new redirect and feed-removal
regressions.

### Task 3: Verify And Commit

**Files:**
- Modify: `src/pages/DiscoveryPage.test.tsx`
- Modify: `src/pages/DiscoveryPage.tsx`
- Modify: `src/AppRouter.test.tsx`
- Modify: `src/AppRouter.tsx`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Check the focused diff and stale feed references**

Run:

```bash
git diff --check
rg -n 'video-feed-new|feedType="recent"|discovery\\.new|value="new"|Clock' src/pages/DiscoveryPage.tsx
rg -n '/discovery/new' src/AppRouter.tsx ARCHITECTURE.md
```

Expected: `git diff --check` succeeds; the Discovery search returns no
matches; the route/documentation search returns only the explicit redirect
and its architecture note.

- [ ] **Step 2: Run the full repository gate**

Run:

```bash
npm test
```

Expected: TypeScript, ESLint, all Vitest suites, and the Vite production build
pass.

- [ ] **Step 3: Commit the focused implementation**

Stage only the task files, leaving unrelated untracked PNGs untouched:

```bash
git add src/pages/DiscoveryPage.test.tsx src/pages/DiscoveryPage.tsx src/AppRouter.test.tsx src/AppRouter.tsx ARCHITECTURE.md
git commit -m "fix: disable unmoderated new video discovery"
```
