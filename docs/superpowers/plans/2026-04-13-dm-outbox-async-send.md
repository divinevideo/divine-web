# DM Outbox Async Send Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DM sending instant and durable by clearing the composer immediately, rendering optimistic `sending` rows immediately, persisting pending/failed sends across reloads, and reconciling them against relay-fetched DMs.

**Architecture:** Add a local persisted DM outbox that stores plain send intent per logged-in user, then merge outbox items into the DM query results as client-side messages. Move optimistic insertion from `useDmSend` success time to mutation start, update delivery state on publish completion, and add retry/reconciliation behavior in the DM hook layer so conversation and inbox views stay consistent.

**Tech Stack:** TypeScript, React, React Query, Vitest, Vite, localStorage

---

## Chunk 1: Outbox Data Model and Storage

### Task 1: Add failing tests for the local DM outbox model

**Files:**
- Create: `src/lib/dmOutbox.test.ts`
- Create: `src/lib/dmOutbox.ts`
- Modify: `src/lib/dm.ts`

- [ ] **Step 1: Write the failing tests**

Add tests in `src/lib/dmOutbox.test.ts` that define the storage contract:

```ts
it('writes and reads outbox records per owner pubkey', () => {
  const record = createDmOutboxRecord({
    ownerPubkey: TEST_PUBKEY,
    participantPubkeys: [RECIPIENT_PUBKEY],
    content: 'hello',
  });

  writeDmOutbox(TEST_PUBKEY, [record]);

  expect(readDmOutbox(TEST_PUBKEY)).toEqual([record]);
  expect(readDmOutbox('c'.repeat(64))).toEqual([]);
});

it('updates an existing outbox record by clientId', () => {
  const record = createDmOutboxRecord({
    ownerPubkey: TEST_PUBKEY,
    participantPubkeys: [RECIPIENT_PUBKEY],
    content: 'hello',
  });

  const updated = { ...record, deliveryState: 'failed', errorMessage: 'boom' as const };

  writeDmOutbox(TEST_PUBKEY, [record]);
  upsertDmOutboxRecord(TEST_PUBKEY, updated);

  expect(readDmOutbox(TEST_PUBKEY)).toEqual([updated]);
});

it('demotes stale sending records to failed during hydration', () => {
  const stale = {
    ...createDmOutboxRecord({
      ownerPubkey: TEST_PUBKEY,
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
    }),
    deliveryState: 'sending' as const,
    lastAttemptAt: 1,
  };

  expect(hydrateDmOutbox(TEST_PUBKEY, 3600)).toEqual([
    expect.objectContaining({ deliveryState: 'failed' }),
  ]);
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npx vitest run src/lib/dmOutbox.test.ts`
Expected: FAIL because the outbox module and types do not exist yet.

### Task 2: Implement the minimal outbox storage module

**Files:**
- Create: `src/lib/dmOutbox.ts`
- Create: `src/lib/dmOutbox.test.ts`
- Modify: `src/lib/dm.ts`

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/dmOutbox.ts` with:

```ts
export interface DmOutboxRecord {
  clientId: string;
  ownerPubkey: string;
  participantPubkeys: string[];
  content: string;
  share?: DmSharePayload;
  createdAt: number;
  lastAttemptAt: number;
  deliveryState: 'sending' | 'failed' | 'sent';
  errorMessage?: string;
  retryCount: number;
}

export function createDmOutboxRecord(input: {
  ownerPubkey: string;
  participantPubkeys: string[];
  content: string;
  share?: DmSharePayload;
}): DmOutboxRecord { /* minimal implementation */ }

