# Collabs Web Tool — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/collabs` operator-tool page (Inbox / Invite / Confirmed tabs) so partner accounts can approve collab invites and add collaborators to videos they've already published.

**Architecture:** Three React Query hooks (one relay-side discovery, one relay-side mutation, one funnelcake REST read) plus pure helpers in `src/lib/collabsParser.ts` and a NIP-05 resolver in `src/lib/nip05Resolve.ts`. All mutations go through the existing `useNostrPublish` flow. No funnelcake or backend changes.

**Tech Stack:** React 18 + Vite + TanStack Query + `@nostrify/react` + Phosphor icons + shadcn/ui + Vitest + React Testing Library.

**Spec:** [docs/superpowers/specs/2026-04-27-collabs-web-tool-design.md](../specs/2026-04-27-collabs-web-tool-design.md)

---

## Conventions used in this plan

- **TDD**: every task goes test → run-fail → implement → run-pass → commit.
- Run vitest as `npx vitest run <path>` for a single file. Only run the full suite at the end.
- Type-check after substantial changes: `npx tsc --noEmit`.
- Commit message format: `type(scope): description` per `CLAUDE.md`. Trailing `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Files named per spec inventory. Don't invent new files.
- All new icons use `@phosphor-icons/react` per brand guardrail. The existing `AppSidebar.tsx` predates the rule and still uses `lucide-react`; we'll add a single phosphor `Handshake` icon and size it `size={18}` so it visually matches the lucide siblings — this keeps the new code compliant without restructuring the file.

---

## Chunk 1: Pure helpers and the NIP-05 resolver

These have no React dependencies and unblock every later hook. Land them first; everything else builds on them.

### Task 1: `collabsParser.ts` — coord helpers, p-tag parsing, dedupe

**Files:**
- Create: `src/lib/collabsParser.ts`
- Test: `src/lib/collabsParser.test.ts`

**What this owns:** Pure functions only. No React, no relay, no fetch.

- `coordOf(event)` → `"34236:<pubkey>:<d-tag>"` for a kind-34236 event.
- `getATagValues(event)` → array of `a` tag values from a kind-34238 event.
- `parsePTagCollaborator(tag)` → `{ pubkey, role? }` from `["p", pubkey, role?]`.
- `dedupeAndSubtract(taggedVideos, acceptedCoords, mePubkey)` → latest version per `pubkey:34236:d-tag`, drop coords already in `acceptedCoords`, drop self-tags.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/collabsParser.test.ts
import { describe, it, expect } from 'vitest';
import {
  coordOf,
  getATagValues,
  parsePTagCollaborator,
  dedupeAndSubtract,
} from './collabsParser';
import type { NostrEvent } from '@nostrify/nostrify';

const ME = 'a'.repeat(64);
const CREATOR = 'b'.repeat(64);
const OTHER_CREATOR = 'c'.repeat(64);

function video(d: string, opts: Partial<NostrEvent> & { pubkey?: string } = {}): NostrEvent {
  return {
    id: 'id-' + d + '-' + (opts.created_at ?? 0),
    pubkey: opts.pubkey ?? CREATOR,
    created_at: opts.created_at ?? 1700000000,
    kind: 34236,
    content: '',
    tags: [['d', d], ['p', ME], ...(opts.tags ?? [])],
    sig: '',
  };
}

describe('coordOf', () => {
  it('builds the canonical 34236 coordinate', () => {
    const e = video('vid1');
    expect(coordOf(e)).toBe(`34236:${CREATOR}:vid1`);
  });

  it('throws if the event has no d tag', () => {
    const e: NostrEvent = { ...video('vid1'), tags: [['p', ME]] };
    expect(() => coordOf(e)).toThrow(/missing d tag/i);
  });
});

describe('getATagValues', () => {
  it('returns every a-tag value', () => {
    const e: NostrEvent = {
      id: 'x', pubkey: ME, created_at: 0, kind: 34238, content: '', sig: '',
      tags: [['a', 'coord-1'], ['d', 'r1'], ['a', 'coord-2']],
    };
    expect(getATagValues(e)).toEqual(['coord-1', 'coord-2']);
  });
});

describe('parsePTagCollaborator', () => {
  it('parses a p-tag without a role', () => {
    expect(parsePTagCollaborator(['p', ME])).toEqual({ pubkey: ME });
  });
  it('parses a p-tag with a role', () => {
    expect(parsePTagCollaborator(['p', ME, 'actor'])).toEqual({ pubkey: ME, role: 'actor' });
  });
  it('returns null for non-p tags', () => {
    expect(parsePTagCollaborator(['e', 'whatever'])).toBeNull();
  });
});

describe('dedupeAndSubtract', () => {
  it('returns empty when nothing tagged', () => {
    expect(dedupeAndSubtract([], new Set(), ME)).toEqual([]);
  });

  it('keeps the latest version per addressable coord', () => {
    const older = video('vid1', { created_at: 1000 });
    const newer = video('vid1', { created_at: 2000 });
    const out = dedupeAndSubtract([older, newer], new Set(), ME);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(newer.id);
  });

  it('drops coords already in the accepted set', () => {
    const v = video('vid1');
    const out = dedupeAndSubtract([v], new Set([coordOf(v)]), ME);
    expect(out).toEqual([]);
  });

  it('drops self-tags (logged-in user is the creator)', () => {
    const v = video('vid1', { pubkey: ME });   // I tagged myself
    expect(dedupeAndSubtract([v], new Set(), ME)).toEqual([]);
  });

  it('keeps videos from different creators independently', () => {
    const a = video('vid1', { pubkey: CREATOR });
    const b = video('vid1', { pubkey: OTHER_CREATOR });   // same d-tag, different pubkey = different addressable
    const out = dedupeAndSubtract([a, b], new Set(), ME);
    expect(out).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/collabsParser.test.ts`
Expected: FAIL — module `./collabsParser` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/collabsParser.ts
import type { NostrEvent } from '@nostrify/nostrify';

export const SHORT_VIDEO_KIND = 34236 as const;
export const COLLAB_RESPONSE_KIND = 34238 as const;

export function dTagOf(event: NostrEvent): string {
  const tag = event.tags.find((t) => t[0] === 'd');
  if (!tag || !tag[1]) {
    throw new Error('Event is missing d tag');
  }
  return tag[1];
}

export function coordOf(event: NostrEvent): string {
  return `${event.kind}:${event.pubkey}:${dTagOf(event)}`;
}

export function getATagValues(event: NostrEvent): string[] {
  return event.tags.filter((t) => t[0] === 'a' && typeof t[1] === 'string').map((t) => t[1]);
}

export interface PTagCollaborator {
  pubkey: string;
  role?: string;
}

export function parsePTagCollaborator(tag: string[]): PTagCollaborator | null {
  if (tag[0] !== 'p' || !tag[1]) return null;
  const role = tag[2];
  return role ? { pubkey: tag[1], role } : { pubkey: tag[1] };
}

