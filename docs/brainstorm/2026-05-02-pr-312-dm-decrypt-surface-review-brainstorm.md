# Brainstorm: PR #312 review response (DM decrypt-failure surfacing)

Date: 2026-05-02
PR: https://github.com/divinevideo/divine-web/pull/312
Issue: #309 (spun off from #307; #311 covers the healthcheck)

## Problem Statement

PR #312 replaces `unwrapDmGiftWrap`'s silent `null` return with a discriminated
`DmUnwrapResult`, threads per-failure counts through `fetchDmMessages` →
`useDmMessages` → new `useDmInboxStatus`, and renders a dedicated
`<InboxUnavailableState />` when every fetched wrap fails to decrypt.

Reviewer (jalcine) approved direction with seven inline comments. The question
this brainstorm answers: **what response is best aligned with codebase
standards?** Not preference, not minimum-viable — what does the actual evidence
in this repo prescribe?

## Codebase Standards (Investigated, Not Inferred)

### Hard rules from AGENTS.md

- **Line 33**: "Place tests next to code (`*.test.ts` / `*.test.tsx`)." Rules
  out a separate `*.testkit.ts` or `__fixtures__/` module — fixtures stay
  inline.
- **Line 43**: "Keep PRs tightly scoped to the task. Do not include unrelated
  formatting churn, lockfile noise, drive-by refactors, or incidental
  cleanup." This is the dispositive rule for the architectural question.
- **Line 45**: "Temporary or transitional code must include `TODO(#issue):`
  with a tracking issue for later removal." Defines the contract for
  deferring sub-work.

### Verified codebase precedent

- **`src/lib/inviteApi.ts:21-31`** — When the codebase needs to sub-classify
  a single failure type, the established pattern is a `code` discriminator
  on a single error/result type, not exploding the discriminant union:
  ```ts
  export type InviteApiErrorCode = 'invalid_invite' | 'unavailable' | 'unknown';
  export class InviteApiError extends Error {
    code: InviteApiErrorCode;
    ...
  }
  ```
- **`src/hooks/useNip05Validation.ts:7`** — Identical 4-state derived status
  pattern as the PR's `DmInboxStatus`:
  ```ts
  type ValidationState = 'loading' | 'valid' | 'invalid' | 'idle';
  ```
  So `DmInboxStatus` is **not novel** — it follows existing convention.
- **`src/lib/dm.test.ts:18-32, 133-136`** — Inline factory pattern
  (`makeVideo()`, `createTestSigner()`) is the established fixture style.
  No `__fixtures__/` directories or `*.testkit.ts` files exist anywhere
  in `src/`.

### Trace gaps (informational — out of #309 scope)

The PR fixes the unavailable signal at `MessagesPage` but the chain has three
other consumers that still fail-silent when the bunker is broken:

- **`ConversationPage.tsx:189`** — reads `useDmConversation`, never reads
  `useDmInboxStatus`. Deeplink to `/messages/<id>` shows empty messages.
- **`AppHeader.tsx:35` and `AppSidebar.tsx:69`** — read `useUnreadDmCount`,
  which returns 0 silently when bunker is broken.
- **Send path (`useDmSend`)** — `signer.nip44.encrypt` failures emerge as
  toasts but `useDmCapability` doesn't preempt. Covered by #311's
  healthcheck.

These are real gaps in the failure-loud architecture, but #309's ACs
explicitly named only `MessagesPage` as the surface to change. AGENTS.md
line 43 says scope creep is not allowed. Document as follow-up.

## Comment-by-Comment Evaluation

### Comments 5, 6, 7 — `MessagesPage.test.tsx:23, 114` use inline union instead of exported `DmInboxStatus`

**Decision: Apply.** The exported `DmInboxStatus` already exists at
`useDirectMessages.ts:296`. Importing it is one line and matches the precedent
where exported types are used by their consumers (e.g., `DmConversation`,
`DmMessage` are both imported from `@/lib/dm` in `MessagesPage.tsx:23-25`).

### Comments 2, 3 — `dm.test.ts:181, 210` repeat inline `wrap` + signer construction

**Decision: Apply, inline only.** Add `createDmTestWrap()` and a parameterized
`createMockSigner({ decrypt })` helper at the bottom of `dm.test.ts`,
adjacent to `createTestSigner` (line 133). AGENTS.md line 33 + zero precedent
for a shared `*.testkit.ts` rules out extracting to a separate file. This is
also exactly what jalcine asked for ("similar to `createTestSigner`").

### Comment 4 — `dm.ts:437` (`seal.pubkey !== rumor.pubkey`) collapses attestation mismatch into `malformed`

**Decision: Add a `TODO(#new-issue)` comment, defer the type change.**

The reviewer's concern is real: collapsing attestation/hash mismatches (a
forgery-adjacent signal) with JSON-parse failures (data corruption) loses
information. The codebase precedent for sub-classification (`InviteApiError`
at `inviteApi.ts:21-31`) suggests the right shape is a `code` discriminator:

```ts
| { ok: false; reason: 'malformed'; code: 'json' | 'kind-or-sig' | 'attestation' | 'hash' }
```

But:

1. **#309's ACs explicitly named two reasons**, not three or more. Adding
   `code` expands surface past the AC.
2. **AGENTS.md line 43** prohibits scope expansion in this PR.
3. **No consumer reads the granularity today.** `fetchDmMessages` doesn't
   sub-count, `useDmInboxStatus` only checks `decryptFailures === fetchedCount`.
   Adding a count nobody reads is the YAGNI trap.
4. **AGENTS.md line 45** prescribes `TODO(#issue):` for transitional gaps.

