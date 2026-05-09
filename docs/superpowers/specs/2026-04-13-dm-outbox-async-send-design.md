# DM Outbox Async Send Design

**Date:** 2026-04-13
**Branch:** `docs/dm-outbox-async-send`

## Problem

The current DM composer blocks on the send mutation. In [src/pages/ConversationPage.tsx](/Users/rabble/code/divine/divine-web/.worktrees/dm-outbox-async-send/src/pages/ConversationPage.tsx:157), `handleSend()` awaits `sendMessage.mutateAsync(...)` before clearing the draft, so users cannot quickly send a message and move on to another conversation.

The current optimistic behavior is also too late. In [src/hooks/useDirectMessages.ts](/Users/rabble/code/divine/divine-web/.worktrees/dm-outbox-async-send/src/hooks/useDirectMessages.ts:229), the outgoing DM is inserted into cache only in `onSuccess`, after the publish step has already completed.

## Goal

Make DM sending feel instant and stay reliable:

1. Clear the composer immediately on send.
2. Show the new DM in the thread immediately with a visible `sending` state.
3. Continue publish work in the background while the user navigates freely.
4. Persist pending and failed sends across route changes and reloads.
5. Keep failed messages visible with retry instead of dropping them.

## Protocol Constraints

This design follows current Nostr DM protocol guidance:

- NIP-17 private messages are unsigned `kind:14` rumors that must be sealed (`kind:13`) and gift-wrapped (`kind:1059`) to each recipient and to the sender individually.
- NIP-17 says clients should publish DM gift wraps to relays listed in recipients' `kind:10050` relay list metadata events.
- NIP-59 gift wraps are transport envelopes, not stable client-side message identities.
- NIP-01 relay `OK` responses indicate whether an event was accepted; `duplicate:` still counts as acceptance.

Because gift wraps are randomized transport envelopes, the persisted outbox should store the plain send intent, not prebuilt wraps.

## Decision

Add a durable local DM outbox and move optimistic rendering to mutation start:

1. Persist a per-user outbox in `localStorage`.
2. Represent pending DMs as client-side messages merged into the DM query cache.
3. Insert the optimistic message in `onMutate`, before publish starts.
4. Regenerate seals and gift wraps on every send or retry attempt.
5. Mark an outbox item `sent` when the publish pipeline succeeds.
6. Mark an outbox item `failed` when publish throws, and keep it visible with retry.
7. Reconcile local outbox items away once the matching relay-fetched DM appears.

## User Experience

When the user presses send:

- The textarea clears immediately.
- Focus remains on the composer so the user can keep typing.
- A new message row appears immediately with a small `Sending…` indicator.
- The user can navigate to another conversation without waiting for network completion.

If background publish succeeds:

- The message remains in place.
- Its transient `Sending…` state disappears.
- Once the real relay-fetched DM is present, the local outbox placeholder is removed.

If background publish fails:

- The message remains visible in the thread.
- It shows a `Failed to send` state plus a retry affordance.
- Retry reuses the same local outbox record so the row updates in place rather than duplicating.

## Architecture

### Outbox Storage

Add a client-side outbox record with:

- `clientId`
- `ownerPubkey`
- `participantPubkeys`
- `content`
- optional `share`
- `createdAt`
- `lastAttemptAt`
- `deliveryState: 'sending' | 'failed' | 'sent'`
- optional `errorMessage`
- `retryCount`

Store records under a per-user key such as `dm:outbox:<ownerPubkey>`.

### DM View Model

Extend the client-side `DmMessage` shape with optional local delivery metadata:

- `clientId?`
- `deliveryState?`
- `errorMessage?`
- `isOptimistic?`

Remote DMs do not need to persist these fields; they are only for local rendering and reconciliation.

### Send Flow

`useDmSend` becomes responsible for:

1. Creating a local outbox item during `onMutate`.
2. Writing it to `localStorage`.
3. Merging the optimistic message into all active DM message caches.
4. Running relay resolution, gift-wrap creation, and publish in the background.
5. Updating the outbox item to `sent` or `failed` afterward.

### Query Merge

`useDmMessages` should merge:

- relay-fetched DMs from `fetchDmMessages()`
- local outbox records for the current user

The merged result is the source of truth for:

- conversation thread rendering
- conversation previews
- unread state calculations

## Reconciliation Rules

Each optimistic record gets a stable `clientId`. Matching between local and fetched DMs should use a conservative fingerprint from:

- sender pubkey
- sorted participant set
- normalized content
- normalized share payload
- near creation time

When a fetched DM matches an outbox record:

- remove the local outbox record
- keep only the real fetched DM in the merged result

Stale `sending` records that survive reload without a matching fetched copy should be demoted to `failed` after a timeout-based hydration check.

## Failure Semantics

DM failure should only reflect the DM publish pipeline itself. Unrelated console noise such as:

- blocked analytics scripts
- unrelated notification `401`s
- relay reconnect noise
- media fetch failures

must not flip a message to failed unless `useDmSend`'s publish promise rejects.

## Scope

In scope:

- Durable local DM outbox
- Immediate composer clear and optimistic thread rendering
- `sending` / `failed` message UI states
- Retry from failed messages
- Outbox persistence across reload and navigation
- Reconciliation between optimistic and fetched messages

Out of scope:

- Cross-device outbox sync
- Guaranteed relay delivery receipts beyond current publish success semantics
- NIP-17 policy tightening for recipients missing `kind:10050`
- Background service worker send retries

## Testing

Add coverage for:

- optimistic insertion before publish resolves
- immediate composer clear
- failure state retention
- retry reusing the same optimistic row
- outbox hydration from `localStorage`
- reconciliation removing the optimistic placeholder when a fetched DM matches

Run focused DM tests first, then `npm run test`.
