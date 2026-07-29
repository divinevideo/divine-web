# Collabs Web Tool — Design

**Date:** 2026-04-27
**Branch:** `feat/collabs-web-tool`
**Status:** Approved, ready for implementation plan

## Goal

A web tool inside divine-web where one operator (e.g. Sony's comms team) can log into each partner Nostr account in turn — `@sony.divine.video`, `@spiderman.divine.video`, `@tomholland.divine.video` — and:

1. **See pending collab invites** for the logged-in account (videos that name them in a `p`-tag where they haven't yet published kind 34238).
2. **Approve** an invite with one click — divine-web signs and broadcasts kind 34238, the collab flips to `confirmed` in funnelcake, and the video appears in that account's collab feed.
3. **Invite collaborators to an existing video** they've already published — re-publish the addressable kind 34236 with appended `p`-tags so newly-tagged accounts then see it in their inbox.

End-user / consumer-facing collab UX is **out of scope**; this is a desktop operator tool because mobile login switching is currently painful and partner workflows already happen on the web.

## Background

Divine-funnelcake recently added the collab data model. Already in production:

| Concept | Mechanism |
|---|---|
| Invite | `["p", collaborator_pubkey, role?]` tag on the creator's kind 34236 video |
| Pending state | Funnelcake row: video has p-tag, no matching kind 34238 |
| Confirmed state | Collaborator has published kind 34238 with `["a", "34236:creator:d-tag"]` |
| Public read | `GET /api/users/{pubkey}/collabs` returns confirmed-only |

The mobile app handles the *original* video-create-with-collaborators flow. This web tool handles only the **approval inbox** plus the **invite-to-an-existing-video** action.

## Architecture

### Routes

```
/collabs              CollabsPage (default tab = Inbox)
/collabs/inbox        InboxTab — pending invites for logged-in user
/collabs/invite       InviteTab — pick one of my videos, add collaborators
/collabs/confirmed    ConfirmedTab — read-only confirmed-collabs list
```

All four routes live inside the `isLoggedIn` block in `src/AppRouter.tsx`. A new "Collabs" sidebar entry uses `<Handshake weight="bold" />` from `@phosphor-icons/react`. Logged-out hits redirect to the existing login dialog flow.

`<CollabsPage />` is a thin shell owning URL-driven tab state; it renders `<InboxTab />`, `<InviteTab />`, or `<ConfirmedTab />`. No mobile-only layout: collapses to a single column on small screens but is not styled for that case.

### Component & file inventory

New files:

```
src/pages/CollabsPage.tsx
src/components/collabs/InboxTab.tsx
src/components/collabs/InviteTab.tsx
src/components/collabs/ConfirmedTab.tsx
src/components/collabs/InviteCollaboratorsDialog.tsx
src/components/collabs/PendingInviteCard.tsx
src/hooks/useCollabInvites.ts          # relay query for inbox
src/hooks/useApproveCollab.ts           # publishes kind 34238
src/hooks/useInviteCollaborators.ts     # republishes kind 34236
src/hooks/useVideoCollaboratorStatus.ts # relay query: who has accepted my video
src/hooks/useMyConfirmedCollabs.ts      # funnelcake REST
src/lib/nip05Resolve.ts                 # @x.divine.video → hex pubkey
src/lib/collabsParser.ts                # pure helpers (coords, dedupe, tags)
```

Existing files edited:

```
src/AppRouter.tsx                       # add /collabs* routes inside isLoggedIn block
src/components/layout/<Sidebar>.tsx     # add "Collabs" entry; planner: confirm exact path
```

`collabsParser.ts` exports the pure functions that don't need React: `coordOf(event)`, `getATagValues(event)`, `dedupeAddressables(events)`, `parsePTagCollaborator(tag)`. Easy to unit-test, easy to reuse.

### Data flow — Inbox

Discovery is **relay-side** (no funnelcake change):

```ts
function useCollabInvites() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  return useQuery({
    queryKey: ['collab-invites', user?.pubkey],
    enabled: !!user?.pubkey,
    queryFn: async ({ signal }) => {
      // 1. videos that name me as collaborator
      const tagged = await nostr.query(
        [{ kinds: [34236], '#p': [user.pubkey], limit: 100 }],
        { signal }
      );
      if (tagged.length === 0) return [];

      // 2. acceptances I've already published, keyed by coordinate
      const accepted = await nostr.query(
        [{ kinds: [34238], authors: [user.pubkey],
           '#a': tagged.map(coordOf) }],
        { signal }
      );
      const acceptedSet = new Set(accepted.flatMap(getATagValues));

      // 3. dedupe addressables, keep latest, drop already-accepted, drop self-tags
      return dedupeAndSubtract(tagged, acceptedSet, user.pubkey);
    },
    staleTime: 30_000,
  });
}
```

Two key behaviours:

- Dedupe by `pubkey:34236:d-tag` (addressable rule), keep latest `created_at`, drop already-accepted coordinates. If the creator republishes the video, the inbox shows the *current* version's collaborator request only.
- Self-tags filtered out (matches funnelcake's `c.collaborator_pubkey != v.pubkey`).

### Approve action

```ts
const event = await publishEvent({
  kind: 34238,
  content: '',
  tags: [
    ['a', `34236:${creatorPubkey}:${dTag}`],
    ['d', crypto.randomUUID()],          // required for parameterized replaceable
    ['client', 'divine-web'],
  ],
});
queryClient.invalidateQueries({ queryKey: ['collab-invites', me] });
queryClient.invalidateQueries({ queryKey: ['user-collabs', me] });
```

UI: card animates out on success, toast "Approved. You're now a collaborator on this video." On failure: standard error toast + retry.

**Why a random `d` tag instead of a deterministic coordinate-derived one?** Funnelcake keys acceptance on the `a` tag (the video coordinate), not the kind 34238's own `d` tag. A random UUID is fine because re-approving the same video produces a new addressable record but funnelcake state is unchanged. A deterministic d-tag (e.g. hashing the `a` coordinate) would give per-video idempotence at the addressable layer, but it's not load-bearing for the funnelcake model and adds no observable benefit. Random UUID is simpler and matches the existing publish-event pattern.

### Data flow — Invite tab

1. **Pick a video** — reuse `useUserVideos(me)` (already wraps `/api/users/{me}/videos`). Render as a small grid; click opens the dialog.
2. **Dialog** — shows existing p-tag list with pending/confirmed badges. **Status resolution is relay-side, not funnelcake-side**, because no funnelcake endpoint today returns "who has accepted *my* video as a collaborator" (the existing `/api/users/{pubkey}/collabs` answers the inverse: "videos where I am a collaborator"). Instead, `useVideoCollaboratorStatus(coord)` issues `nostr.query([{ kinds: [34238], '#a': [coord] }])` and the resulting events' `pubkey` field gives the confirmed-collaborator set; pubkeys present in the video's p-tags but absent from that set are pending. New rows accept either `npub1…` or NIP-05; resolution is async per row with a spinner.
3. **Republish**:

```ts
async function republishWithNewPTags(originalEvent, additions) {
  // Re-fetch absolute-latest version (someone may have republished since page load)
  const latest = await nostr.query(
    [{ kinds: [34236], authors: [me], '#d': [dTag], limit: 1 }],
    { signal }
  ).then(pickLatestByCreatedAt) ?? originalEvent;

  // Don't add duplicate p-tags
  const existingP = new Set(
    latest.tags.filter(t => t[0] === 'p').map(t => t[1])
  );
  const newPTags = additions
    .filter(a => !existingP.has(a.pubkey))
    .map(a => ['p', a.pubkey, ...(a.role ? [a.role] : [])]);

  if (newPTags.length === 0) {
    toast('No new collaborators to add.');
    return;
  }

  await publishEvent({
    kind: 34236,
    content: latest.content,
    tags: [...latest.tags, ...newPTags],     // preserve all original tags verbatim
    created_at: Math.floor(Date.now() / 1000),
  });

  queryClient.invalidateQueries({ queryKey: ['user-videos', me] });
}
```

Three things to call out:

1. **Re-fetch latest before republishing.** Addressable events are last-write-wins; if another tab republished since this page loaded we must merge into the freshest version.
2. **Preserve every tag verbatim** (`imeta`, `title`, `t`, `published_at`, `duration`, etc.). NIP-71 video events break if you drop the `imeta`. We never reconstruct — only append.
3. **Funnelcake side just works.** New p-tag → `pending` row appears via the funnelcake relay-write hook. Existing confirmed collaborators stay confirmed because their kind 34238's `["a", "34236:me:d-tag"]` resolves to the new event by coordinate.

Role is free-text, optional. No fixed enum in v1.

### Data flow — Confirmed tab

```ts
function useMyConfirmedCollabs() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ['user-collabs', user?.pubkey],
    enabled: !!user?.pubkey,
    queryFn: ({ signal }) => fetchUserCollabs(user.pubkey, { signal }),
    staleTime: 60_000,
  });
}
```

`fetchUserCollabs` is a new export in `src/lib/funnelcakeClient.ts` hitting `GET /api/users/{pubkey}/collabs?sort=recent`, unwrapped via the existing `unwrapListResponse` helper (envelope-tolerant). UI is a grid of `<VideoCard />`s; no custom rendering.

### NIP-05 resolution

A small new helper `src/lib/nip05Resolve.ts` because the existing `nip05Utils.ts` only handles URL display, not actual `.well-known` lookups.

```ts
export async function resolveNip05(handle: string, signal?: AbortSignal):
  Promise<{ pubkey: string; name: string; domain: string } | null> {
  // Accepted forms:
  //   "alice@divine.video"           → name=alice,    domain=divine.video
  //   "_@spiderman.divine.video"     → name=_,        domain=spiderman.divine.video
  //   "@spiderman.divine.video"      → name=_,        domain=spiderman.divine.video
  //                                    (leading-@ shorthand for root identity on
  //                                     subdomain-per-account divine.video accounts)
  //   "spiderman.divine.video"       → name=_,        domain=spiderman.divine.video
  //                                    (no '@' at all — same shorthand)
  // Fetches https://{domain}/.well-known/nostr.json?name={name}.
  // Returns null on 404 / malformed JSON / DNS failure.
}
```

The leading-`@`-and-no-local-part case is pinned to `name=_` because divine.video issues subdomain-per-account NIP-05s (e.g. `_@spiderman.divine.video`), so `@spiderman.divine.video` is unambiguously the Spider-Man root identity.

Error states: not found → "Couldn't find that handle"; network error → "Couldn't reach {domain}".

## Error Handling

| Failure | UX |
|---|---|
| Relay query fails | Inbox shows error card with retry button; existing data is preserved |
| `publishEvent` fails (signer denial, relay error) | Toast: "Couldn't broadcast. Try again." Card stays in place. |
| NIP-05 resolution fails | Inline row error; user can edit the handle |
| Funnelcake REST fails | Standard error card per existing `funnelcakeClient` pattern |
| User logs out mid-action | Mutation hooks `enabled: !!user?.pubkey`; pages redirect |
| Already accepted (race with another tab) | Approve mutation is idempotent — kind 34238 is replaceable; resulting state is still confirmed |

## Testing

Vitest + RTL, mirroring `useProfileStats.test.ts`:

1. **`collabsParser.test.ts`** — pure, fast. P-tag parsing (with/without role), dedupe by `pubkey:34236:d-tag` keeping latest `created_at`, coord building.
2. **`useCollabInvites.test.ts`** — mocks `useNostr`. Cases: empty; tagged but already-accepted via 34238 → filtered out; multiple versions of same addressable → only latest shown; self-tag → filtered out.
3. **`useApproveCollab.test.ts`** — published event has `kind: 34238`, correct `a` coordinate, `d` tag.
4. **`useInviteCollaborators.test.ts`** — re-fetch-latest behavior; existing p-tags preserved; duplicate-pubkey de-dup; `imeta` preserved verbatim.
5. **`nip05Resolve.test.ts`** — mocks `fetch`. `_@x.divine.video`, `name@divine.video`, not-found path.
6. **`useMyConfirmedCollabs.test.ts`** — funnelcake response shape, including `unwrapListResponse` envelope-tolerant path.
7. **`useVideoCollaboratorStatus.test.ts`** — pubkeys that appear in kind-34238 results are reported `confirmed`; pubkeys in the video's p-tags but missing from results are reported `pending`.
8. **`CollabsPage.test.tsx`** — one-line route test: each of `/collabs`, `/collabs/inbox`, `/collabs/invite`, `/collabs/confirmed` renders the right tab. Cheap insurance that URL-driven tab state stays wired.

No Playwright in v1. Component-level dialog interaction tests are nice-to-have but not blocking.

## Out of Scope (v1)

Recorded explicitly so they don't accidentally creep in:

- **Remove a collaborator from a video.** Credit-stripping; needs deliberate UX.
- **Decline / reject an invite.** "Don't publish 34238" is already the default.
- **Giftwrapped private invites (NIP-59).** Public p-tag chosen for v1; documented privacy caveat below.
- **Funnelcake `/collabs/pending` endpoint.** Relay query is fine at partner scale (≤ dozens of invites).
- **Mobile-pretty layout.** Desktop-only operator tool by design.
- **Account switcher inside the tool.** Relies on existing divine-web nlogin (logout, log back in).
- **End-user-facing collab UX.** Eventual goal but a separate project.

## Privacy Caveat

The current public-p-tag invite model means tagged collaborators are visible on the public relay before they accept. For partners shooting under NDA (e.g. unannounced casting), this leaks the relationship. Acceptable for v1; revisit with NIP-59 giftwrap if a real partner asks for confidentiality.

## Brand & A11y

- Sticker-variant button for the primary "Approve" CTA.
- "Collabs" sidebar uses `<Handshake weight="bold" />` (Phosphor, bold default per app).
- Inbox empty state copy: *"Inbox zero. Nothing waiting on you."*
- Confirmed empty state: *"No confirmed collabs yet. Once you approve an invite, it'll show up here."*
- No `uppercase` Tailwind class anywhere; no gradients on layout surfaces (per brand guardrails).
- Pages must pass the existing axe-core a11y suite for `/` and friends — extend `tests/visual/a11y.spec.ts` to also cover `/collabs/inbox` if logged-in fixtures exist; otherwise document the gap.