export function readDmOutbox(ownerPubkey?: string): DmOutboxRecord[] { /* localStorage-backed */ }
export function writeDmOutbox(ownerPubkey: string, records: DmOutboxRecord[]): void { /* localStorage-backed */ }
export function upsertDmOutboxRecord(ownerPubkey: string, record: DmOutboxRecord): DmOutboxRecord[] { /* replace by clientId */ }
export function removeDmOutboxRecord(ownerPubkey: string, clientId: string): DmOutboxRecord[] { /* filter by clientId */ }
export function hydrateDmOutbox(ownerPubkey: string, staleAfterSeconds: number): DmOutboxRecord[] { /* stale sending -> failed */ }
```

Extend `DmMessage` in `src/lib/dm.ts` with optional client-only fields:

```ts
clientId?: string;
deliveryState?: 'sending' | 'failed' | 'sent';
errorMessage?: string;
isOptimistic?: boolean;
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npx vitest run src/lib/dmOutbox.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/dm.ts src/lib/dmOutbox.ts src/lib/dmOutbox.test.ts
git commit -m "Add DM outbox storage model"
```

## Chunk 2: Merge Outbox Records into DM Queries

### Task 3: Add failing tests for merging optimistic outbox messages into DM queries

**Files:**
- Modify: `src/hooks/useDirectMessages.test.ts`
- Modify: `src/hooks/useDirectMessages.ts`
- Modify: `src/lib/dmOutbox.ts`

- [ ] **Step 1: Extend hook tests with merge expectations**

Add tests in `src/hooks/useDirectMessages.test.ts` for:

```ts
it('includes persisted sending outbox messages in the DM message cache', async () => {
  seedDmOutbox(TEST_PUBKEY, [{
    clientId: 'local-1',
    ownerPubkey: TEST_PUBKEY,
    participantPubkeys: [RECIPIENT_PUBKEY],
    content: 'hello',
    createdAt: 1234567890,
    lastAttemptAt: 1234567890,
    deliveryState: 'sending',
    retryCount: 0,
  }]);

  const { result } = renderHook(() => useDmConversation(encodeConversationId([RECIPIENT_PUBKEY])), {
    wrapper: createWrapper(queryClient),
  });

  expect(result.current.data).toEqual([
    expect.objectContaining({
      clientId: 'local-1',
      content: 'hello',
      deliveryState: 'sending',
      isOptimistic: true,
    }),
  ]);
});

