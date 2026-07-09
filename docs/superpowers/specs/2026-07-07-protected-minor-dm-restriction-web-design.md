# Protected-minor DM restriction (web) — design

**Issue:** divine-web#454, web half of support-trust-safety#176 (epic #173).
**Authoritative design + full rationale:** the mobile spec,
`divine-mobile/docs/superpowers/specs/2026-07-02-protected-minor-dm-restriction-design.md`.
This doc is the clean web mirror: it inherits every decision there and records
only the web-specific seams and deltas. Two adversarial reviews (2026-07-07)
folded in.
**Status:** Implemented in this branch (PR #474).

## Inherited from the mobile spec (unchanged on web)

- **Approved set = pinned ∩ live NIP-05 (Tier 2):** Divine HQ
  `c4a39f1291291d452405cd8ddd798c4a29a3858c52cd0d843f1f6852cf17682e` /
  `_@divinehq.divine.video`; Divine Moderation
  `8fd5eb6d8f362163bc00a5ab6b4a3167dbf32d00ec4efdbcf43b3c9514433b7e` /
  `moderation@divine.video`; both `minorContactable`, each pins its own canonical form.
- **Fail-safe: FAIL CLOSED and PERSISTENT.** Enforce on `unknown`/cold-start when
  ever-seen-protected; the restricted party can suppress the check, so it must
  fail closed on suppression; a persistent last-known store relaxes only for
  accounts positively seen `not_protected`. On web every gate consumes the
  tri-state `state` via `isMinorDmRestricted` (`unknown` restricts like
  `protected`); there is no boolean convenience hook for gates to misuse.
- **Graded NIP-05 leg:** different-key drops immediately; absence needs a
  confirming ~5-min recheck; network failure keeps last-known (pin-trusted cold
  start); 1h TTL with send-time freshness + receive-time revalidation as the
  real propagation, TTL a backstop.
- **Threat model & accepted risks** and the **ops launch checklist**
  (repoint-not-removal runbook, tier-2 monitoring incl. the divinehq origin,
  two-person-rule decision) apply identically.

## Web-specific facts

1. Web has a **full** NIP-17 DM implementation (`src/lib/dm.ts`,
   `useDirectMessages.ts`, `MessagesPage`/`ConversationPage`), so this is a real
   send-block + inbound filter, not a future-surface guard.
2. `DIVINE_SUPPORT_PUBKEY` (`dm.ts`) was the **personal key**
   `78a5c21b5166dc1474b64ddf7454bf79e6b5d6b4a77148593bf1e866b73c2738`, referenced
   in `dm.ts`, `MessagesPage.tsx`, `Support.tsx`, and `ConversationPage.tsx`
   (four sites). Per #4948 it migrates to the pinned **Moderation** account
   (`8fd5eb6d…` / `moderation@divine.video`) across **all four** — single-sourced
   via `DIVINE_SUPPORT_PUBKEY = DIVINE_MODERATION_PUBKEY` (`dm.ts`), so the three
   consumer sites pick it up transitively. (Decision: Moderation, not HQ, because
   its DM inbox is staffed for support and it is already in the approved set.)

## Architecture

- **New `src/lib/officialAccounts.ts`:** `OfficialAccount` model +
  `PINNED_OFFICIAL_ACCOUNTS`; `isPinnedMinorContactable(hex)`;
  `resolveNip05(identifier)` returning the discriminated
  `{ matched | differentKey | absent | networkError }` with fetch timeout,
  redirect cap, size cap, and lowercase+trim normalization; `isApprovedMinorDmRecipient(hex)`
  (pin ∩ NIP-05, graded rules, **localStorage** last-known store, 1h TTL,
  send-time freshness that awaits any in-flight resolution rather than treating
  concurrency as failure).
- **New `src/hooks/useApprovedMinorDmRecipients.ts`:** React Query wrapper
  exposing the resolved approved set + a sync predicate.
- **Protected-state persistence:** `useProtectedMinorStatus` today is
  `staleTime:0` + `refetchOnWindowFocus:true` and `fetchProtectedMinorStatus`
  RETURNS `UNKNOWN` on failure, so React Query overwrites a prior `protected` on
  any focus-refetch failure (fails open every refocus). Add a localStorage
  last-known-protected store; on `unknown` fall back to it and never overwrite a
  `protected` entry with `unknown`. Safety wins over the hook's current
  "self-healing not sticky" intent for this tier.

### Enforcement points (seams verified 2026-07-07)

1. **Send gate:** in `useDmSend` (`useDirectMessages.ts`), reject recipients
   failing the predicate with a typed error BEFORE `createRecipientGiftWraps`;
   surfaced inline in `ConversationPage.handleSend`. Two typed errors: a definitive
   `protected` block throws `DmSendBlockedError` (official-accounts-only copy);
   an `unknown`-status block throws `DmSendUnverifiedError` (retriable
   "couldn't verify" copy — the definitive copy would be wrong for an adult
   whose status check merely failed). Defense-in-depth guard inside
   `createRecipientGiftWraps` (`dm.ts:384`) behind an options flag. Group send
   requires all recipients approved. (Web has no durable outgoing queue, so no
   drain re-check needed — the mobile enqueue-before-gate hazard does not apply.)
2. **Inbound filter — list AND thread.** `useDmConversations`
   (`groupDmConversations`) drops non-approved counterparties when
   protected; sender identity is the seal-validated `senderPubkey`
   (`dm.ts:501` rejects seal≠rumor, built `:525`). **The thread view is a
   separate seam:** `useDmConversation` → `useDmMessages` raw cache is
   NOT filtered by the list, so a deep link to `/messages/<non-approved-peer>`
   would show full history. Add a **thread-route guard** (redirect to inbox when
   protected + counterparty non-approved) AND re-apply the predicate inside
   `useDmConversation`'s result so a revoked-mid-session thread clears on
   revalidation. Group inbound requires ALL non-self participants approved.
   Unread count already inherits the filter (`useUnreadDmCount` derives from
   `groupDmConversations`), provided the filter is applied inside/after it.
3. **Support-key migration (orphan risk accepted, no bridge built — decided):**
   repointing `78a5c21b…` → Moderation means any pre-existing minor↔`78a5c21b`
   support thread is filtered out for a protected minor (the peer `78a5c21b` is
   not in the approved set), so the minor would lose visibility of that thread.
   **We accept this and do NOT build a grandfather bridge**, because: (a) the
   protected-minor feature is unshipped, so no protected minor has an existing
   `78a5c21b` thread today; the repoint lands before any protected minor exists,
   so new support threads go to Moderation (approved) from the start; (b) the
   failure is fail-**closed** — an orphaned old thread is hidden, never leaked;
   (c) the only residual case is a user who messaged web "Message Support"
   (→`78a5c21b`) before ship AND later becomes a protected minor, losing an old
   support thread's history — negligible and non-safety. If that case ever
   matters, grandfather `78a5c21b` as read-allowed for inbound display only
   (never send-approved) as a follow-up.
4. **Affordances:** hide compose paths to non-approved accounts when protected;
   the `MessagesPage` support row points at Moderation post-repoint.

## Tests

Mirror the mobile matrix: officialAccounts unit tests (pin-miss, match,
different-key drop+persist, absence-recheck, network retention, TTL, case
normalization); useDmSend gate (typed rejection, nothing published); list +
**thread-view** filtering; group requires all participants; unread inherits;
protected-state persistence (fails closed on unknown, never overwrites protected,
localStorage survives reload); support-row repoint renders the Moderation account
(orphan of old-key threads accepted per §3, no bridge).
Follow the existing `dm.ts`/hooks harnesses.

## Scope

Web this branch/PR. Protected-minor state (#456) is merged and currently
unconsumed here. The #453 adult-content lock is separate (PR #473).
Parent-approved allowlist is #455 [later].
