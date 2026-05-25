# Age-Restricted Viewer Auth Parity Implementation Plan (divine-web)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring divine-web to parity with the divine-mobile age-restricted media auth fix: when the viewer has been age-verified, use Blossom/BUD-01 (kind 24242) auth for blob GETs whose SHA-256 is known, and keep NIP-98 (kind 27235) HTTP auth as the fallback. Today divine-web sends only NIP-98 for every authed media request, regardless of whether the media URL is a content-addressed Blossom blob or a generic HTTPS URL.

**Architecture:** `divine-blossom` already accepts either Blossom/BUD-01 kind 24242 list auth or NIP-98 kind 27235 HTTP auth for viewer media GETs. The gap on web is that (a) no Blossom auth helper exists at all, (b) `useAdultVerification.getAuthHeader()` and `hlsAuthLoader.createAuthLoader()` only know how to generate NIP-98, and (c) `VideoPlayer` never forwards the video's SHA-256 (already available as `videoData.sha256` / `videoMetadata.hash`) into the auth path. We will add a focused `blossomAuth` helper, introduce a single `mediaViewerAuth` picker, unify the hook + HLS loader on that picker, and thread the SHA-256 from `VideoPlayer` into the MP4 fetch path. The existing Age Verification overlay + `handleAgeVerified` retry flow stays; only the header generation changes.

**Tech Stack:** React 18, Vite, TypeScript, Vitest, React Testing Library, `@nostrify/nostrify` (signer + NIP98 template), `hls.js`.

**Scope boundaries:**
- In scope: Blossom BUD-01 GET auth, shared picker, wiring into `useAdultVerification`, `hlsAuthLoader`, and `VideoPlayer` MP4 fetch. Also in scope: a **logged-out sign-in CTA** in `AgeVerificationOverlay` — when a logged-out user hits age-gated content we show an explicit "Sign in to view this content" message and a button that opens the login dialog, instead of a passive note below a disabled-looking layout.
- Out of scope: changes to upload/delete flows (still Blossom today in their own code), changes to the 30-day localStorage verification policy, full UI redesign of `AgeVerificationOverlay`, any relay/backend changes.
- Skipped vs. mobile plan: divine-web has no pooled player package; mobile's Chunks 3–4 about `VideoFeedController`/pooled retry collapse into our Chunk 4 (single `VideoPlayer` component). Added vs. mobile plan: the logged-out CTA (Chunk 5) — web has anonymous browsing, mobile does not have the same dead-end.

---

## File Map

- Create: `src/lib/blossomAuth.ts`
  Purpose: Sign a kind 24242 BUD-01 GET auth event for a known blob SHA-256 and return the base64-encoded `Nostr <base64>` header value. Mirrors the shape of `src/lib/nip98Auth.ts`.
- Create: `src/lib/mediaViewerAuth.ts`
  Purpose: Single entry point that picks Blossom vs. NIP-98 for a media GET and returns the `Authorization` header value. Pure function of `{signer, url, sha256?, method?}`. No React, no localStorage.
- Modify: `src/hooks/useAdultVerification.ts`
  Purpose: Replace the direct `createNip98AuthHeader` call inside `getAuthHeader` with `createMediaViewerAuthHeader`, and extend the `getAuthHeader` signature to accept an optional `sha256` hint. `checkMediaAuth` + `fetchWithAuth` helpers stay.
- Modify: `src/lib/hlsAuthLoader.ts`
  Purpose: Widen the `AuthHeaderGenerator` type so the HLS loader can forward a hint (currently always just `url`). HLS segment URLs never carry a blob hash, so this stays NIP-98 in practice — but the contract should no longer be NIP-98-specific in its naming/docs.
- Modify: `src/components/VideoPlayer.tsx`
  Purpose: Read `videoData?.sha256` and pass it into `getAuthHeader(currentUrl, 'GET', sha256)` for the direct MP4 blob fetch path (lines ~810–870). Leave HLS auth loader calls URL-only. No UI changes — the existing `AgeVerificationOverlay` / `handleAgeVerified` retry path continues to drive retries via `authRetryCount`.
- Modify: `src/components/AgeVerificationOverlay.tsx`
  Purpose: When the viewer has no signer (`!user`), swap the heading to "Sign in to view this content" and render a real Sign In button wired to `useLoginDialog().openLoginDialog()` instead of the current passive gray line. When the viewer IS logged in, the overlay's age-verification behavior stays exactly as today.
- Modify: `src/components/__tests__/AgeVerificationOverlay.test.tsx` (create if absent)
  Purpose: Prove the logged-in vs. logged-out branches render the correct CTA, and that the Sign In button calls `openLoginDialog()`.
- Create: `src/lib/__tests__/blossomAuth.test.ts`
  Purpose: Prove BUD-01 event shape and header encoding.
- Create: `src/lib/__tests__/mediaViewerAuth.test.ts`
  Purpose: Prove picker behavior (Blossom when sha256 known, NIP-98 otherwise, null when unauthenticated, never both).