export function dedupeAndSubtract(
  taggedVideos: NostrEvent[],
  acceptedCoords: Set<string>,
  mePubkey: string,
): NostrEvent[] {
  const latestByCoord = new Map<string, NostrEvent>();
  for (const v of taggedVideos) {
    if (v.pubkey === mePubkey) continue;
    let coord: string;
    try { coord = coordOf(v); } catch { continue; }
    const prev = latestByCoord.get(coord);
    if (!prev || prev.created_at < v.created_at) {
      latestByCoord.set(coord, v);
    }
  }
  return [...latestByCoord.entries()]
    .filter(([coord]) => !acceptedCoords.has(coord))
    .map(([, event]) => event);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/collabsParser.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collabsParser.ts src/lib/collabsParser.test.ts
git commit -m "$(cat <<'EOF'
feat(collabs): pure helpers for coord, p-tag, dedupe

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `nip05Resolve.ts` — resolve `@x.divine.video` → hex pubkey

**Files:**
- Create: `src/lib/nip05Resolve.ts`
- Test: `src/lib/nip05Resolve.test.ts`

**What this owns:** A single async function that fetches `https://{domain}/.well-known/nostr.json?name={name}` and returns `{ pubkey, name, domain }` or `null`. Handles every input form the spec pins down.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/nip05Resolve.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { resolveNip05, parseNip05Handle } from './nip05Resolve';

describe('parseNip05Handle', () => {
  it.each([
    ['alice@divine.video',         { name: 'alice', domain: 'divine.video' }],
    ['_@spiderman.divine.video',   { name: '_',     domain: 'spiderman.divine.video' }],
    ['@spiderman.divine.video',    { name: '_',     domain: 'spiderman.divine.video' }],
    ['spiderman.divine.video',     { name: '_',     domain: 'spiderman.divine.video' }],
    ['  alice@divine.video  ',     { name: 'alice', domain: 'divine.video' }],
  ])('parses %s', (input, expected) => {
    expect(parseNip05Handle(input)).toEqual(expected);
  });

  it.each(['', '@', 'no-dot', 'a@', '@a'])('rejects %s', (input) => {
    expect(parseNip05Handle(input)).toBeNull();
  });
});

describe('resolveNip05', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a valid response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(
      JSON.stringify({ names: { alice: 'a'.repeat(64) } }),
      { status: 200 },
    ));
    const out = await resolveNip05('alice@divine.video');
    expect(out).toEqual({
      pubkey: 'a'.repeat(64),
      name: 'alice',
      domain: 'divine.video',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://divine.video/.well-known/nostr.json?name=alice',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('handles the @-shorthand for divine subdomain accounts', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(
      JSON.stringify({ names: { _: 'b'.repeat(64) } }),
      { status: 200 },
    ));
    const out = await resolveNip05('@spiderman.divine.video');
    expect(out).toEqual({
      pubkey: 'b'.repeat(64),
      name: '_',
      domain: 'spiderman.divine.video',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://spiderman.divine.video/.well-known/nostr.json?name=_',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }));
    expect(await resolveNip05('nobody@divine.video')).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('not json', { status: 200 }));
    expect(await resolveNip05('alice@divine.video')).toBeNull();
  });

  it('returns null when names map omits the requested name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(
      JSON.stringify({ names: { bob: 'b'.repeat(64) } }),
      { status: 200 },
    ));
    expect(await resolveNip05('alice@divine.video')).toBeNull();
  });

  it('returns null on a malformed handle', async () => {
    expect(await resolveNip05('garbage')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/nip05Resolve.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/nip05Resolve.ts
export interface ParsedNip05 {
  name: string;
  domain: string;
}

export interface ResolvedNip05 extends ParsedNip05 {
  pubkey: string;
}

export function parseNip05Handle(raw: string): ParsedNip05 | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Form 1: name@domain
  if (trimmed.includes('@')) {
    const [namePart, domainPart] = trimmed.split('@', 2);
    // "@spiderman.divine.video" — empty local-part, domain has at least one dot
    if (namePart === '') {
      if (domainPart && domainPart.includes('.')) {
        return { name: '_', domain: domainPart };
      }
      return null;
    }
    if (!domainPart || !domainPart.includes('.')) return null;
    return { name: namePart, domain: domainPart };
  }

  // Form 2: bare domain (e.g. "spiderman.divine.video") — root identity shorthand
  if (trimmed.includes('.')) {
    return { name: '_', domain: trimmed };
  }
  return null;
}

export async function resolveNip05(
  handle: string,
  signal?: AbortSignal,
): Promise<ResolvedNip05 | null> {
  const parsed = parseNip05Handle(handle);
  if (!parsed) return null;
  const url = `https://${parsed.domain}/.well-known/nostr.json?name=${encodeURIComponent(parsed.name)}`;
  try {
    const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = await res.json() as { names?: Record<string, string> };
    const pubkey = body?.names?.[parsed.name];
    if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(pubkey)) return null;
    return { pubkey: pubkey.toLowerCase(), name: parsed.name, domain: parsed.domain };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/nip05Resolve.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nip05Resolve.ts src/lib/nip05Resolve.test.ts
git commit -m "$(cat <<'EOF'
feat(collabs): NIP-05 resolver with subdomain shorthand

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 2: Data hooks (orchestration layer)

Each hook wraps a single concern. Tests use the existing `TestApp` test harness (`src/test/TestApp.tsx`).

### Task 3: `useCollabInvites` — relay-side discovery for the inbox

**Files:**
- Create: `src/hooks/useCollabInvites.ts`
- Test: `src/hooks/useCollabInvites.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useCollabInvites.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCollabInvites } from './useCollabInvites';
import { TestApp } from '@/test/TestApp';
import type { NostrEvent } from '@nostrify/nostrify';

const ME = 'a'.repeat(64);
const CREATOR = 'b'.repeat(64);

function video(d: string, opts: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'id-' + d + '-' + (opts.created_at ?? 0),
    pubkey: opts.pubkey as string ?? CREATOR,
    created_at: opts.created_at ?? 1700000000,
    kind: 34236,
    content: '',
    tags: [['d', d], ['p', ME], ...(opts.tags ?? [])],
    sig: '',
  };
}

const acceptance = (coord: string): NostrEvent => ({
  id: 'ack-' + coord,
  pubkey: ME,
  created_at: 1700000100,
  kind: 34238,
  content: '',
  tags: [['a', coord], ['d', 'd' + coord]],
  sig: '',
});

const queryMock = vi.fn();

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: ME }, signer: undefined }),
}));

vi.mock('@nostrify/react', async () => {
  const actual = await vi.importActual<typeof import('@nostrify/react')>('@nostrify/react');
  return {
    ...actual,
    useNostr: () => ({ nostr: { query: queryMock, event: vi.fn() } }),
  };
});

beforeEach(() => {
  queryMock.mockReset();
});

describe('useCollabInvites', () => {
  it('returns [] when no videos tag the user', async () => {
    queryMock.mockResolvedValueOnce([]);   // tagged videos
    const { result } = renderHook(() => useCollabInvites(), { wrapper: TestApp });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(queryMock).toHaveBeenCalledTimes(1);   // never bothers querying acks
  });

  it('drops videos the user has already accepted', async () => {
    const v1 = video('vid1');
    const v2 = video('vid2');
    queryMock
      .mockResolvedValueOnce([v1, v2])                                 // tagged
      .mockResolvedValueOnce([acceptance(`34236:${CREATOR}:vid1`)]);   // already accepted
    const { result } = renderHook(() => useCollabInvites(), { wrapper: TestApp });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((v) => v.tags.find((t) => t[0] === 'd')?.[1])).toEqual(['vid2']);
  });

  it('keeps only the latest version of an addressable coord', async () => {
    const older = video('vid1', { created_at: 1000 });
    const newer = video('vid1', { created_at: 2000 });
    queryMock.mockResolvedValueOnce([older, newer]).mockResolvedValueOnce([]);
    const { result } = renderHook(() => useCollabInvites(), { wrapper: TestApp });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].id).toBe(newer.id);
  });

  it('drops self-tagged videos', async () => {
    queryMock
      .mockResolvedValueOnce([video('vid1', { pubkey: ME })])
      .mockResolvedValueOnce([]);
    const { result } = renderHook(() => useCollabInvites(), { wrapper: TestApp });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useCollabInvites.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/useCollabInvites.ts
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  COLLAB_RESPONSE_KIND,
  SHORT_VIDEO_KIND,
  coordOf,
  dedupeAndSubtract,
  getATagValues,
} from '@/lib/collabsParser';

export function useCollabInvites() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['collab-invites', user?.pubkey],
    enabled: !!user?.pubkey,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const me = user!.pubkey;
      const tagged = await nostr.query(
        [{ kinds: [SHORT_VIDEO_KIND], '#p': [me], limit: 100 }],
        { signal },
      );
      if (tagged.length === 0) return [];

      const coords = Array.from(new Set(tagged.map((e) => {
        try { return coordOf(e); } catch { return null; }
      }).filter((c): c is string => Boolean(c))));

      const accepted = await nostr.query(
        [{ kinds: [COLLAB_RESPONSE_KIND], authors: [me], '#a': coords }],
        { signal },
      );
      const acceptedSet = new Set(accepted.flatMap(getATagValues));
      return dedupeAndSubtract(tagged, acceptedSet, me);
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useCollabInvites.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCollabInvites.ts src/hooks/useCollabInvites.test.ts
git commit -m "$(cat <<'EOF'
feat(collabs): useCollabInvites relay-side discovery

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `useApproveCollab` — publishes kind 34238

**Files:**
- Create: `src/hooks/useApproveCollab.ts`
- Test: `src/hooks/useApproveCollab.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useApproveCollab.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApproveCollab } from './useApproveCollab';
import { TestApp } from '@/test/TestApp';

const publishMutate = vi.fn();
const invalidateQueries = vi.fn();

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({ mutateAsync: publishMutate }),
}));
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries }),
  };
});
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: 'a'.repeat(64) } }),
}));

