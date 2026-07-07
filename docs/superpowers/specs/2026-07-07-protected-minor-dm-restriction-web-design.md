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
- **NIP-05 leg:** fail open on network failure, fail closed on affirmative
  mismatch; 1h TTL; per-entry canonical identifier.
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