- Modify/Create: `src/hooks/__tests__/useAdultVerification.test.ts`
  Purpose: Prove `getAuthHeader(url)` still returns NIP-98, `getAuthHeader(url, 'GET', sha256)` returns Blossom, and verification gating (`isVerified`, `signer` present) behaves as before. Add new coverage if file is absent.
- Modify: `src/components/__tests__/VideoPlayer.authHeaders.test.tsx` (create if absent; use an existing VideoPlayer test file location convention)
  Purpose: Prove the MP4 fetch path forwards `videoData.sha256` into `getAuthHeader` after age verification.
- Modify: `CLAUDE.md`
  Purpose: Add a short note under "Common Gotchas" or "Nostr Protocol Essentials" documenting that age-gated media GETs use Blossom BUD-01 when SHA-256 is known and NIP-98 otherwise.

---

## Chunk 1: Blossom BUD-01 GET Auth Helper

### Task 1: Add a focused Blossom auth module

**Files:**
- Create: `src/lib/blossomAuth.ts`
- Create: `src/lib/__tests__/blossomAuth.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/__tests__/blossomAuth.test.ts` with Vitest coverage that proves:
- `createBlossomGetAuthHeader(signer, sha256)` signs a kind 24242 event with tags `[["t","get"], ["x", "<sha256>"], ["expiration","<unix-seconds>"]]` and content `"Get blob"`.
- The returned header is `"Nostr " + btoa(JSON.stringify(signedEvent))`.
- The expiration is roughly now + 60 seconds (allow a small tolerance window).
- When the signer throws, the function returns `null` (same failure shape as `createNip98AuthHeader`).

Use a fake signer:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createBlossomGetAuthHeader } from '@/lib/blossomAuth';

function makeSigner() {
  return {
    getPublicKey: vi.fn().mockResolvedValue('pubkey-hex'),
    signEvent: vi.fn().mockImplementation(async (template) => ({
      ...template,
      id: 'event-id',
      pubkey: 'pubkey-hex',
      sig: 'sig-hex',
    })),
  };
}