beforeEach(() => {
  publishMutate.mockReset();
  publishMutate.mockResolvedValue({ id: 'ack' });
  invalidateQueries.mockReset();
});

describe('useApproveCollab', () => {
  it('publishes a kind 34238 event with the right a- and d-tags', async () => {
    const { result } = renderHook(() => useApproveCollab(), { wrapper: TestApp });
    await act(async () => {
      await result.current.mutateAsync({
        creatorPubkey: 'b'.repeat(64),
        videoDTag: 'vid1',
      });
    });
    const arg = publishMutate.mock.calls[0][0];
    expect(arg.kind).toBe(34238);
    const aTag = arg.tags.find((t: string[]) => t[0] === 'a');
    expect(aTag?.[1]).toBe(`34236:${'b'.repeat(64)}:vid1`);
    const dTag = arg.tags.find((t: string[]) => t[0] === 'd');
    expect(typeof dTag?.[1]).toBe('string');
    expect(dTag?.[1].length).toBeGreaterThan(0);
  });

  it('invalidates inbox + confirmed query keys for the current user', async () => {
    const { result } = renderHook(() => useApproveCollab(), { wrapper: TestApp });
    await act(async () => {
      await result.current.mutateAsync({ creatorPubkey: 'b'.repeat(64), videoDTag: 'vid1' });
    });
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['collab-invites', 'a'.repeat(64)] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['user-collabs', 'a'.repeat(64)] });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useApproveCollab.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/useApproveCollab.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { COLLAB_RESPONSE_KIND, SHORT_VIDEO_KIND } from '@/lib/collabsParser';

interface ApproveArgs {
  creatorPubkey: string;
  videoDTag: string;
}

export function useApproveCollab() {
  const publish = useNostrPublish();
  const qc = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ creatorPubkey, videoDTag }: ApproveArgs) => {
      const coord = `${SHORT_VIDEO_KIND}:${creatorPubkey}:${videoDTag}`;
      return publish.mutateAsync({
        kind: COLLAB_RESPONSE_KIND,
        content: '',
        tags: [
          ['a', coord],
          ['d', crypto.randomUUID()],
        ],
      });
    },
    onSuccess: () => {
      const me = user?.pubkey;
      if (!me) return;
      qc.invalidateQueries({ queryKey: ['collab-invites', me] });
      qc.invalidateQueries({ queryKey: ['user-collabs', me] });
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useApproveCollab.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useApproveCollab.ts src/hooks/useApproveCollab.test.ts
git commit -m "$(cat <<'EOF'
feat(collabs): useApproveCollab publishes kind 34238

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `useVideoCollaboratorStatus` — who has accepted my video

**Files:**
- Create: `src/hooks/useVideoCollaboratorStatus.ts`
- Test: `src/hooks/useVideoCollaboratorStatus.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useVideoCollaboratorStatus.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useVideoCollaboratorStatus } from './useVideoCollaboratorStatus';
import { TestApp } from '@/test/TestApp';
import type { NostrEvent } from '@nostrify/nostrify';

const queryMock = vi.fn();
vi.mock('@nostrify/react', async () => {
  const actual = await vi.importActual<typeof import('@nostrify/react')>('@nostrify/react');
  return {
    ...actual,
    useNostr: () => ({ nostr: { query: queryMock, event: vi.fn() } }),
  };
});

beforeEach(() => queryMock.mockReset());

const COORD = `34236:${'b'.repeat(64)}:vid1`;
const TOM = 't'.repeat(64);
const SONY = 's'.repeat(64);

const ack = (pk: string): NostrEvent => ({
  id: 'ack-' + pk, pubkey: pk, created_at: 1, kind: 34238, content: '',
  tags: [['a', COORD], ['d', 'd-' + pk]], sig: '',
});

describe('useVideoCollaboratorStatus', () => {
  it('reports confirmed for pubkeys whose 34238 references the coord', async () => {
    queryMock.mockResolvedValueOnce([ack(TOM)]);
    const { result } = renderHook(
      () => useVideoCollaboratorStatus(COORD, [TOM, SONY]),
      { wrapper: TestApp },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      [TOM]: 'confirmed',
      [SONY]: 'pending',
    });
  });

  it('returns an empty map when collaborator list is empty', async () => {
    const { result } = renderHook(
      () => useVideoCollaboratorStatus(COORD, []),
      { wrapper: TestApp },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({});
    expect(queryMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useVideoCollaboratorStatus.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/useVideoCollaboratorStatus.ts
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { COLLAB_RESPONSE_KIND } from '@/lib/collabsParser';

export type CollaboratorStatus = 'pending' | 'confirmed';

export function useVideoCollaboratorStatus(
  coord: string | undefined,
  collaboratorPubkeys: string[],
) {
  const { nostr } = useNostr();
  return useQuery({
    queryKey: ['video-collab-status', coord, [...collaboratorPubkeys].sort()],
    enabled: !!coord && collaboratorPubkeys.length > 0,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [{ kinds: [COLLAB_RESPONSE_KIND], '#a': [coord!], authors: collaboratorPubkeys }],
        { signal },
      );
      const confirmedSet = new Set(events.map((e) => e.pubkey));
      const out: Record<string, CollaboratorStatus> = {};
      for (const pk of collaboratorPubkeys) {
        out[pk] = confirmedSet.has(pk) ? 'confirmed' : 'pending';
      }
      return out;
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useVideoCollaboratorStatus.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useVideoCollaboratorStatus.ts src/hooks/useVideoCollaboratorStatus.test.ts
git commit -m "$(cat <<'EOF'
feat(collabs): useVideoCollaboratorStatus relay-side per-video status

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `useInviteCollaborators` — republish kind 34236 with new p-tags

**Files:**
- Create: `src/hooks/useInviteCollaborators.ts`
- Test: `src/hooks/useInviteCollaborators.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useInviteCollaborators.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInviteCollaborators } from './useInviteCollaborators';
import { TestApp } from '@/test/TestApp';
import type { NostrEvent } from '@nostrify/nostrify';

const ME = 'm'.repeat(64);
const TOM = 't'.repeat(64);
const SONY = 's'.repeat(64);

const queryMock = vi.fn();
const publishMutate = vi.fn();
const invalidateQueries = vi.fn();

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: ME } }),
}));
vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({ mutateAsync: publishMutate }),
}));
vi.mock('@nostrify/react', async () => {
  const actual = await vi.importActual<typeof import('@nostrify/react')>('@nostrify/react');
  return {
    ...actual,
    useNostr: () => ({ nostr: { query: queryMock, event: vi.fn() } }),
  };
});
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return { ...actual, useQueryClient: () => ({ invalidateQueries }) };
});

