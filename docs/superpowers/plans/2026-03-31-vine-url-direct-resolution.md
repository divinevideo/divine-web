# Vine URL Direct Resolution Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the search box and paste flow recognize legacy Vine URLs and IDs, navigate to the correct route, and resolve legacy Vine usernames without generic search fallback.

**Architecture:** Extend the existing direct-search parser for Vine URLs and bare numeric Vine user IDs, keep `SearchPage` as the direct-routing entrypoint, and expand `UniversalUserPage` so non-numeric legacy Vine usernames resolve by exact metadata match before the current `openvine.co` fallback. Bare 11-character Vine clip IDs should remain in the paste-only asynchronous lookup path in `SearchPage` so ordinary typed searches are not hijacked. Do not move this behavior into the generic search hooks.

**Tech Stack:** TypeScript, React 18, React Router, Vitest, Testing Library

---

## File Map

- Modify: `src/lib/directSearch.ts`
  - Extend direct target parsing for Vine clip URLs, Vine user URLs, legacy username URLs, and bare numeric Vine user IDs.
- Modify: `src/lib/directSearch.test.ts`
  - Add direct-target tests for supported Vine URL forms and negative tests for unsupported direct-target shapes.
- Modify: `src/pages/SearchPage.tsx`
  - Reuse the expanded direct-search parser for immediate routing on change and paste while preserving paste-only lookup for bare Vine clip IDs.
- Modify: `src/pages/SearchPage.test.tsx`
  - Add interaction tests proving Vine URLs navigate immediately and bare pasted Vine clip IDs resolve via lookup.
- Modify: `src/pages/UniversalUserPage.tsx`
  - Add legacy Vine username resolution before the existing OpenVine NIP-05 fallback.
- Create: `src/pages/UniversalUserPage.test.tsx`
  - Cover numeric Vine user IDs, legacy usernames, fallback behavior, and not-found behavior.

## Chunk 1: Extend Direct Search Parsing

### Task 1: Add failing Vine direct-search tests

**Files:**
- Modify: `src/lib/directSearch.test.ts`
- Modify: `src/lib/directSearch.ts`

- [ ] **Step 1: Add failing test cases for supported Vine direct targets and negative cases**

```ts
it('routes vine clip URLs to the video page', () => {
  expect(getDirectSearchTarget('https://vine.co/v/hBFP5LFKUOU')).toEqual({
    path: buildVideoPath('hBFP5LFKUOU'),
    entity: 'video',
  });
});

it('routes vine numeric user URLs to the universal user page', () => {
  expect(getDirectSearchTarget('https://vine.co/u/1080167736266633216')).toEqual({
    path: '/u/1080167736266633216',
    entity: 'profile',
  });
});

it('routes legacy vine username URLs to the universal user page', () => {
  expect(getDirectSearchTarget('https://vine.co/someuser')).toEqual({
    path: '/u/someuser',
    entity: 'profile',
  });
});

it('routes bare numeric vine user ids to the universal user page', () => {
  expect(getDirectSearchTarget('1080167736266633216')).toEqual({
    path: '/u/1080167736266633216',
    entity: 'profile',
  });
});

it('does not treat bare 11-character tokens as direct vine video routes', () => {
  expect(getDirectSearchTarget('hBFP5LFKUOU')).toBeNull();
});
```

- [ ] **Step 2: Run the direct-search test file and confirm the new cases fail**

Run: `vitest run src/lib/directSearch.test.ts`
Expected: FAIL on the new Vine URL cases because the parser does not recognize them yet.

- [ ] **Step 3: Implement minimal Vine parsing in `directSearch.ts`**

```ts
function getVineDirectTarget(value: string): DirectSearchTarget | null {
  const normalized = value.trim();
  if (VINE_USER_ID_PATTERN.test(normalized)) {
    return { path: `/u/${normalized}`, entity: 'profile' };
  }

  const url = tryParseHttpUrl(normalized);
  if (!url || !isVineHost(url.hostname)) return null;

  const path = url.pathname.replace(/\/+$/, '');
  if (path.startsWith('/v/')) return { path: buildVideoPath(path.slice(3)), entity: 'video' };
  if (path.startsWith('/u/')) return { path: `/u/${path.slice(3)}`, entity: 'profile' };
  if (isSingleSegmentLegacyProfilePath(path)) return { path: `/u/${path.slice(1)}`, entity: 'profile' };
  return null;
}
```

- [ ] **Step 4: Re-run the direct-search tests and confirm they pass**

Run: `vitest run src/lib/directSearch.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the parsing changes**

```bash
git add src/lib/directSearch.ts src/lib/directSearch.test.ts
git commit -m "feat: parse vine urls in direct search"
```

## Chunk 2: Wire Vine Targets Into Search Page Interaction

### Task 2: Add failing search-page interaction tests

**Files:**
- Modify: `src/pages/SearchPage.test.tsx`
- Modify: `src/pages/SearchPage.tsx`

- [ ] **Step 1: Add failing tests for Vine URL navigation and bare clip-ID paste resolution**

```ts
it('navigates directly when a vine clip url is pasted', () => {
  renderPage();
  const input = screen.getByRole('textbox');

  fireEvent.paste(input, {
    clipboardData: { getData: () => 'https://vine.co/v/hBFP5LFKUOU' },
  });
  fireEvent.change(input, { target: { value: 'https://vine.co/v/hBFP5LFKUOU' } });

  expect(mockNavigate).toHaveBeenCalledWith('/video/hBFP5LFKUOU');
});

