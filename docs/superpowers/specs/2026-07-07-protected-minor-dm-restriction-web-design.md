# Restrict protected-minor DMs to official Divine accounts on web (divine-web#454)

**Issue:** divine-web#454, web half of support-trust-safety#176 (epic #173).
**Date:** 2026-07-07, following the divine-mobile#4948 trust-model decision.
**Status:** Design complete, pending Matt's approval; implementation follows on
this branch. Mirrors the mobile design
(`divine-mobile/docs/superpowers/specs/2026-07-02-protected-minor-dm-restriction-design.md`);
this doc records the web-specific seams and deltas. Security posture review by
dcadenas on the PR before merge.

## Shared decisions (see the mobile spec for full rationale)

- **Approved set = pinned ∩ live NIP-05 (Tier 2, #4948):**
  - Divine HQ `c4a39f1291291d452405cd8ddd798c4a29a3858c52cd0d843f1f6852cf17682e`
    / `_@divinehq.divine.video`, minorContactable
  - Divine Moderation `8fd5eb6d8f362163bc00a5ab6b4a3167dbf32d00ec4efdbcf43b3c9514433b7e`
    / `moderation@divine.video`, minorContactable
- **NIP-05 leg (amended 2026-07-07 after pressure-testing):** graded drop
  signals — different-key resolution drops immediately; affirmative absence
  requires a confirming ~5-minute recheck (a name-server hiccup must not
  mass-revoke support access); network failure keeps last-known state
  (pin-trusted on cold start). 1h TTL for the background/inbound cache, plus
  **send-time freshness**: the async send path awaits a fresh resolution when
  the cache is stale; and **receive-time revalidation**: inbound from a
  stale-cached tier-2 counterparty triggers background re-resolution with the
  filter re-applied on result, so the TTL is a backstop in both directions.
  Per-entry canonical identifier. The mobile spec's
  "Threat model and accepted risks" section (reachability-bounded revocation,
  storage-clear un-revocation, client-side-only inbound enforcement) and its
  pre-merge ops launch checklist (revocation runbook, tier-2 name monitoring,
  two-person-rule decision) apply to web identically — web persists last-known
  leg state in localStorage.
- **Activation:** enforce when `useProtectedMinorStatus` resolves `protected`;
  never-resolved unknown does not enforce; sticky through transient unknowns
  (persist last-known protected, lift only on positive not-protected — web adds
  the localStorage persistence the mobile provider gets from Riverpod `.value`).

## Web-specific findings and deltas

1. **Web DMs are fully implemented** (NIP-17 send + inbox, `src/lib/dm.ts`,
   `useDirectMessages.ts`, `MessagesPage`/`ConversationPage`), so this is a
   full send-block + inbound filter, not a future-surface guard.
2. **`DIVINE_SUPPORT_PUBKEY` (`dm.ts:17`) is the personal key
   `78a5c21b5166dc1474b64ddf7454bf79e6b5d6b4a77148593bf1e866b73c2738`,**
   used by `MessagesPage` for the pinned support conversation. Per #4948
   ("deliberate, role-tagged accounts, not personal keys") this migrates to the
   HQ account as part of this PR: the support-conversation affordance points at
   HQ, and the personal key is not an approved minor-DM recipient.

## Architecture

- **New `src/lib/officialAccounts.ts`:** `OfficialAccount` model +
  `PINNED_OFFICIAL_ACCOUNTS`; `isPinnedMinorContactable(hex)`;
  `resolveNip05(identifier)` against the canonical form;
  `isApprovedMinorDmRecipient(hex)` implementing pin ∩ NIP-05 with the leg
  semantics + localStorage last-known store (1h TTL).
- **New `src/hooks/useApprovedMinorDmRecipients.ts`:** React Query wrapper
  exposing the resolved approved set + a sync predicate for list filtering.

### Enforcement points (seams verified 2026-07-07)

1. **Send gate:** `useDmSend` mutation (`src/hooks/useDirectMessages.ts`
   ~:427-460): when protected, reject recipients failing the predicate with a
   typed error BEFORE `createRecipientGiftWraps` (~:453) — surfaced as inline
   copy in `ConversationPage.handleSend` (~:220). Defense-in-depth: the same
   predicate guard inside `createRecipientGiftWraps` (`src/lib/dm.ts` ~:384)
   behind an options flag.
2. **Inbound filter:** `useDmConversations` (~:316,
   `groupDmConversations(...)`): when protected, drop conversations whose
   counterparty fails the predicate. Sender identity comes from the
   seal-validated `senderPubkey` (`dm.ts` unwrap ~:501, mismatch already
   rejected; message built ~:525).
3. **Affordances:** any profile/message entry points and the `MessagesPage`
   support row (post-migration, points at HQ) — hide compose paths to
   non-approved accounts when protected.

## Tests

Mirror the mobile matrix: officialAccounts unit tests (pin-miss, match,
affirmative-mismatch drop + persistence, network-failure retention, TTL);
useDmSend gate (typed rejection, nothing published); conversation filtering
(inbox + any request-like surface); non-minor unaffected; support-row
migration renders HQ. Follow the existing `dm.ts`/hooks test harnesses.

## Scope

Web this branch/PR. Depends on nothing new — protected-minor state (#456) is
merged and currently unconsumed on this surface. The #453 adult-content lock
lands separately (PR #473). Parent-approved allowlist is #455 [later].

## Corrections after adversarial review (2026-07-07)

Independent adversarial review (verified against code) found web-specific holes;
these supersede conflicting text above.

### C-H3 — thread view needs its own guard (was: only conversation-list filtered)

Enforcement point #2 filtered `useDmConversations` (:310), but the thread renders
through the separate `useDmConversation` (:363) → `useDmMessages` raw cache, which
is unfiltered. `ConversationPage` decodes the peer from the URL, so a protected
minor deep-linking to `/messages/<non-approved-peer>` sees full history. Add a
**thread-route guard** mirroring mobile: when protected and the conversation
counterparty is non-approved, block the thread render (redirect to inbox with a
notice) — not merely hide compose. Also re-apply the approved predicate inside
`useDmConversation`'s result so a revoked counterparty's already-open thread
clears on revalidation.

### C-H2/M2 — `resolveNip05` gets the same discriminated result + limits

`src/lib/officialAccounts.ts` `resolveNip05` returns
`{ matched | differentKey | absent | networkError }` with fetch timeout,
redirect cap, size cap, and lowercase+trim hex normalization (mirrors the mobile
resolver corrections C-H2/M1/M3). The graded drop / fail-open rules attach to
this, and send-time freshness awaits any in-flight resolution rather than
treating concurrency as failure.

### C-L2 — the personal-key migration must sweep ALL sites

`78a5c21b…2738` is referenced in `src/lib/dm.ts`, `src/pages/MessagesPage.tsx`,
`src/pages/Support.tsx`, and `src/pages/ConversationPage.tsx` — not just
MessagesPage. Migrating only one leaves the personal key a reachable compose
target that is not an approved recipient. Sweep all four; the constant should
resolve to the HQ account (or be removed in favor of `PINNED_OFFICIAL_ACCOUNTS`).

### C-M4 — HQ's subdomain is a distinct failure domain the migration depends on

`_@divinehq.divine.video` resolves against the `divinehq.divine.video` origin,
separate from `divine.video`. Since the migration makes HQ the primary support
channel, an unprovisioned/404 `divinehq` well-known reads as affirmative-absence
and (after the 5-min recheck) revokes the primary support channel for every
protected minor. The launch-checklist monitor must probe the `divinehq`
subdomain origin specifically, as its own dependency, before this ships.

## Corrections round 2 — second adversarial review + fail-safe decision (2026-07-07)

### C-B3 — web protected-state fails CLOSED and PERSISTENT (reverses fail-open)

`useProtectedMinorStatus` is `staleTime: 0` + `refetchOnWindowFocus: true` and
its own comment says "self-healing rather than sticky"; `fetchProtectedMinorStatus`
RETURNS `UNKNOWN` on failure (not throws), so React Query stores it as success
and OVERWRITES a prior `protected` on any focus-refetch failure — web fails open
on every window refocus. No localStorage store exists. Required (mirrors mobile
C-B2): persist last-known `protected` to localStorage; on `unknown`, fall back to
the persisted value and never overwrite a `protected` entry with `unknown`; the
safety requirement wins over the hook's "self-healing not sticky" intent for
this tier. Same suppression logic as mobile: the restricted party can force the
failed refetch, so it must fail closed.

### C-S4 — bridge the support-key migration so minors don't lose in-flight threads

Migrating `DIVINE_SUPPORT_PUBKEY` (`78a5c21b…`) to HQ orphans any existing
minor↔`78a5c21b` support conversation: for a protected minor it is filtered out
(not in the approved set) AND the synthetic support row now points at HQ, so the
minor loses the thread and can't receive replies on it. Grandfather `78a5c21b`
as read-allowed for existing threads (or migrate conversation ids), and confirm
HQ's DM inbox is actually staffed before pointing minors at it. Sweep all four
sites (`dm.ts`, `MessagesPage.tsx`, `Support.tsx`, `ConversationPage.tsx`).

### Web metadata leak: none new — unread inherits the filter

`useUnreadDmCount` derives from `useDmConversations`→`groupDmConversations`, the
same seam the filter lands on, so it inherits filtering (unlike mobile's
independent cubit) provided the filter is applied inside/after
`groupDmConversations`.