The principled response: add a TODO comment at `dm.ts:436-440` referencing
a new follow-up issue, with the `code` shape proposed in the issue body. This
satisfies the reviewer's concern (the gap is acknowledged and tracked),
respects scope, and follows the documented standard for transitional code.

### Comment 1 — `useDirectMessages.ts:116` "preemptive filter" in `getDmMessageQueryLimits`

**Decision: Push back with rationale, then apply a cleaner ternary.**

The literal suggestion (filter `getDmMessageQueryLimits` to only return
limits with existing cache data, drop the `[200, 300]` seed) would regress
the moderator-inbox UX this PR is fixing. The seed is intentional:

- Optimistic sends call `insertOptimisticDmIntoAllCaches` (line 126)
  → `updateDmMessageCaches` → iterates `getDmMessageQueryLimits`.
- If the user sends before any `useDmMessages(200)` query has returned
  (race that the moderator-inbox flow hits), the seed ensures the
  optimistic message lands in the limit-200 cache that MessagesPage
  reads.
- Removing the seed = optimistic message doesn't appear until network
  fetch returns. Strictly worse UX.

The spirit of jalcine's comment (the inner code is a bit `??`-noisy) is
addressable via a cleaner ternary that preserves the seed:

```ts
queryClient.setQueryData<FetchDmMessagesResult>(
  [...DM_QUERY_KEY, 'messages', ownerPubkey, limit],
  (existing) => existing
    ? { ...existing, messages: updater(existing.messages) }
    : { messages: updater([]), fetchedCount: 0, decryptFailures: 0, malformedCount: 0 },
);
```

Same behavior, less `??` noise, intent is clearer ("create a fresh result
or merge into existing"). Apply this and explain the seed in the reply.

## Recommendation

**Approach A-prime**: apply six comments (5,6,7 verbatim; 2,3 inline; 1 with
ternary cleanup), add a `TODO(#new-issue)` for comment 4, open one follow-up
issue. Do not expand `DmUnwrapResult`, do not extract a testkit, do not
extend the unavailable signal to ConversationPage / nav badges in this PR.

**Why this is the best practice in our case:**

1. **AGENTS.md line 43 is dispositive.** Three of the four "expand-scope"
   options (split `malformed`, extract testkit, propagate signal to other
   surfaces) violate the written scope rule.
2. **Codebase has precedent for the deferred work**, not for in-PR expansion.
   `InviteApiError.code` is the documented pattern for sub-classification —
   it lives in its own focused file, added by its own focused PR.
3. **`useNip05Validation.ts:7` is the proof** that `DmInboxStatus` doesn't
   need defending — the pattern already exists in the repo. Comment 4 is
   the only architectural question, and the codebase answers it: defer
   sub-classification to a focused follow-up.
4. **Comment 1 isn't a wholesale apply or ignore** — the suggestion as
   literally stated regresses behavior. The principled response is to
   push back on the literal suggestion, document why, and apply the
   stylistic spirit of it via the ternary refactor.
5. **The trace-revealed gaps** (ConversationPage, nav badges) are real but
   neither AGENTS.md nor #309 ACs justify fixing them in this PR. They
   warrant their own issue and their own focused PR. Doing them here
   would be exactly the "drive-by refactor" line 43 forbids.

## Patch Plan (for /plan handoff)

Files touched:

- `src/pages/MessagesPage.test.tsx` — import `DmInboxStatus` from
  `@/hooks/useDirectMessages`, replace inline union at lines 23 and 114.
- `src/lib/dm.test.ts` — add `createDmTestWrap(...)` and `createMockSigner(...)`
  helpers below `createTestSigner` at line 133. Refactor lines 147–244 to
  use them. No behavior change.
- `src/lib/dm.ts:436-440` — add `// TODO(#NEW): split attestation/hash
  mismatch into its own DmUnwrapResult.code per inviteApi.ts:21 precedent.`
- `src/hooks/useDirectMessages.ts:114-122` — rewrite as ternary.

Files NOT touched in this PR (but warrant follow-ups):

- `src/lib/dm.ts` `DmUnwrapResult` shape — follow-up issue with `code` proposal.
- `src/pages/ConversationPage.tsx` — follow-up issue for inbox-status banner.
- `src/components/AppHeader.tsx`, `src/components/AppSidebar.tsx` — same.

## Follow-up Issues to Open

1. **"feat(dm): sub-classify `DmUnwrapResult.malformed` via `code` discriminator"**
   - Proposed shape mirrors `InviteApiError.code` (`inviteApi.ts:21-31`).
   - Acceptance: forgery-adjacent (attestation/hash mismatch) is
     distinguishable from data-corruption (parse/kind/sig invalid) in
     fetched event counts. UI consumer not required initially.
2. **"feat(dm): propagate inbox-unavailable signal to ConversationPage and nav badges"**
   - Surface the `DmInboxStatus = 'unavailable'` state at `ConversationPage`
     deeplinks and unread-count badges in `AppHeader` / `AppSidebar`.
   - Acceptance: a moderator with a broken bunker session sees the
     unavailable state at every DM entry point, not just `/messages`.

## Open Questions for /plan

- [ ] Does the new follow-up issue (1) need a number assigned before this
  PR can land, or is "TODO(#TBD): pending follow-up issue" acceptable?
  AGENTS.md line 45 says `TODO(#issue):` with the issue ref. Best practice:
  open the issue first, then reference its number in the TODO.
- [ ] Reply text for jalcine on each comment — draft these in the /plan
  output so the response is consistent.

## Prerequisites

- Open follow-up issues (1) and (2) so we have numbers to reference in the
  TODO comment per AGENTS.md line 45.

## Next Step

`/plan` to spec the patch (Approach A-prime), draft the four reply
comments, and draft the two follow-up issue bodies.