describe('createBlossomGetAuthHeader', () => {
  const HASH = 'a'.repeat(64);

  it('signs a kind 24242 GET auth event for the given sha256', async () => {
    const signer = makeSigner();
    const header = await createBlossomGetAuthHeader(signer, HASH);

    expect(header).toMatch(/^Nostr /);
    const payload = JSON.parse(atob(header!.slice('Nostr '.length)));
    expect(payload.kind).toBe(24242);
    expect(payload.content).toBe('Get blob');
    const tagMap = new Map(payload.tags.map((t: string[]) => [t[0], t[1]]));
    expect(tagMap.get('t')).toBe('get');
    expect(tagMap.get('x')).toBe(HASH);
    const exp = Number(tagMap.get('expiration'));
    expect(Number.isFinite(exp)).toBe(true);
    const now = Math.floor(Date.now() / 1000);
    expect(exp).toBeGreaterThanOrEqual(now + 30);
    expect(exp).toBeLessThanOrEqual(now + 120);
  });

  it('returns null when the signer throws', async () => {
    const signer = makeSigner();
    signer.signEvent.mockRejectedValueOnce(new Error('boom'));

    const header = await createBlossomGetAuthHeader(signer, HASH);
    expect(header).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused test file and verify it fails**

Run: `npx vitest run src/lib/__tests__/blossomAuth.test.ts`

Expected: FAIL — module `@/lib/blossomAuth` not found.

- [ ] **Step 3: Implement `src/lib/blossomAuth.ts`**

```ts
// ABOUTME: Shared Blossom/BUD-01 kind 24242 GET auth helper
// ABOUTME: Signs a content-addressed GET authorization event for age-gated blob fetches

import type { NostrSigner } from '@nostrify/nostrify';
import { debugLog, debugError } from './debug';

const BLOSSOM_GET_KIND = 24242;
const DEFAULT_EXPIRATION_SECONDS = 60;

export async function createBlossomGetAuthHeader(
  signer: NostrSigner,
  sha256: string,
  expirationSeconds: number = DEFAULT_EXPIRATION_SECONDS,
): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const template = {
      kind: BLOSSOM_GET_KIND,
      content: 'Get blob',
      tags: [
        ['t', 'get'],
        ['x', sha256],
        ['expiration', String(now + expirationSeconds)],
      ],
      created_at: now,
    };
    const signedEvent = await signer.signEvent(template);
    const encoded = btoa(JSON.stringify(signedEvent));

    debugLog(`[blossomAuth] Created GET auth header for sha256 ${sha256.slice(0, 8)}…`);
    return `Nostr ${encoded}`;
  } catch (error) {
    debugError('[blossomAuth] Failed to generate GET auth header:', error);
    return null;
  }
}
```

Keep the surface area tight: no URL parsing, no protocol selection, no age-verification UI logic. The picker (Chunk 2) owns those decisions.

- [ ] **Step 4: Re-run the test file**

Run: `npx vitest run src/lib/__tests__/blossomAuth.test.ts`

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/blossomAuth.ts src/lib/__tests__/blossomAuth.test.ts
git commit -m "feat: add Blossom BUD-01 GET auth helper"
```

---

## Chunk 2: Shared Media Viewer Auth Picker

### Task 2: Introduce the single media-auth entry point

**Files:**
- Create: `src/lib/mediaViewerAuth.ts`
- Create: `src/lib/__tests__/mediaViewerAuth.test.ts`

- [ ] **Step 1: Write the failing picker tests**

Create `src/lib/__tests__/mediaViewerAuth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/blossomAuth', () => ({
  createBlossomGetAuthHeader: vi.fn(),
}));
vi.mock('@/lib/nip98Auth', () => ({
  createNip98AuthHeader: vi.fn(),
}));

import { createBlossomGetAuthHeader } from '@/lib/blossomAuth';
import { createNip98AuthHeader } from '@/lib/nip98Auth';
import { createMediaViewerAuthHeader } from '@/lib/mediaViewerAuth';

const signer = { signEvent: vi.fn(), getPublicKey: vi.fn() };
const URL = 'https://media.divine.video/abc.mp4';
const HASH = 'a'.repeat(64);

describe('createMediaViewerAuthHeader', () => {
  beforeEach(() => {
    vi.mocked(createBlossomGetAuthHeader).mockReset().mockResolvedValue('Nostr BLOSSOM');
    vi.mocked(createNip98AuthHeader).mockReset().mockResolvedValue('Nostr NIP98');
  });

  it('prefers Blossom when a sha256 is provided', async () => {
    const header = await createMediaViewerAuthHeader({ signer, url: URL, sha256: HASH });
    expect(header).toBe('Nostr BLOSSOM');
    expect(createBlossomGetAuthHeader).toHaveBeenCalledWith(signer, HASH);
    expect(createNip98AuthHeader).not.toHaveBeenCalled();
  });

  it('falls back to NIP-98 when no sha256 is known', async () => {
    const header = await createMediaViewerAuthHeader({ signer, url: URL });
    expect(header).toBe('Nostr NIP98');
    expect(createNip98AuthHeader).toHaveBeenCalledWith(signer, URL, 'GET');
    expect(createBlossomGetAuthHeader).not.toHaveBeenCalled();
  });

  it('returns null when there is no signer', async () => {
    const header = await createMediaViewerAuthHeader({ signer: null, url: URL, sha256: HASH });
    expect(header).toBeNull();
    expect(createBlossomGetAuthHeader).not.toHaveBeenCalled();
    expect(createNip98AuthHeader).not.toHaveBeenCalled();
  });

  it('never invokes both protocols for a single request', async () => {
    await createMediaViewerAuthHeader({ signer, url: URL, sha256: HASH });
    expect(
      vi.mocked(createBlossomGetAuthHeader).mock.calls.length +
        vi.mocked(createNip98AuthHeader).mock.calls.length,
    ).toBe(1);
  });

  it('treats an empty sha256 as "no hash"', async () => {
    const header = await createMediaViewerAuthHeader({ signer, url: URL, sha256: '' });
    expect(header).toBe('Nostr NIP98');
    expect(createBlossomGetAuthHeader).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the focused test file and verify it fails**

Run: `npx vitest run src/lib/__tests__/mediaViewerAuth.test.ts`

Expected: FAIL — module `@/lib/mediaViewerAuth` not found.

- [ ] **Step 3: Implement `src/lib/mediaViewerAuth.ts`**

```ts
// ABOUTME: Single entry point for picking viewer auth on media GETs
// ABOUTME: Uses Blossom BUD-01 when the blob SHA-256 is known; falls back to NIP-98 HTTP auth

import type { NostrSigner } from '@nostrify/nostrify';
import { createBlossomGetAuthHeader } from './blossomAuth';
import { createNip98AuthHeader } from './nip98Auth';

export interface MediaViewerAuthInput {
  signer: NostrSigner | null | undefined;
  url: string;
  sha256?: string;
  method?: string;
}

const SHA256_RE = /^[0-9a-f]{64}$/i;

export async function createMediaViewerAuthHeader(
  input: MediaViewerAuthInput,
): Promise<string | null> {
  const { signer, url, sha256, method = 'GET' } = input;
  if (!signer) return null;

  if (sha256 && SHA256_RE.test(sha256)) {
    return createBlossomGetAuthHeader(signer, sha256);
  }
  return createNip98AuthHeader(signer, url, method);
}
```

Notes:
- The picker never falls through from Blossom to NIP-98 if Blossom fails — if the signer can sign kind 24242 but the request fails at the server, that's a server-side/contract question, not a client fallback. Keeping the behavior single-protocol-per-request matches the mobile contract.
- The hex length check guards against callers passing an empty string or a non-hex token (e.g. a prefixed `sha256:abc…`).

- [ ] **Step 4: Re-run the test file**

Run: `npx vitest run src/lib/__tests__/mediaViewerAuth.test.ts`

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mediaViewerAuth.ts src/lib/__tests__/mediaViewerAuth.test.ts
git commit -m "feat: add shared media viewer auth picker"
```

---

## Chunk 3: Unify `useAdultVerification` onto the Picker

### Task 3: Route hook + HLS loader through the shared picker

**Files:**
- Modify: `src/hooks/useAdultVerification.ts`
- Modify: `src/lib/hlsAuthLoader.ts`
- Modify/Create: `src/hooks/__tests__/useAdultVerification.test.ts`

- [ ] **Step 1: Check whether a hook test file already exists**

Run: `ls src/hooks/__tests__/useAdultVerification.test.ts 2>/dev/null || echo MISSING`

If `MISSING`, create a new file in Step 2. If it exists, extend it with the new cases.

- [ ] **Step 2: Write failing hook tests**

In `src/hooks/__tests__/useAdultVerification.test.ts`, add tests that prove:
- `getAuthHeader(url)` (no sha256) returns the NIP-98 header when verified and signer present.
- `getAuthHeader(url, 'GET', sha256)` returns the Blossom header.
- `getAuthHeader(...)` returns `null` when `isVerified` is false.
- `getAuthHeader(...)` returns `null` when there is no signer.

Skeleton (add around existing tests if present):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/mediaViewerAuth', () => ({
  createMediaViewerAuthHeader: vi.fn(),
}));

const mockSigner = { signEvent: vi.fn(), getPublicKey: vi.fn() };
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ signer: mockSigner, pubkey: 'pub' }),
}));

import { createMediaViewerAuthHeader } from '@/lib/mediaViewerAuth';
import { useAdultVerification } from '@/hooks/useAdultVerification';

const HASH = 'a'.repeat(64);
const URL = 'https://media.divine.video/file.mp4';

describe('useAdultVerification.getAuthHeader', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(createMediaViewerAuthHeader).mockReset().mockResolvedValue('Nostr HEADER');
  });

  it('returns null when not verified', async () => {
    const { result } = renderHook(() => useAdultVerification());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const header = await result.current.getAuthHeader(URL);
    expect(header).toBeNull();
    expect(createMediaViewerAuthHeader).not.toHaveBeenCalled();
  });

  it('forwards url-only to the picker after confirmAdult', async () => {
    const { result } = renderHook(() => useAdultVerification());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.confirmAdult());

    const header = await result.current.getAuthHeader(URL);
    expect(header).toBe('Nostr HEADER');
    expect(createMediaViewerAuthHeader).toHaveBeenCalledWith({
      signer: mockSigner,
      url: URL,
      sha256: undefined,
      method: 'GET',
    });
  });

  it('forwards sha256 hint to the picker when provided', async () => {
    const { result } = renderHook(() => useAdultVerification());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.confirmAdult());

    const header = await result.current.getAuthHeader(URL, 'GET', HASH);
    expect(header).toBe('Nostr HEADER');
    expect(createMediaViewerAuthHeader).toHaveBeenCalledWith({
      signer: mockSigner,
      url: URL,
      sha256: HASH,
      method: 'GET',
    });
  });
});
```

- [ ] **Step 3: Run the focused hook test and verify it fails**

Run: `npx vitest run src/hooks/__tests__/useAdultVerification.test.ts`

Expected: FAIL — the third signature-with-`sha256` assertion fails because the current hook has `getAuthHeader(url, method)` (2 args) and still imports `createNip98AuthHeader` directly.

- [ ] **Step 4: Update the hook implementation**

Edit `src/hooks/useAdultVerification.ts`:

1. Replace the import `import { createNip98AuthHeader } from '@/lib/nip98Auth';` with `import { createMediaViewerAuthHeader } from '@/lib/mediaViewerAuth';`.
2. Widen the interface and the callback:

```ts
interface AdultVerificationState {
  isVerified: boolean;
  isLoading: boolean;
  hasSigner: boolean;
  confirmAdult: () => void;
  revokeVerification: () => void;
  getAuthHeader: (
    url: string,
    method?: string,
    sha256?: string,
  ) => Promise<string | null>;
}
```

3. Update the body:

```ts
const getAuthHeader = useCallback(
  async (
    url: string,
    method: string = 'GET',
    sha256?: string,
  ): Promise<string | null> => {
    if (!signer || !isVerified) {
      return null;
    }
    return createMediaViewerAuthHeader({ signer, url, sha256, method });
  },
  [signer, isVerified],
);
```

4. Leave `checkMediaAuth` and `fetchWithAuth` untouched. They are agnostic of protocol. `checkMediaAuth` is an unauthenticated HEAD probe that only looks for `ok` / `401` / `403` — no sha256 hint is needed because the goal is simply to detect "auth required" before attempting the authed fetch. The authed fetch path (inside `VideoPlayer`) is the only place that must choose Blossom vs. NIP-98.

- [ ] **Step 5: Update `hlsAuthLoader.ts` to keep its contract explicit**

Edit `src/lib/hlsAuthLoader.ts`:

1. Update the module doc comment to read:

```ts
// ABOUTME: Custom HLS.js loader that adds viewer auth headers to each request
// ABOUTME: Delegates protocol choice (Blossom vs NIP-98) to the passed-in generator
```

2. Keep the `AuthHeaderGenerator` signature as `(url: string, method?: string) => Promise<string | null>` — HLS segment URLs do not carry the blob's SHA-256, so the segment-level generator should continue to yield NIP-98 via the hook's default call path. No code changes inside `load(...)` are required.

3. Add a one-line comment above the `this.authHeaderGenerator(context.url, 'GET')` call:

```ts
// Segments are URL-addressed; no sha256 hint is available per segment.
```

This chunk intentionally does NOT pass sha256 into the HLS loader. See Chunk 4 for the fetched-MP4 path that does know the blob hash.

- [ ] **Step 6: Re-run the focused hook tests**

Run: `npx vitest run src/hooks/__tests__/useAdultVerification.test.ts`

Expected: PASS.

- [ ] **Step 7: Run any existing tests that touched `getAuthHeader` or the HLS loader**

Run:
- `npx vitest run src/lib/__tests__/hlsAuthLoader.test.ts 2>/dev/null || true`
- `npx vitest run src/hooks/__tests__`
- `npx tsc --noEmit`

Expected: PASS, or only pre-existing failures unrelated to this change. If existing HLS loader tests break because they asserted on specific NIP-98 naming in doc strings, update the assertions to the new protocol-neutral wording.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useAdultVerification.ts src/lib/hlsAuthLoader.ts src/hooks/__tests__/useAdultVerification.test.ts
git commit -m "refactor: route media viewer auth through shared picker"
```

---

## Chunk 4: Forward SHA-256 from `VideoPlayer` into the MP4 Fetch

### Task 4: Use Blossom auth when playing content-addressed blobs

**Files:**
- Modify: `src/components/VideoPlayer.tsx`
- Create (or extend): `src/components/__tests__/VideoPlayer.authHeaders.test.tsx`

Context recap:
- `VideoPlayer` already accepts `videoData?: ParsedVideoData`, and `ParsedVideoData.sha256` is already populated from `videoMetadata.hash` (see `videoParser.ts:734`).
- In the direct MP4 fetch path (`VideoPlayer.tsx` ~810–870), the component calls `await getAuthHeader(currentUrl)`. We want `await getAuthHeader(currentUrl, 'GET', videoData?.sha256)` whenever the SHA-256 is known.
- HLS auth loader calls stay URL-only (segment URLs don't carry the blob hash; a server that serves age-gated HLS manifests keyed by blob hash can continue using NIP-98 for segments, which is what it already does today).

- [ ] **Step 1: Write a failing test for the fetch path**

Create `src/components/__tests__/VideoPlayer.authHeaders.test.tsx`. We are not trying to exercise the whole `<video>` lifecycle; we only need to observe that after `confirmAdult`, the direct-MP4 fetch path calls `getAuthHeader` with the sha256 hint.

A minimal, focused approach is to unit-test the small helper that will perform the authed fetch. **Before writing this test, do Step 2 to identify whether to factor out a pure helper or to mount the full component.** If the component author prefers component-level coverage, extend an existing `VideoPlayer` test file instead of creating this new one, and mock `@/hooks/useAdultVerification` to capture `getAuthHeader` calls.

Skeleton for the component-level path (adjust imports to match sibling test files — look at existing `src/components/__tests__/VideoPlayer*.test.tsx` for the mocking style used in this repo):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const getAuthHeader = vi.fn().mockResolvedValue('Nostr HEADER');

vi.mock('@/hooks/useAdultVerification', () => ({
  useAdultVerification: () => ({
    isVerified: true,
    isLoading: false,
    hasSigner: true,
    confirmAdult: vi.fn(),
    revokeVerification: vi.fn(),
    getAuthHeader,
  }),
  checkMediaAuth: vi.fn().mockResolvedValue({ authorized: true, status: 200 }),
  fetchWithAuth: vi.fn(),
}));

// Stub fetch so the MP4 path completes deterministically
global.fetch = vi.fn().mockResolvedValue(
  new Response(new Blob([new Uint8Array([0])]), { status: 200 }),
);

// Stub URL.createObjectURL / revokeObjectURL for jsdom
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:stub');
  URL.revokeObjectURL = vi.fn();
}

import { VideoPlayer } from '@/components/VideoPlayer';

const HASH = 'a'.repeat(64);
const URL_MP4 = 'https://media.divine.video/file.mp4';

describe('VideoPlayer auth headers', () => {
  beforeEach(() => {
    getAuthHeader.mockClear();
    vi.mocked(global.fetch).mockClear();
  });

  it('passes sha256 into getAuthHeader for direct MP4 fetch when videoData.sha256 is set', async () => {
    render(
      <VideoPlayer
        videoId="v1"
        src={URL_MP4}
        videoData={{
          id: 'v1',
          pubkey: 'pub',
          kind: 34236,
          createdAt: 0,
          content: '',
          videoUrl: URL_MP4,
          sha256: HASH,
          hashtags: [],
          vineId: null,
          reposts: [],
          isVineMigrated: false,
        }}
      />,
    );

    await waitFor(() => expect(getAuthHeader).toHaveBeenCalled());
    const [url, method, sha256] = getAuthHeader.mock.calls[0];
    expect(url).toBe(URL_MP4);
    expect(method ?? 'GET').toBe('GET');
    expect(sha256).toBe(HASH);
  });

  it('omits the sha256 hint when videoData.sha256 is absent', async () => {
    render(
      <VideoPlayer
        videoId="v2"
        src={URL_MP4}
        videoData={{
          id: 'v2',
          pubkey: 'pub',
          kind: 34236,
          createdAt: 0,
          content: '',
          videoUrl: URL_MP4,
          hashtags: [],
          vineId: null,
          reposts: [],
          isVineMigrated: false,
        }}
      />,
    );

    await waitFor(() => expect(getAuthHeader).toHaveBeenCalled());
    const [, , sha256] = getAuthHeader.mock.calls[0];
    expect(sha256).toBeUndefined();
  });
});
```

If the repo has `jest-dom`/setup differences, mirror the setup used by the nearest existing `src/components/__tests__/VideoPlayer*.test.tsx` file.

- [ ] **Step 2: Run the focused component test and verify it fails**

Run: `npx vitest run src/components/__tests__/VideoPlayer.authHeaders.test.tsx`

Expected: FAIL — the existing `VideoPlayer` calls `getAuthHeader(currentUrl)` with no sha256. The first assertion (`expect(sha256).toBe(HASH)`) fails.

- [ ] **Step 3: Update `VideoPlayer.tsx` to forward `videoData.sha256`**

In `src/components/VideoPlayer.tsx`, find the direct MP4 fetch branch (currently around line 817):

```ts
const authHeader = await getAuthHeader(currentUrl);
```

Change it to:

```ts
const authHeader = await getAuthHeader(currentUrl, 'GET', videoData?.sha256);
```

Also update the dependency array at the bottom of the effect to include `videoData?.sha256` so a late-arriving hash triggers a retry with Blossom headers:

```ts
}, [
  hlsUrl,
  currentUrlIndex,
  allUrls,
  videoId,
  requiresAuth,
  isAdultVerified,
  authRetryCount,
  getAuthHeader,
  videoData?.sha256,
]);
```

Do NOT change the HLS branch's `createAuthLoader(getAuthHeader)` call — segments stay URL-only per Chunk 3's rationale.

**ESLint note:** `react-hooks/exhaustive-deps` may flag that `videoData` itself (not just `videoData?.sha256`) should be in the dep array. If the lint rule complains, add `videoData` as well — it's a stable prop, not destructured into multiple captured fields, so this will not cause extra re-runs in practice beyond what `videoData?.sha256` already triggers.

- [ ] **Step 4: Re-run the focused test**

Run: `npx vitest run src/components/__tests__/VideoPlayer.authHeaders.test.tsx`

Expected: PASS (2 tests).

- [ ] **Step 5: Spot-check the 401 retry flow still works**

This is a manual cross-check, not a new test. Confirm by reading:
- `handleAgeVerified` (`VideoPlayer.tsx` ~609–617) still bumps `authRetryCount` and clears `requiresAuth`.
- The effect that reads `authRetryCount` still runs `loadVideoSource`.
- `loadVideoSource` now calls `getAuthHeader(currentUrl, 'GET', videoData?.sha256)`, which picks Blossom when the hash is known and NIP-98 otherwise.

No code change expected here — if the read shows that `authRetryCount` is no longer in the dependency array, stop and fix; do NOT proceed.

- [ ] **Step 6: Commit**

```bash
git add src/components/VideoPlayer.tsx src/components/__tests__/VideoPlayer.authHeaders.test.tsx
git commit -m "fix(player): use Blossom auth for age-gated MP4 fetches when sha256 known"
```

---

## Chunk 5: Logged-Out Sign-In CTA on Age-Gated Content

### Task 5: Make the age-verification overlay tell logged-out viewers to sign in

**Files:**
- Modify: `src/components/AgeVerificationOverlay.tsx`
- Create (or extend): `src/components/__tests__/AgeVerificationOverlay.test.tsx`

Context recap:
- Today the overlay (`src/components/AgeVerificationOverlay.tsx:60–117`) shows the same "Age-Restricted Content" heading and the yellow warning icon for everyone, and merely swaps the "I'm 18 or older" button for a small gray line that reads "Sign in to view this content" when `!user`.
- That's easy to miss. A logged-out viewer has no way to proceed — they need to be told clearly that login is required and given a button that opens the login dialog (`useLoginDialog().openLoginDialog()`, already used elsewhere in the app, e.g. `src/components/VideoCardWithMetrics.tsx:48,65,83`).
- We keep the 30-day localStorage verification policy for already-logged-in users untouched.

- [ ] **Step 1: Write failing overlay tests**

Create (or append to) `src/components/__tests__/AgeVerificationOverlay.test.tsx`. Use the mocking style used by nearby component tests (e.g. `LoginDialog.test.tsx`, `LoginArea.test.tsx`).

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const openLoginDialog = vi.fn();
vi.mock('@/contexts/LoginDialogContext', () => ({
  useLoginDialog: () => ({ openLoginDialog, closeLoginDialog: vi.fn(), isOpen: false }),
}));

const confirmAdult = vi.fn();
vi.mock('@/hooks/useAdultVerification', () => ({
  useAdultVerification: () => ({
    isVerified: false,
    isLoading: false,
    hasSigner: false,
    confirmAdult,
    revokeVerification: vi.fn(),
    getAuthHeader: vi.fn(),
  }),
}));

const useCurrentUserMock = vi.fn();
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

import { AgeVerificationOverlay } from '@/components/AgeVerificationOverlay';

describe('AgeVerificationOverlay', () => {
  beforeEach(() => {
    openLoginDialog.mockClear();
    confirmAdult.mockClear();
    useCurrentUserMock.mockReset();
  });

  it('shows "Sign in to view this content" heading when no user is logged in', () => {
    useCurrentUserMock.mockReturnValue({ user: null, signer: null });
    render(<AgeVerificationOverlay onVerified={vi.fn()} />);

    expect(screen.getByText(/sign in to view this content/i)).toBeInTheDocument();
    // The age-verification button must NOT be present for logged-out viewers.
    expect(screen.queryByRole('button', { name: /18 or older/i })).toBeNull();
  });

  it('renders a Sign In button that opens the login dialog', () => {
    useCurrentUserMock.mockReturnValue({ user: null, signer: null });
    render(<AgeVerificationOverlay onVerified={vi.fn()} />);

    const signInButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(signInButton);
    expect(openLoginDialog).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing "I\'m 18 or older" flow when a user IS logged in', () => {
    useCurrentUserMock.mockReturnValue({
      user: { pubkey: 'pub' },
      signer: { signEvent: vi.fn(), getPublicKey: vi.fn() },
    });
    const onVerified = vi.fn();
    render(<AgeVerificationOverlay onVerified={onVerified} />);

    expect(screen.queryByText(/sign in to view this content/i)).toBeNull();
    const confirmButton = screen.getByRole('button', { name: /18 or older/i });
    fireEvent.click(confirmButton);
    expect(confirmAdult).toHaveBeenCalledTimes(1);
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when isVerified is true (preserves existing early-return)', async () => {
    // Re-mock just this test to flip isVerified.
    vi.doMock('@/hooks/useAdultVerification', () => ({
      useAdultVerification: () => ({
        isVerified: true,
        isLoading: false,
        hasSigner: true,
        confirmAdult,
        revokeVerification: vi.fn(),
        getAuthHeader: vi.fn(),
      }),
    }));
    vi.resetModules();
    const { AgeVerificationOverlay: Reloaded } = await import('@/components/AgeVerificationOverlay');
    useCurrentUserMock.mockReturnValue({
      user: { pubkey: 'pub' },
      signer: { signEvent: vi.fn(), getPublicKey: vi.fn() },
    });
    const { container } = render(<Reloaded onVerified={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused overlay tests and verify they fail**

Run: `npx vitest run src/components/__tests__/AgeVerificationOverlay.test.tsx`

Expected: FAIL — the "Sign in" role button and the explicit heading do not exist yet; the overlay currently renders only a passive gray paragraph for logged-out viewers.

- [ ] **Step 3: Update `AgeVerificationOverlay.tsx`**

1. Import the login dialog hook:

```ts
import { useLoginDialog } from '@/contexts/LoginDialogContext';
```

2. Pull the opener inside the component:

```ts
const { openLoginDialog } = useLoginDialog();
```

3. Replace the heading + description + CTA block (the `<div className="relative z-10 flex flex-col items-center gap-4 p-6 text-center max-w-sm">` subtree) with a logged-in-aware render. Keep the existing yellow-alert icon and the 30-day retention footnote for logged-in viewers; for logged-out viewers swap in a lock icon and a primary Sign In button.

Minimal diff:

```tsx
<div className="relative z-10 flex flex-col items-center gap-4 p-6 text-center max-w-sm">
  <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
    {user ? (
      <AlertTriangle className="w-8 h-8 text-yellow-500" />
    ) : (
      <ShieldCheck className="w-8 h-8 text-yellow-500" />
    )}
  </div>

  {user ? (
    <>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Age-Restricted Content</h3>
        <p className="text-sm text-gray-300">
          This content may not be appropriate for all audiences.
        </p>
      </div>
      <Button
        onClick={handleConfirm}
        disabled={isConfirming}
        className="gap-2 bg-white text-black hover:bg-gray-200 touch-manipulation"
      >
        {isConfirming ? (
          <>Verifying...</>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4" />
            I'm 18 or older
          </>
        )}
      </Button>
      <p className="text-xs text-gray-500 max-w-xs">
        Your choice will be remembered for 30 days
      </p>
    </>
  ) : (
    <>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Sign in to view this content</h3>
        <p className="text-sm text-gray-300">
          This content is age-restricted. Sign in so we can confirm your age and load the video.
        </p>
      </div>
      <Button
        onClick={openLoginDialog}
        className="gap-2 bg-white text-black hover:bg-gray-200 touch-manipulation"
      >
        Sign in
      </Button>
    </>
  )}
</div>
```

No other behavior changes. Do NOT remove the early `if (isVerified) return null;` guard — it is still correct.

- [ ] **Step 4: Re-run the overlay tests**

Run: `npx vitest run src/components/__tests__/AgeVerificationOverlay.test.tsx`

Expected: PASS (3 tests).

- [ ] **Step 5: Manual smoke check**

In `npm run dev`, open a known age-gated video URL while logged out and confirm:
- The overlay heading reads "Sign in to view this content".
- Clicking "Sign in" opens the login dialog (`LoginDialog`).
- After completing login, the overlay switches to the age-verification flow (the existing `isVerified`/retry mechanics are unchanged).

If the login dialog does not open, verify `LoginDialogProvider` wraps the route — it already does in the main app shell; if a test route strips it, that's out of scope for this plan.

- [ ] **Step 6: Commit**

```bash
git add src/components/AgeVerificationOverlay.tsx src/components/__tests__/AgeVerificationOverlay.test.tsx
git commit -m "feat(age-gate): show explicit sign-in CTA to logged-out viewers of age-restricted media"
```

---

## Chunk 6: End-to-End Verification and Docs

### Task 6: Verify touched code and document the contract

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run focused test sweep**

Run in the worktree:

```bash
npx vitest run \
  src/lib/__tests__/blossomAuth.test.ts \
  src/lib/__tests__/mediaViewerAuth.test.ts \
  src/hooks/__tests__/useAdultVerification.test.ts \
  src/components/__tests__/VideoPlayer.authHeaders.test.tsx \
  src/components/__tests__/AgeVerificationOverlay.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite and typecheck**

Run:
- `npx vitest run`
- `npx tsc --noEmit`

Expected: PASS, or only pre-existing failures unrelated to this change. If a pre-existing failure is in the auth or VideoPlayer area, stop and investigate — it may indicate a subtle regression.

- [ ] **Step 3: Update CLAUDE.md**

Add a short subsection under `## Common Gotchas` (or extend the existing `### Video Deduplication` block) describing the viewer-auth contract. Keep it under 10 lines:

```markdown
### Age-Gated Media Auth
- Age-verified users load age-gated media with `getAuthHeader(url, method, sha256?)`.
- When a blob SHA-256 is known (NIP-71 `imeta` `x`, i.e. `videoData.sha256`), the picker returns a Blossom/BUD-01 kind 24242 header.
- Otherwise it returns a NIP-98 kind 27235 header for the URL. HLS segments stay NIP-98 (segment URLs carry no blob hash).
- `divine-blossom` accepts both on viewer GETs; never invent a third protocol in the picker.
- Logged-out viewers on age-gated content see `AgeVerificationOverlay` in "Sign in to view" mode, wired to `useLoginDialog().openLoginDialog()` — they must log in before the age-verification / header-generation path runs.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record viewer auth contract for age-gated playback"
```

- [ ] **Step 5: Open a PR**

From this worktree, push the branch and open a PR against `main`. Target base: `main`. Title: `feat: Blossom/NIP-98 viewer auth parity for age-gated media`.

```bash
git push -u origin feat/age-restricted-viewer-auth
gh pr create --title "feat: Blossom/NIP-98 viewer auth parity for age-gated media" --body "$(cat <<'EOF'
## Summary
- Adds `src/lib/blossomAuth.ts` (BUD-01 kind 24242 GET auth).
- Adds `src/lib/mediaViewerAuth.ts` picker (Blossom when sha256 known, NIP-98 otherwise).
- Routes `useAdultVerification.getAuthHeader` and `VideoPlayer` MP4 fetches through the picker.

## Test plan
- [ ] `npx vitest run src/lib/__tests__/blossomAuth.test.ts`
- [ ] `npx vitest run src/lib/__tests__/mediaViewerAuth.test.ts`
- [ ] `npx vitest run src/hooks/__tests__/useAdultVerification.test.ts`
- [ ] `npx vitest run src/components/__tests__/VideoPlayer.authHeaders.test.tsx`
- [ ] `npx tsc --noEmit`
- [ ] Manual: age-gated video plays after Verify Age tap, using Blossom header when SHA-256 is present in the event's `imeta`.
EOF
)"
```

---

## Notes for Implementers

- Do **not** change the 30-day localStorage verification policy in `useAdultVerification`. The mobile plan explicitly scopes the fix to header generation + retry plumbing.
- Do **not** add a Blossom→NIP-98 client fallback inside a single request. If Blossom is rejected by the server despite a known hash, that's a server-contract issue; log and surface the error, don't silently retry with the other protocol — that hides divine-blossom regressions.
- `createAuthLoader` stays URL-only. HLS per-segment auth is NIP-98 in practice. If a future iteration wants per-manifest Blossom auth, that's a separate change.
- `@nostrify/nostrify`'s `NostrSigner` interface is the same one used in `useCurrentUser`; no new dependency is required.