const baseVideo: NostrEvent = {
  id: 'orig',
  pubkey: ME,
  created_at: 1000,
  kind: 34236,
  content: 'desc',
  tags: [
    ['d', 'vid1'],
    ['title', 'Hello'],
    ['imeta', 'url https://x', 'm video/mp4'],
    ['p', SONY, 'studio'],
  ],
  sig: '',
};

beforeEach(() => {
  queryMock.mockReset();
  publishMutate.mockReset();
  invalidateQueries.mockReset();
  publishMutate.mockResolvedValue({ id: 'new' });
});

describe('useInviteCollaborators', () => {
  it('republishes with the absolute-latest version, appending new p-tags', async () => {
    const newer: NostrEvent = {
      ...baseVideo,
      id: 'newer',
      created_at: 2000,
      tags: [...baseVideo.tags, ['t', 'after-edit']],
    };
    queryMock.mockResolvedValueOnce([newer]);   // re-fetch latest

    const { result } = renderHook(() => useInviteCollaborators(), { wrapper: TestApp });
    await act(async () => {
      await result.current.mutateAsync({
        original: baseVideo,
        additions: [{ pubkey: TOM, role: 'actor' }],
      });
    });

    const sent = publishMutate.mock.calls[0][0];
    expect(sent.kind).toBe(34236);
    expect(sent.content).toBe(newer.content);
    // Every tag from `newer` is preserved verbatim
    for (const t of newer.tags) {
      expect(sent.tags).toContainEqual(t);
    }
    // Tom appended with role
    expect(sent.tags).toContainEqual(['p', TOM, 'actor']);
    // d-tag identity preserved
    expect(sent.tags.find((t: string[]) => t[0] === 'd')?.[1]).toBe('vid1');
  });

  it('skips collaborators already present in the latest event', async () => {
    queryMock.mockResolvedValueOnce([baseVideo]);
    const { result } = renderHook(() => useInviteCollaborators(), { wrapper: TestApp });
    await act(async () => {
      await result.current.mutateAsync({
        original: baseVideo,
        additions: [{ pubkey: SONY, role: 'studio' }],   // already there
      });
    });
    expect(publishMutate).not.toHaveBeenCalled();
  });

  it('treats already-present collaborators as duplicates even with a different role', async () => {
    // Pinning the chosen behavior: dedup is by pubkey only, not by (pubkey, role).
    // Re-adding SONY (already studio) as "actor" is a no-op — we don't append a
    // second p-tag with a different role.
    queryMock.mockResolvedValueOnce([baseVideo]);
    const { result } = renderHook(() => useInviteCollaborators(), { wrapper: TestApp });
    await act(async () => {
      await result.current.mutateAsync({
        original: baseVideo,
        additions: [{ pubkey: SONY, role: 'actor' }],
      });
    });
    expect(publishMutate).not.toHaveBeenCalled();
  });

  it('falls back to the supplied event if the relay returns nothing', async () => {
    queryMock.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useInviteCollaborators(), { wrapper: TestApp });
    await act(async () => {
      await result.current.mutateAsync({
        original: baseVideo,
        additions: [{ pubkey: TOM }],
      });
    });
    const sent = publishMutate.mock.calls[0][0];
    expect(sent.tags).toContainEqual(['p', TOM]);
    expect(sent.tags).toContainEqual(['d', 'vid1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useInviteCollaborators.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/useInviteCollaborators.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { dTagOf, SHORT_VIDEO_KIND } from '@/lib/collabsParser';

interface CollabAddition {
  pubkey: string;
  role?: string;
}

interface InviteArgs {
  original: NostrEvent;
  additions: CollabAddition[];
}

export function useInviteCollaborators() {
  const { nostr } = useNostr();
  const publish = useNostrPublish();
  const qc = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ original, additions }: InviteArgs) => {
      const me = user?.pubkey;
      if (!me) throw new Error('Not logged in');

      const dTag = dTagOf(original);

      // Re-fetch absolute-latest version of this addressable
      const latestList = await nostr.query(
        [{ kinds: [SHORT_VIDEO_KIND], authors: [me], '#d': [dTag], limit: 1 }],
        {},
      );
      const latest = latestList
        .sort((a, b) => b.created_at - a.created_at)[0] ?? original;

      const existingP = new Set(
        latest.tags.filter((t) => t[0] === 'p' && t[1]).map((t) => t[1]),
      );
      const newPTags = additions
        .filter((a) => !existingP.has(a.pubkey))
        .map((a) => a.role ? ['p', a.pubkey, a.role] : ['p', a.pubkey]);

      if (newPTags.length === 0) return null;

      const event = await publish.mutateAsync({
        kind: SHORT_VIDEO_KIND,
        content: latest.content,
        tags: [...latest.tags, ...newPTags],
        created_at: Math.floor(Date.now() / 1000),
      });
      return event;
    },
    onSuccess: () => {
      const me = user?.pubkey;
      if (!me) return;
      qc.invalidateQueries({ queryKey: ['user-videos', me] });
      qc.invalidateQueries({ queryKey: ['video-collab-status'] });
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useInviteCollaborators.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useInviteCollaborators.ts src/hooks/useInviteCollaborators.test.ts
git commit -m "$(cat <<'EOF'
feat(collabs): useInviteCollaborators republishes with appended p-tags

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `fetchUserCollabs` + `useMyConfirmedCollabs`

**Files:**
- Modify: `src/lib/funnelcakeClient.ts` (add export)
- Create: `src/hooks/useMyConfirmedCollabs.ts`
- Test: `src/hooks/useMyConfirmedCollabs.test.ts`

**Note for the implementer:** before writing code, read `src/lib/funnelcakeClient.ts` and locate (a) the existing exported `fetch*` functions, (b) the `funnelcakeRequest` helper, (c) the `unwrapListResponse` helper. Use the exact same pattern; don't introduce a parallel one.

- [ ] **Step 0: Preflight — confirm `unwrapListResponse` is available**

The envelope-tolerant `unwrapListResponse` helper lives on the (currently open) `fix/funnelcake-envelope-tolerant` branch and may or may not have merged into `main` by the time this task runs.

Run:

```bash
grep -n "unwrapListResponse\|funnelcakeRequest" src/lib/funnelcakeClient.ts | head
```

- **If both helpers are present:** proceed to Step 1 using the spec'd `unwrapListResponse(raw).items` pattern.
- **If `unwrapListResponse` is missing** (and only `funnelcakeRequest` is): inline a small local helper at the top of `fetchUserCollabs` that handles both shapes:

```ts
function asVideoArray(raw: unknown): FunnelcakeVideoRaw[] {
  if (Array.isArray(raw)) return raw as FunnelcakeVideoRaw[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: FunnelcakeVideoRaw[] }).data;
  }
  return [];
}
```

…and call `return asVideoArray(raw);` instead of `return unwrapListResponse<FunnelcakeVideoRaw>(raw).items;`. Add a `// TODO(collab): replace with shared unwrapListResponse once that lands` comment so it's easy to clean up after the other PR merges.

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useMyConfirmedCollabs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMyConfirmedCollabs } from './useMyConfirmedCollabs';
import { TestApp } from '@/test/TestApp';

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: 'a'.repeat(64) } }),
}));

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockReset();
});