it('looks up a pasted bare vine clip id through the opaque lookup flow', async () => {
  mockFetchVideoById.mockResolvedValue({ id: 'e'.repeat(64), d_tag: 'hBFP5LFKUOU' });

  renderPage();
  const input = screen.getByRole('textbox');

  fireEvent.paste(input, {
    clipboardData: { getData: () => 'hBFP5LFKUOU' },
  });
  fireEvent.change(input, { target: { value: 'hBFP5LFKUOU' } });

  await waitFor(() => {
    expect(mockFetchVideoById).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the search-page tests and confirm the new cases fail**

Run: `vitest run src/pages/SearchPage.test.tsx`
Expected: FAIL on the new Vine direct-navigation cases.

- [ ] **Step 3: Make `SearchPage` rely on the expanded direct-search parser only**

```ts
const directTarget = getDirectSearchTarget(valueOrPastedValue);
if (directTarget) {
  navigate(directTarget.path);
  return;
}
```

Notes:
- Do not add Vine-specific parsing directly inside `SearchPage`.
- Keep pasted opaque-video lookup and raw-event lookup behavior unchanged.
- Bare Vine clip IDs should continue to work through the existing paste-only lookup path, not through `getDirectSearchTarget()`.

- [ ] **Step 4: Re-run the search-page tests and confirm they pass**

Run: `vitest run src/pages/SearchPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit the search-page integration**

```bash
git add src/pages/SearchPage.tsx src/pages/SearchPage.test.tsx
git commit -m "feat: route pasted vine urls from search"
```

## Chunk 3: Resolve Legacy Vine Usernames in Universal User Page

### Task 3: Add failing user-resolution tests

**Files:**
- Create: `src/pages/UniversalUserPage.test.tsx`
- Modify: `src/pages/UniversalUserPage.tsx`

- [ ] **Step 1: Create tests for legacy Vine username resolution**

```ts
it('resolves a legacy vine username from vine_metadata.username', async () => {
  mockNostrQuery.mockResolvedValue([
    { pubkey: 'f'.repeat(64), content: JSON.stringify({ vine_metadata: { username: 'someuser' } }) },
  ]);

  renderUniversalUserPage('/u/someuser');

  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalled();
  });
});
```

Add cases for:
- numeric Vine IDs
- username match via `metadata.website` containing a Vine profile URL
- fallback to `username@openvine.co`
- explicit not-found state

- [ ] **Step 2: Run the universal-user tests and confirm they fail**

Run: `vitest run src/pages/UniversalUserPage.test.tsx`
Expected: FAIL because legacy username resolution is not implemented yet.

- [ ] **Step 3: Implement exact-match legacy username resolution**

```ts
function extractLegacyVineUsername(metadata: Record<string, unknown>): string | null {
  if (typeof metadata.vine_metadata?.username === 'string') return metadata.vine_metadata.username;
  if (typeof metadata.website === 'string') return parseVineProfileUsername(metadata.website);
  return null;
}
```

Resolution order:
- numeric ID path keeps current logic
- non-numeric path checks exact legacy username matches first
- then applies the existing `openvine.co` fallback
- then throws the existing not-found error

- [ ] **Step 4: Re-run the universal-user tests and confirm they pass**

Run: `vitest run src/pages/UniversalUserPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit the universal-user changes**

```bash
git add src/pages/UniversalUserPage.tsx src/pages/UniversalUserPage.test.tsx
git commit -m "feat: resolve legacy vine usernames"
```

## Chunk 4: Full Verification

### Task 4: Run repo-level verification on the completed feature

**Files:**
- Modify: `src/lib/directSearch.ts`
- Modify: `src/lib/directSearch.test.ts`
- Modify: `src/pages/SearchPage.tsx`
- Modify: `src/pages/SearchPage.test.tsx`
- Modify: `src/pages/UniversalUserPage.tsx`
- Create: `src/pages/UniversalUserPage.test.tsx`

- [ ] **Step 1: Run the full project verification command**

Run: `npm run test`
Expected: PASS with typecheck, lint, Vitest, and production build all succeeding.

- [ ] **Step 2: Manually smoke-check the intended flows**

Check:
- paste `vine.co/v/<clipId>` in `/search`
- paste `vine.co/u/<numericId>` in `/search`
- paste `vine.co/<username>` in `/search`
- verify unresolved usernames show explicit not-found UI

- [ ] **Step 3: Commit the final integration pass**

```bash
git add src/lib/directSearch.ts src/lib/directSearch.test.ts src/pages/SearchPage.tsx src/pages/SearchPage.test.tsx src/pages/UniversalUserPage.tsx src/pages/UniversalUserPage.test.tsx
git commit -m "feat: support direct vine url resolution"
```