it('removes an optimistic outbox row when a matching fetched DM arrives', async () => {
  // seed local outbox record and fetched remote DM with matching fingerprint
  // expect merged result to contain only the fetched DM
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npx vitest run src/hooks/useDirectMessages.test.ts`
Expected: FAIL because the hooks do not yet merge persisted outbox records.

### Task 4: Implement outbox/query merge and reconciliation helpers

**Files:**
- Modify: `src/hooks/useDirectMessages.ts`
- Modify: `src/lib/dm.ts`
- Modify: `src/lib/dmOutbox.ts`
- Modify: `src/hooks/useDirectMessages.test.ts`

- [ ] **Step 3: Add reconciliation helpers**

Add helper logic either in `src/lib/dmOutbox.ts` or `src/lib/dm.ts` for:

```ts
export function buildDmReconciliationFingerprint(input: {
  senderPubkey: string;
  participantPubkeys: string[];
  content: string;
  share?: DmSharePayload;
  createdAt: number;
}): string { /* stable normalized fingerprint */ }

export function convertOutboxRecordToDmMessage(record: DmOutboxRecord): DmMessage { /* optimistic row */ }

export function mergeFetchedAndOutboxMessages(
  fetched: DmMessage[],
  outbox: DmOutboxRecord[],
): { messages: DmMessage[]; reconciledClientIds: string[] } { /* optimistic merge + dedupe */ }
```

- [ ] **Step 4: Wire merge logic into the DM hooks**

Update `useDmMessages()` so it:

- hydrates the local outbox for the current user
- merges fetched messages with outbox messages
- removes reconciled outbox items from storage after a match

Keep the merged list sorted by `createdAt`.

- [ ] **Step 5: Run the focused tests to verify they pass**

Run: `npx vitest run src/hooks/useDirectMessages.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDirectMessages.ts src/hooks/useDirectMessages.test.ts src/lib/dm.ts src/lib/dmOutbox.ts
git commit -m "Merge DM outbox into message queries"
```

## Chunk 3: Make Sending Optimistic at Mutation Start

### Task 5: Add failing tests for immediate optimistic send behavior

**Files:**
- Modify: `src/hooks/useDirectMessages.test.ts`
- Modify: `src/hooks/useDirectMessages.ts`

- [ ] **Step 1: Add tests for onMutate optimism**

Add focused hook tests:

```ts
it('adds an optimistic sending message before publish resolves', async () => {
  let resolvePublish!: () => void;
  mockPublishDmMessages.mockImplementation(() => new Promise<void>((resolve) => {
    resolvePublish = resolve;
  }));

  const { result } = renderHook(() => useDmSend(), { wrapper: createWrapper(queryClient) });

  act(() => {
    result.current.mutate({
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hi support',
    });
  });

  expect(queryClient.getQueryData(['dm', 'messages', TEST_PUBKEY, 300])).toEqual([
    expect.objectContaining({
      content: 'hi support',
      deliveryState: 'sending',
      isOptimistic: true,
    }),
  ]);

  await act(async () => {
    resolvePublish();
  });
});

it('keeps the optimistic row as failed when publish rejects', async () => {
  mockPublishDmMessages.mockRejectedValue(new Error('signal has been aborted'));

  // trigger mutation and assert failed state remains in cache/storage
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npx vitest run src/hooks/useDirectMessages.test.ts`
Expected: FAIL because optimism still happens in `onSuccess`.

### Task 6: Move optimistic insertion to `onMutate` and update delivery state on completion

**Files:**
- Modify: `src/hooks/useDirectMessages.ts`
- Modify: `src/lib/dm.ts`
- Modify: `src/lib/dmOutbox.ts`
- Modify: `src/hooks/useDirectMessages.test.ts`

- [ ] **Step 3: Refactor `useDmSend()` around outbox-first mutation flow**

Change the mutation shape to:

```ts
onMutate: ({ participantPubkeys, content, share }) => {
  const record = createDmOutboxRecord({ ownerPubkey: user.pubkey, participantPubkeys, content, share });
  upsertDmOutboxRecord(user.pubkey, record);
  insertOptimisticDmIntoAllCaches(queryClient, user.pubkey, convertOutboxRecordToDmMessage(record));
  return { clientId: record.clientId };
},
mutationFn: async (...) => {
  const relayUrls = await resolveDmWriteRelays(...);
  const wraps = await createDmGiftWraps(...);
  await publishDmMessages(relayUrls, wraps, AbortSignal.timeout(10000));
  return { relayUrls, wraps };
},
onSuccess: (_, __, context) => markOutboxRecordSent(user.pubkey, context.clientId),
onError: (error, __, context) => markOutboxRecordFailed(user.pubkey, context.clientId, error),
```

Do not remove the optimistic row on failure.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npx vitest run src/hooks/useDirectMessages.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDirectMessages.ts src/hooks/useDirectMessages.test.ts src/lib/dm.ts src/lib/dmOutbox.ts
git commit -m "Make DM sends optimistic and durable"
```

## Chunk 4: Conversation UI for Sending and Retry

### Task 7: Add failing page tests for immediate composer clear and failed retry UI

**Files:**
- Create: `src/pages/ConversationPage.test.tsx`
- Modify: `src/pages/ConversationPage.tsx`

- [ ] **Step 1: Write the failing UI tests**

Create `src/pages/ConversationPage.test.tsx` with cases like:

```ts
it('clears the composer immediately after send is triggered', async () => {
  mockUseDmSendReturn.mutate.mockImplementation(() => undefined);

  renderConversationPage();
  await user.type(screen.getByRole('textbox'), 'hello');
  await user.keyboard('{Enter}');

  expect(screen.getByRole('textbox')).toHaveValue('');
});

it('renders a sending indicator for optimistic messages', () => {
  mockConversationMessages([
    buildTestDm({ clientId: 'local-1', content: 'hello', deliveryState: 'sending', isOptimistic: true }),
  ]);

  renderConversationPage();

  expect(screen.getByText(/sending/i)).toBeInTheDocument();
});

it('renders retry for failed optimistic messages', async () => {
  // seed failed optimistic message and assert retry affordance is visible/clickable
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npx vitest run src/pages/ConversationPage.test.tsx`
Expected: FAIL because the page still awaits the mutation and has no sending/failed UI.

### Task 8: Update the conversation page to use fire-and-forget send UX

**Files:**
- Create: `src/pages/ConversationPage.test.tsx`
- Modify: `src/pages/ConversationPage.tsx`
- Modify: `src/hooks/useDirectMessages.ts`

- [ ] **Step 3: Stop awaiting network completion in the composer**

Update `handleSend()` so it:

- trims and validates the draft
- stores the outgoing text locally
- clears the draft immediately
- calls `sendMessage.mutate(...)` instead of awaiting `mutateAsync(...)`
- preserves share-removal navigation behavior without waiting on publish

- [ ] **Step 4: Render delivery-state UI in `MessageBubble`**

Add small state text below the message timestamp:

```tsx
{message.deliveryState === 'sending' && <span>Sending…</span>}
{message.deliveryState === 'failed' && (
  <>
    <span>Failed to send</span>
    <button onClick={() => retryMessage(message)}>Retry</button>
  </>
)}
```

Implement retry by routing the failed message back through `useDmSend` using its stored `clientId`/outbox record rather than creating a duplicate local item.

- [ ] **Step 5: Run the focused tests to verify they pass**

Run: `npx vitest run src/pages/ConversationPage.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/ConversationPage.tsx src/pages/ConversationPage.test.tsx src/hooks/useDirectMessages.ts
git commit -m "Update DM conversation UI for background sends"
```

## Chunk 5: Inbox Preview and Full Verification

### Task 9: Add failing tests for inbox previews with optimistic DMs

**Files:**
- Modify: `src/pages/MessagesPage.test.tsx`
- Modify: `src/pages/MessagesPage.tsx`

- [ ] **Step 1: Extend inbox tests**

Add a test ensuring a conversation containing an optimistic local DM still renders a correct preview row:

```ts
it('shows optimistic sending or failed messages in the inbox preview', () => {
  // mock conversation query containing a local optimistic last message
  // assert the preview text uses message content and row remains visible
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npx vitest run src/pages/MessagesPage.test.tsx`
Expected: FAIL if preview logic drops or mishandles optimistic DMs.

### Task 10: Finish inbox polish and run full verification

**Files:**
- Modify: `src/pages/MessagesPage.tsx`
- Modify: `src/pages/MessagesPage.test.tsx`
- Modify: `docs/superpowers/specs/2026-04-13-dm-outbox-async-send-design.md`
- Modify: `docs/superpowers/plans/2026-04-13-dm-outbox-async-send.md`
- Modify: `src/hooks/useDirectMessages.ts`
- Modify: `src/lib/dm.ts`
- Modify: `src/lib/dmOutbox.ts`
- Modify: `src/lib/dmOutbox.test.ts`
- Modify: `src/pages/ConversationPage.tsx`
- Modify: `src/pages/ConversationPage.test.tsx`

- [ ] **Step 3: Ensure inbox rows remain correct for optimistic last messages**

Update preview rendering only if needed so `ConversationRow` handles optimistic last messages without special-case regressions.

- [ ] **Step 4: Run the focused inbox tests**

Run: `npx vitest run src/pages/MessagesPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full repository verification suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 6: Commit the full change**

```bash
git add docs/superpowers/specs/2026-04-13-dm-outbox-async-send-design.md \
  docs/superpowers/plans/2026-04-13-dm-outbox-async-send.md \
  src/hooks/useDirectMessages.ts \
  src/hooks/useDirectMessages.test.ts \
  src/lib/dm.ts \
  src/lib/dmOutbox.ts \
  src/lib/dmOutbox.test.ts \
  src/pages/ConversationPage.tsx \
  src/pages/ConversationPage.test.tsx \
  src/pages/MessagesPage.tsx \
  src/pages/MessagesPage.test.tsx
git commit -m "Add durable async DM outbox"
```