const stubVideo = (id: string) => ({
  id,
  pubkey: 'b'.repeat(64),
  created_at: 1700000000,
  kind: 34236,
  d_tag: 'd-' + id,
  title: 'Title ' + id,
  video_url: 'https://x/' + id,
});

describe('useMyConfirmedCollabs', () => {
  it('returns the video list from the raw-array shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([stubVideo('a'), stubVideo('b')])));
    const { result } = renderHook(() => useMyConfirmedCollabs(), { wrapper: TestApp });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('returns the video list from the {data,pagination} envelope shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      data: [stubVideo('a')],
      pagination: { has_more: false },
    })));
    const { result } = renderHook(() => useMyConfirmedCollabs(), { wrapper: TestApp });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((v) => v.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useMyConfirmedCollabs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Add `fetchUserCollabs` to `funnelcakeClient.ts`**

Locate the section in `src/lib/funnelcakeClient.ts` where existing `fetchUser*` functions are exported. Append:

```ts
// src/lib/funnelcakeClient.ts (append, near other fetchUser* exports)
export async function fetchUserCollabs(
  pubkey: string,
  options: { sort?: 'recent' | 'popular' | 'likes' | 'comments' | 'published';
             limit?: number; offset?: number; signal?: AbortSignal;
             apiUrl?: string } = {},
): Promise<FunnelcakeVideoRaw[]> {
  const apiUrl = options.apiUrl ?? API_CONFIG.funnelcake.baseUrl;
  const raw = await funnelcakeRequest<unknown>(
    apiUrl,
    `/api/users/${pubkey}/collabs`,
    {
      sort: options.sort ?? 'recent',
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
    },
    options.signal,
  );
  return unwrapListResponse<FunnelcakeVideoRaw>(raw).items;
}
```

(Adjust imports — `API_CONFIG`, `FunnelcakeVideoRaw`, `funnelcakeRequest`, `unwrapListResponse` — to match what's already imported at the top of the file.)

- [ ] **Step 4: Write the hook**

```ts
// src/hooks/useMyConfirmedCollabs.ts
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchUserCollabs } from '@/lib/funnelcakeClient';

export function useMyConfirmedCollabs() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ['user-collabs', user?.pubkey],
    enabled: !!user?.pubkey,
    staleTime: 60_000,
    queryFn: ({ signal }) => fetchUserCollabs(user!.pubkey, { signal }),
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/hooks/useMyConfirmedCollabs.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/funnelcakeClient.ts src/hooks/useMyConfirmedCollabs.ts src/hooks/useMyConfirmedCollabs.test.ts
git commit -m "$(cat <<'EOF'
feat(collabs): fetchUserCollabs + useMyConfirmedCollabs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 3: UI tabs, page shell, routing, sidebar entry

UI tasks have lighter test coverage by design (per spec: no Playwright in v1; component-interaction tests are nice-to-have but not blocking). Each task still includes at least one rendering smoke test where useful.

### Task 8: `PendingInviteCard`

**Files:**
- Create: `src/components/collabs/PendingInviteCard.tsx`
- Test: `src/components/collabs/PendingInviteCard.test.tsx`

**Owns:** Visual presentation of a single pending invite. Stateless. Receives the video event + a `loading` flag and an `onApprove` callback.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/collabs/PendingInviteCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { PendingInviteCard } from './PendingInviteCard';
import type { NostrEvent } from '@nostrify/nostrify';

const video: NostrEvent = {
  id: 'v', pubkey: 'b'.repeat(64), created_at: 1700000000, kind: 34236,
  content: 'desc', sig: '',
  tags: [
    ['d', 'vid1'],
    ['title', 'Hello world'],
    ['p', 'a'.repeat(64), 'actor'],
  ],
};

describe('PendingInviteCard', () => {
  it('renders the title and the role label', () => {
    render(
      <PendingInviteCard
        video={video}
        myPubkey={'a'.repeat(64)}
        onApprove={() => {}}
        approving={false}
      />,
      { wrapper: TestApp },
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText(/actor/i)).toBeInTheDocument();
  });

  it('falls back to "Collaborator" when the p-tag has no role', () => {
    const noRole: NostrEvent = { ...video, tags: video.tags.map((t) => t[0] === 'p' ? ['p', 'a'.repeat(64)] : t) };
    render(
      <PendingInviteCard video={noRole} myPubkey={'a'.repeat(64)} onApprove={() => {}} approving={false} />,
      { wrapper: TestApp },
    );
    expect(screen.getByText(/collaborator/i)).toBeInTheDocument();
  });

  it('calls onApprove with creatorPubkey + d-tag when the button is clicked', () => {
    const onApprove = vi.fn();
    render(
      <PendingInviteCard video={video} myPubkey={'a'.repeat(64)} onApprove={onApprove} approving={false} />,
      { wrapper: TestApp },
    );
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledWith({ creatorPubkey: 'b'.repeat(64), videoDTag: 'vid1' });
  });

  it('disables the button while approving', () => {
    render(
      <PendingInviteCard video={video} myPubkey={'a'.repeat(64)} onApprove={() => {}} approving={true} />,
      { wrapper: TestApp },
    );
    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/collabs/PendingInviteCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/collabs/PendingInviteCard.tsx
import type { NostrEvent } from '@nostrify/nostrify';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { dTagOf, parsePTagCollaborator } from '@/lib/collabsParser';

interface Props {
  video: NostrEvent;
  myPubkey: string;
  approving: boolean;
  onApprove: (args: { creatorPubkey: string; videoDTag: string }) => void;
}

export function PendingInviteCard({ video, myPubkey, approving, onApprove }: Props) {
  const title = video.tags.find((t) => t[0] === 'title')?.[1] ?? 'Untitled';
  const myPTag = video.tags
    .map(parsePTagCollaborator)
    .find((c) => c?.pubkey === myPubkey);
  const role = myPTag?.role ?? 'Collaborator';

  return (
    <Card variant="brand" className="flex items-start gap-4 p-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground">{role}</p>
        <p className="font-semibold truncate">{title}</p>
      </div>
      <Button
        variant="sticker"
        disabled={approving}
        onClick={() => onApprove({
          creatorPubkey: video.pubkey,
          videoDTag: dTagOf(video),
        })}
      >
        {approving ? 'Approving…' : 'Approve'}
      </Button>
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/collabs/PendingInviteCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/collabs/PendingInviteCard.tsx src/components/collabs/PendingInviteCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(collabs): PendingInviteCard component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `InboxTab`

**Files:**
- Create: `src/components/collabs/InboxTab.tsx`

**Owns:** glue layer between `useCollabInvites` + `useApproveCollab` + `<PendingInviteCard />`. No new test logic — the underlying hook tests already cover the contracts; this is presentation.

- [ ] **Step 1: Write minimal implementation**

```tsx
// src/components/collabs/InboxTab.tsx
import { useCollabInvites } from '@/hooks/useCollabInvites';
import { useApproveCollab } from '@/hooks/useApproveCollab';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { PendingInviteCard } from './PendingInviteCard';

export function InboxTab() {
  const { user } = useCurrentUser();
  const { data, isPending, isError, refetch } = useCollabInvites();
  const approve = useApproveCollab();

  if (!user) return null;
  if (isPending) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="rounded-2xl border p-6 text-center">
        <p>Couldn't load invites.</p>
        <button className="mt-2 underline" onClick={() => refetch()}>Try again</button>
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border p-6 text-center text-muted-foreground">
        Inbox zero. Nothing waiting on you.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((video) => (
        <PendingInviteCard
          key={video.id}
          video={video}
          myPubkey={user.pubkey}
          approving={approve.isPending}
          onApprove={(args) => approve.mutate(args)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/collabs/InboxTab.tsx
git commit -m "$(cat <<'EOF'
feat(collabs): InboxTab wires invites + approve hook

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `InviteCollaboratorsDialog`

**Files:**
- Create: `src/components/collabs/InviteCollaboratorsDialog.tsx`

**Owns:** the modal flow — list existing p-tags with status badges (`useVideoCollaboratorStatus`), accept `npub` / NIP-05 input, resolve via `resolveNip05` (and `nip19.decode` for `npub1…`), submit via `useInviteCollaborators`.

- [ ] **Step 1: Write minimal implementation**

```tsx
// src/components/collabs/InviteCollaboratorsDialog.tsx
import { useMemo, useState } from 'react';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useVideoCollaboratorStatus } from '@/hooks/useVideoCollaboratorStatus';
import { useInviteCollaborators } from '@/hooks/useInviteCollaborators';
import { resolveNip05 } from '@/lib/nip05Resolve';
import { coordOf, parsePTagCollaborator } from '@/lib/collabsParser';

interface Pending {
  pubkey: string;
  role?: string;
  label: string;       // what the user typed, for display
}

interface Props {
  video: NostrEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteCollaboratorsDialog({ video, open, onOpenChange }: Props) {
  const existing = useMemo(() => video.tags
    .map(parsePTagCollaborator)
    .filter((c): c is { pubkey: string; role?: string } => Boolean(c)), [video]);

  const { data: status } = useVideoCollaboratorStatus(
    coordOf(video),
    existing.map((c) => c.pubkey),
  );

  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = useInviteCollaborators();

  async function add() {
    setError(null);
    if (!handle.trim()) return;
    setResolving(true);
    try {
      // Try npub first
      let pubkey: string | null = null;
      if (handle.startsWith('npub1')) {
        try {
          const decoded = nip19.decode(handle.trim());
          if (decoded.type === 'npub') pubkey = decoded.data as string;
        } catch { /* fall through */ }
      }
      if (!pubkey) {
        const resolved = await resolveNip05(handle.trim());
        if (resolved) pubkey = resolved.pubkey;
      }
      if (!pubkey) {
        setError("Couldn't find that handle.");
        return;
      }
      setPending((p) => [...p, { pubkey, role: role || undefined, label: handle.trim() }]);
      setHandle('');
      setRole('');
    } finally {
      setResolving(false);
    }
  }

  async function submit() {
    if (pending.length === 0) return;
    await invite.mutateAsync({ original: video, additions: pending });
    setPending([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite collaborators</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <section>
            <h3 className="text-sm font-semibold mb-2">Currently tagged</h3>
            <ul className="space-y-1">
              {existing.length === 0 && (
                <li className="text-sm text-muted-foreground">None yet.</li>
              )}
              {existing.map((c) => (
                <li key={c.pubkey} className="flex items-center gap-2 text-sm">
                  <code className="truncate flex-1">{c.pubkey.slice(0, 12)}…</code>
                  {c.role && <span className="text-muted-foreground">{c.role}</span>}
                  <Badge variant={status?.[c.pubkey] === 'confirmed' ? 'default' : 'secondary'}>
                    {status?.[c.pubkey] ?? 'pending'}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Add collaborator</h3>
            <div className="flex gap-2">
              <Input
                placeholder="@handle.divine.video or npub1…"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                disabled={resolving}
              />
              <Input
                placeholder="role (optional)"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-[140px]"
              />
              <Button onClick={add} disabled={resolving || !handle.trim()}>
                {resolving ? '…' : 'Add'}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
            {pending.length > 0 && (
              <ul className="mt-3 space-y-1">
                {pending.map((p) => (
                  <li key={p.pubkey} className="text-sm">
                    <span className="font-medium">{p.label}</span>
                    {p.role && <span className="text-muted-foreground"> · {p.role}</span>}
                    <span className="text-muted-foreground"> — to add</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="sticker"
            onClick={submit}
            disabled={pending.length === 0 || invite.isPending}
          >
            {invite.isPending ? 'Republishing…' : 'Republish video'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/collabs/InviteCollaboratorsDialog.tsx
git commit -m "$(cat <<'EOF'
feat(collabs): InviteCollaboratorsDialog with NIP-05 resolution

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `InviteTab`

**Files:**
- Create: `src/components/collabs/InviteTab.tsx`

**Owns:** my-videos picker grid + click-to-open the dialog. Uses the existing `useUserVideos` hook.

- [ ] **Step 1: Look up the existing `useUserVideos` hook**

Run: `grep -rln "export.*useUserVideos" src/hooks/`
Expected: a single hook file. Use whatever shape it returns (likely `FunnelcakeVideoRaw[]` or transformed).

- [ ] **Step 2: Write minimal implementation**

```tsx
// src/components/collabs/InviteTab.tsx
import { useState } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { InviteCollaboratorsDialog } from './InviteCollaboratorsDialog';
import { SHORT_VIDEO_KIND } from '@/lib/collabsParser';

// Re-fetches the user's own kind 34236 events directly from the relay so we have the
// full event (not just a Funnelcake projection) for republishing.
function useMyVideoEvents() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  return useQuery({
    queryKey: ['user-videos-events', user?.pubkey],
    enabled: !!user?.pubkey,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [{ kinds: [SHORT_VIDEO_KIND], authors: [user!.pubkey], limit: 100 }],
        { signal },
      );
      // Dedupe by d-tag, keep latest
      const byDTag = new Map<string, NostrEvent>();
      for (const e of events) {
        const d = e.tags.find((t) => t[0] === 'd')?.[1];
        if (!d) continue;
        const prev = byDTag.get(d);
        if (!prev || prev.created_at < e.created_at) byDTag.set(d, e);
      }
      return [...byDTag.values()].sort((a, b) => b.created_at - a.created_at);
    },
  });
}

export function InviteTab() {
  const { data, isPending } = useMyVideoEvents();
  const [selected, setSelected] = useState<NostrEvent | null>(null);

  if (isPending) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-video animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border p-6 text-center text-muted-foreground">
        You haven't published any videos yet. Once you do, they'll show up here.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {data.map((video) => {
          const title = video.tags.find((t) => t[0] === 'title')?.[1] ?? 'Untitled';
          return (
            <Card
              key={video.id}
              variant="brand"
              className="cursor-pointer p-3"
              onClick={() => setSelected(video)}
            >
              <p className="font-semibold truncate">{title}</p>
            </Card>
          );
        })}
      </div>
      {selected && (
        <InviteCollaboratorsDialog
          video={selected}
          open={true}
          onOpenChange={(open) => { if (!open) setSelected(null); }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/collabs/InviteTab.tsx
git commit -m "$(cat <<'EOF'
feat(collabs): InviteTab + my-videos picker

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `ConfirmedTab`

**Files:**
- Create: `src/components/collabs/ConfirmedTab.tsx`

- [ ] **Step 1: Look up existing video card**

Run: `grep -rln "export.*VideoCard" src/components/`
Use whatever the existing `VideoCard` (or equivalent grid item) expects as props. The `FunnelcakeVideoRaw` returned by `fetchUserCollabs` has `id`, `pubkey`, `kind`, `d_tag`, `title`, `thumbnail`, `video_url`. If `VideoCard` accepts the funnelcake shape directly, use it. If it requires a transform, look for the existing `transformFunnelcakeVideo` (or similar) helper and use that.

- [ ] **Step 2: Write minimal implementation**

```tsx
// src/components/collabs/ConfirmedTab.tsx
import { useMyConfirmedCollabs } from '@/hooks/useMyConfirmedCollabs';
// Replace the next import with whatever the codebase already uses to render
// a Funnelcake-shaped video as a grid card. Don't invent a new component.
// import { VideoCard } from '@/components/VideoCard';

export function ConfirmedTab() {
  const { data, isPending, isError } = useMyConfirmedCollabs();

  if (isPending) return <div className="text-muted-foreground">Loading…</div>;
  if (isError) return <div className="text-destructive">Couldn't load.</div>;
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border p-6 text-center text-muted-foreground">
        No confirmed collabs yet. Once you approve an invite, it'll show up here.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {/* Replace with the project's VideoCard. Fallback for plan reviewer: */}
      {data.map((v) => (
        <div key={v.id} className="rounded-xl border p-3">
          <p className="font-semibold truncate">{v.title ?? v.d_tag}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2a: Replace the placeholder card with the project's `VideoCard`**

Run:

```bash
grep -rln "export.*VideoCard\|export default.*VideoCard" src/components/
```

Open the file the grep returns. Read its props signature. Then in `ConfirmedTab.tsx`:

1. Uncomment the `VideoCard` import and adjust the path if needed.
2. Replace the placeholder `<div className="rounded-xl border p-3">…</div>` with the real `<VideoCard … />` invocation.
3. If `VideoCard` expects a different shape than `FunnelcakeVideoRaw`, look in `src/lib/funnelcakeTransform.ts` for an existing `transformFunnelcakeVideo` (or similarly named) helper and use it. **Do not** write a new transform.
4. Re-run `npx tsc --noEmit` to confirm no type errors.

The placeholder must not survive into the commit — the next step's commit covers this file.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/collabs/ConfirmedTab.tsx
git commit -m "$(cat <<'EOF'
feat(collabs): ConfirmedTab read-only list

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: `CollabsPage` + routing wiring

**Files:**
- Create: `src/pages/CollabsPage.tsx`
- Test: `src/pages/CollabsPage.test.tsx`
- Modify: `src/AppRouter.tsx` (add four routes inside `isLoggedIn`)

- [ ] **Step 1: Write the failing test**

```tsx
// src/pages/CollabsPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TestApp } from '@/test/TestApp';
import { CollabsPage } from './CollabsPage';

vi.mock('@/components/collabs/InboxTab', () => ({ InboxTab: () => <div>INBOX</div> }));
vi.mock('@/components/collabs/InviteTab', () => ({ InviteTab: () => <div>INVITE</div> }));
vi.mock('@/components/collabs/ConfirmedTab', () => ({ ConfirmedTab: () => <div>CONFIRMED</div> }));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/collabs" element={<CollabsPage />} />
        <Route path="/collabs/:tab" element={<CollabsPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: ({ children }) => <TestApp>{children}</TestApp> },
  );
}

describe('CollabsPage', () => {
  it.each([
    ['/collabs',           'INBOX'],
    ['/collabs/inbox',     'INBOX'],
    ['/collabs/invite',    'INVITE'],
    ['/collabs/confirmed', 'CONFIRMED'],
  ])('renders the right tab for %s', (path, expected) => {
    renderAt(path);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/CollabsPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `CollabsPage`**

```tsx
// src/pages/CollabsPage.tsx
import { useParams, Link } from 'react-router-dom';
import { InboxTab } from '@/components/collabs/InboxTab';
import { InviteTab } from '@/components/collabs/InviteTab';
import { ConfirmedTab } from '@/components/collabs/ConfirmedTab';
import { cn } from '@/lib/utils';

type Tab = 'inbox' | 'invite' | 'confirmed';

const TABS: { key: Tab; label: string }[] = [
  { key: 'inbox',     label: 'Inbox' },
  { key: 'invite',    label: 'Invite' },
  { key: 'confirmed', label: 'Confirmed' },
];

export function CollabsPage() {
  const { tab } = useParams<{ tab?: Tab }>();
  const active: Tab = (tab && TABS.some((t) => t.key === tab)) ? tab : 'inbox';

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Collabs</h1>

      <nav className="mb-6 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={`/collabs/${t.key}`}
            className={cn(
              'px-3 py-2 text-sm border-b-2',
              active === t.key
                ? 'border-foreground font-medium'
                : 'border-transparent text-muted-foreground',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {active === 'inbox' && <InboxTab />}
      {active === 'invite' && <InviteTab />}
      {active === 'confirmed' && <ConfirmedTab />}
    </div>
  );
}

export default CollabsPage;
```

- [ ] **Step 4: Wire routes into `AppRouter.tsx`**

Open `src/AppRouter.tsx`. Add the import near the other page imports (alphabetical-ish):

```tsx
import CollabsPage from "./pages/CollabsPage";
```

Then inside the `{isLoggedIn && (<>…</>)}` block, add:

```tsx
<Route path="/collabs" element={<CollabsPage />} />
<Route path="/collabs/:tab" element={<CollabsPage />} />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/pages/CollabsPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/CollabsPage.tsx src/pages/CollabsPage.test.tsx src/AppRouter.tsx
git commit -m "$(cat <<'EOF'
feat(collabs): CollabsPage + /collabs routes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Sidebar nav entry

**Files:**
- Modify: `src/components/AppSidebar.tsx`

- [ ] **Step 1: Add the phosphor icon import**

Open `src/components/AppSidebar.tsx`. Add an import alongside the existing `lucide-react` imports (NOT replacing them):

```tsx
import { Handshake } from '@phosphor-icons/react';
```

- [ ] **Step 2: Add the nav entry**

Inside the same `<nav>` block where Notifications and Profile entries live, insert:

```tsx
{user && (
  <NavItem
    icon={<Handshake size={18} weight="bold" />}
    label="Collabs"
    onClick={() => navigate('/collabs')}
    isActive={location.pathname === '/collabs' || location.pathname.startsWith('/collabs/')}
  />
)}
```

Ordering: place it after Notifications and before Profile, so the operator workflow (notifications → collabs → profile) reads naturally.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Visual smoke check (manual)**

Run: `npm run dev`
- Log in as any account.
- Confirm the sidebar shows a "Collabs" entry between Notifications and Profile, with a handshake icon visually consistent with siblings.
- Click it → lands on `/collabs/` and renders the Inbox tab.
- Click each tab → URL updates and the right tab renders.

If the icon visually clashes (Phosphor `bold` weight at `size={18}` looks heavier or lighter than the lucide neighbors), nudge with `weight="regular"` instead and retry.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppSidebar.tsx
git commit -m "$(cat <<'EOF'
feat(collabs): sidebar entry for /collabs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Final type check + full test suite + smoke checklist

**Files:** none modified.

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all previously passing tests still pass; new tests added by this plan all pass.

If any pre-existing tests fail because of unrelated changes on `main` since this branch was created, do NOT fix them in this PR — note them as a follow-up.

- [ ] **Step 3: Manual smoke test (the four-account dance)**

This is the test that the actual product works. Easiest with two browsers / one normal + one incognito so you can hold two sessions at once.

1. **Account A (creator):** log in. Use the existing publish flow (mobile or whatever) to publish a kind 34236 video that includes `["p", <pubkey of Account B>, "actor"]` in the tags. Confirm it lands on the relay.
2. **Account B (collaborator):** log in via divine-web on web in another browser. Navigate to `/collabs`. Confirm the video from step 1 appears in the Inbox with the role label "actor".
3. Click **Approve** on B's card. Confirm:
   - The card disappears from the inbox.
   - The Confirmed tab now shows the video.
   - `curl https://api.divine.video/api/users/<B-pubkey>/collabs` returns the video (allow ~30s for funnelcake to ingest).
4. **Back to Account A:** go to `/collabs/invite`, pick the same video, type Account C's `@nip05` handle, click Add → click Republish.
5. **Account C:** log in. Confirm the same video now appears in C's Inbox.
6. Approve from C. Confirm the cycle closes.

Document any observations in a follow-up issue, not in this PR.

- [ ] **Step 4: No commit**

This task is verification only.

---

## Out-of-scope reminders for the implementer

These are deliberately *not* in any task. Don't add them under pressure:

- A "Decline invite" button.
- A "Remove collaborator" action in the invite dialog.
- Giftwrapped (NIP-59) private invites.
- A new funnelcake `/collabs/pending` endpoint.
- A mobile-pretty layout for `/collabs`.
- An in-tool account switcher.

If any of those feel necessary mid-implementation, stop and ask — they're real follow-ups, but they'd nearly double the surface of this plan.

---

## Done when

- All 15 tasks above are complete and committed.
- `npx tsc --noEmit` is clean.
- `npm test` is green.
- The manual smoke test in Task 15 passes end-to-end with three real accounts on a relay.
- The branch (`feat/collabs-web-tool`) is pushed and a PR is opened against `main` with the spec doc + this plan + the implementation commits.
