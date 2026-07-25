# Support-Only Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Divine Web messaging a single private channel to the pinned Divine Support account, with every non-support thread, unread count, compose path, and send blocked.

**Architecture:** Add a small pure access-policy module keyed to `DIVINE_SUPPORT_PUBKEY`, then enforce it at the send mutation, read hooks, route guard, and compose affordances. Keep the NIP-17 transport and existing support conversation intact; replace the inbox with a compatibility redirect and remove user-to-user entry points.

**Tech Stack:** React 18, TypeScript, React Router 6, TanStack Query, Nostrify/NIP-17, Vitest, Testing Library, Playwright.

---

## File map

- Create `src/lib/dmAccessPolicy.ts`: the single support-only authorization rule, typed error, filters, and canonical support path.
- Create `src/lib/dmAccessPolicy.test.ts`: pure policy matrix.
- Modify `src/hooks/useDirectMessages.ts`: enforce support-only send, list, thread, inbox status, and unread behavior.
- Modify `src/hooks/useDirectMessages.test.ts`: integration coverage for send and hidden history.
- Modify `src/hooks/useDmComposeGuard.ts`: hide every non-support compose affordance.
- Replace `src/pages/MessagesPage.tsx`: redirect the old inbox route to the support thread.
- Replace `src/pages/MessagesPage.test.tsx`: verify the compatibility redirect.
- Modify `src/pages/ConversationPage.tsx`: redirect all non-support and group routes to Support without flashing history.
- Modify `src/pages/ConversationPage.test.tsx`: route-guard and supported-thread coverage.
- Modify `src/components/ProfileHeader.test.tsx`: support-only profile affordance coverage.
- Modify `src/components/AppHeader.tsx` and `src/components/AppHeader.test.tsx`: canonical Support navigation and label.
- Modify `src/components/AppSidebar.tsx` and `src/components/AppSidebar.test.tsx`: canonical Support navigation and label.
- Modify `src/pages/Support.tsx` and `src/pages/Support.test.tsx`: use and verify the canonical Support route.
- Modify `src/components/VideoCard.tsx`: remove private-video DM sharing.
- Modify `src/components/FullscreenVideoItem.tsx`: remove private-video DM sharing.
- Create `tests/support-only-messaging-entry-points.test.ts`: prevent general video-DM entry points from returning.
- Modify `src/pages/FAQPage.tsx` and `src/pages/FAQPage.test.tsx`: describe the current private support channel accurately.

### Task 1: Add the central support-only access policy

**Files:**

- Create: `src/lib/dmAccessPolicy.ts`
- Create: `src/lib/dmAccessPolicy.test.ts`

- [ ] **Step 1: Write the failing pure-policy tests**

Create `src/lib/dmAccessPolicy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { DIVINE_SUPPORT_PUBKEY, type DmConversation, type DmMessage } from '@/lib/dm';
import {
  DmSupportOnlyError,
  assertSupportOnlyDmRecipients,
  filterSupportOnlyDmConversations,
  filterSupportOnlyDmMessages,
  getSupportDmConversationPath,
  isSupportDmRecipient,
  isSupportOnlyDmPeerSet,
} from '@/lib/dmAccessPolicy';

const OTHER_PUBKEY = 'b'.repeat(64);

function message(peerPubkeys: string[]): DmMessage {
  return {
    conversationId: 'conversation',
    wrapId: 'wrap',
    rumorId: 'rumor',
    senderPubkey: OTHER_PUBKEY,
    participantPubkeys: peerPubkeys,
    peerPubkeys,
    content: 'hello',
    createdAt: 1,
    isOutgoing: false,
  };
}

function conversation(id: string, participantPubkeys: string[]): DmConversation {
  return {
    id,
    participantPubkeys,
    lastMessage: message(participantPubkeys),
    unreadCount: 1,
  };
}

describe('support-only DM policy', () => {
  it('allows exactly the single pinned Support recipient', () => {
    expect(isSupportDmRecipient(DIVINE_SUPPORT_PUBKEY)).toBe(true);
    expect(isSupportOnlyDmPeerSet([DIVINE_SUPPORT_PUBKEY])).toBe(true);
  });

  it.each([
    [],
    [OTHER_PUBKEY],
    [DIVINE_SUPPORT_PUBKEY, OTHER_PUBKEY],
  ])('rejects a non-support peer set: %j', (pubkeys) => {
    expect(isSupportOnlyDmPeerSet(pubkeys)).toBe(false);
    expect(() => assertSupportOnlyDmRecipients(pubkeys)).toThrow(DmSupportOnlyError);
  });

  it('filters messages and conversations to Support only', () => {
    expect(filterSupportOnlyDmMessages([
      message([DIVINE_SUPPORT_PUBKEY]),
      message([OTHER_PUBKEY]),
    ])).toHaveLength(1);
    expect(filterSupportOnlyDmConversations([
      conversation('support', [DIVINE_SUPPORT_PUBKEY]),
      conversation('other', [OTHER_PUBKEY]),
    ]).map(({ id }) => id)).toEqual(['support']);
  });

  it('builds the canonical Support conversation path', () => {
    expect(getSupportDmConversationPath()).toMatch(/^\/messages\//);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/lib/dmAccessPolicy.test.ts
```

Expected: FAIL because `@/lib/dmAccessPolicy` does not exist.

- [ ] **Step 3: Implement the minimal pure policy**

Create `src/lib/dmAccessPolicy.ts`:

```ts
import {
  DIVINE_SUPPORT_PUBKEY,
  getDmConversationPath,
  type DmConversation,
  type DmMessage,
} from '@/lib/dm';

export const SUPPORT_ONLY_DM_ERROR_MESSAGE =
  'For now, you can only message Divine Support.';

export class DmSupportOnlyError extends Error {
  constructor() {
    super(SUPPORT_ONLY_DM_ERROR_MESSAGE);
    this.name = 'DmSupportOnlyError';
  }
}

export function isSupportDmRecipient(pubkey: string): boolean {
  return pubkey === DIVINE_SUPPORT_PUBKEY;
}

export function isSupportOnlyDmPeerSet(pubkeys: string[]): boolean {
  return pubkeys.length === 1 && isSupportDmRecipient(pubkeys[0]);
}

export function assertSupportOnlyDmRecipients(recipients: string[]): void {
  if (!isSupportOnlyDmPeerSet(recipients)) {
    throw new DmSupportOnlyError();
  }
}

export function filterSupportOnlyDmMessages(messages: DmMessage[]): DmMessage[] {
  return messages.filter((message) => isSupportOnlyDmPeerSet(message.peerPubkeys));
}

export function filterSupportOnlyDmConversations(
  conversations: DmConversation[],
): DmConversation[] {
  return conversations.filter((conversation) =>
    isSupportOnlyDmPeerSet(conversation.participantPubkeys),
  );
}

export function getSupportDmConversationPath(): string {
  return getDmConversationPath([DIVINE_SUPPORT_PUBKEY]);
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```bash
npx vitest run src/lib/dmAccessPolicy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the policy**

```bash
git add src/lib/dmAccessPolicy.ts src/lib/dmAccessPolicy.test.ts
git commit -m "feat: add support-only messaging policy"
```

### Task 2: Enforce the policy in DM send and read hooks

**Files:**

- Modify: `src/hooks/useDirectMessages.ts`
- Modify: `src/hooks/useDirectMessages.test.ts`

- [ ] **Step 1: Point existing successful hook tests at Support**

In `src/hooks/useDirectMessages.test.ts`, import the pinned key and introduce a separate blocked peer:

```ts
import { DIVINE_SUPPORT_PUBKEY, encodeConversationId } from '@/lib/dm';
import { DmSupportOnlyError } from '@/lib/dmAccessPolicy';

const TEST_PUBKEY = 'a'.repeat(64);
const RECIPIENT_PUBKEY = DIVINE_SUPPORT_PUBKEY;
const NON_SUPPORT_PUBKEY = 'b'.repeat(64);
```

Update protected-minor tests so successful Support sends add
`DIVINE_SUPPORT_PUBKEY` to `pm.approved`. Tests specifically exercising the
minor restriction may use `NON_SUPPORT_PUBKEY`, but group sends must now expect
`DmSupportOnlyError` because the global product policy runs first.

- [ ] **Step 2: Add failing send and visibility integration tests**

Add these tests inside `describe('useDirectMessages', ...)`:

```ts
it('rejects a non-support send before relay resolution or publication', async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const { result } = renderHook(() => useDmSend(), {
    wrapper: createWrapper(queryClient),
  });

  await expect(result.current.mutateAsync({
    participantPubkeys: [NON_SUPPORT_PUBKEY],
    content: 'hello',
  })).rejects.toThrow(DmSupportOnlyError);

  expect(mockResolveDmWriteRelays).not.toHaveBeenCalled();
  expect(mockCreateRecipientGiftWraps).not.toHaveBeenCalled();
  expect(mockPublishDmMessages).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Message not sent',
    description: 'For now, you can only message Divine Support.',
  }));
});

it('hides non-support conversations while keeping the Support conversation', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);
  writeDmOutbox(TEST_PUBKEY, [
    {
      clientId: 'support',
      ownerPubkey: TEST_PUBKEY,
      participantPubkeys: [DIVINE_SUPPORT_PUBKEY],
      content: 'support',
      createdAt: 1_234_567_890,
      lastAttemptAt: 1_234_567_890,
      deliveryState: 'sending',
      retryCount: 0,
    },
    {
      clientId: 'other',
      ownerPubkey: TEST_PUBKEY,
      participantPubkeys: [NON_SUPPORT_PUBKEY],
      content: 'other',
      createdAt: 1_234_567_891,
      lastAttemptAt: 1_234_567_891,
      deliveryState: 'sending',
      retryCount: 0,
    },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { result } = renderHook(() => useDmConversations(), {
    wrapper: createWrapper(queryClient),
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.map(({ participantPubkeys }) => participantPubkeys))
    .toEqual([[DIVINE_SUPPORT_PUBKEY]]);
});

it('returns no history for a non-support thread', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1_234_567_890_000);
  writeDmOutbox(TEST_PUBKEY, [{
    clientId: 'other',
    ownerPubkey: TEST_PUBKEY,
    participantPubkeys: [NON_SUPPORT_PUBKEY],
    content: 'hidden history',
    createdAt: 1_234_567_890,
    lastAttemptAt: 1_234_567_890,
    deliveryState: 'sending',
    retryCount: 0,
  }]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { result } = renderHook(
    () => useDmConversation(encodeConversationId([NON_SUPPORT_PUBKEY])),
    { wrapper: createWrapper(queryClient) },
  );

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual([]);
});
```

Add `useUnreadDmCount` to the hook imports and add:

```ts
it('counts unread messages from Support only', async () => {
  mockFetchDmMessages.mockResolvedValue({
    messages: [
      {
        conversationId: encodeConversationId([DIVINE_SUPPORT_PUBKEY]),
        wrapId: 'support-wrap',
        rumorId: 'support-rumor',
        senderPubkey: DIVINE_SUPPORT_PUBKEY,
        participantPubkeys: [TEST_PUBKEY, DIVINE_SUPPORT_PUBKEY].sort(),
        peerPubkeys: [DIVINE_SUPPORT_PUBKEY],
        content: 'support reply',
        createdAt: 1_234_567_890,
        isOutgoing: false,
      },
      {
        conversationId: encodeConversationId([NON_SUPPORT_PUBKEY]),
        wrapId: 'other-wrap',
        rumorId: 'other-rumor',
        senderPubkey: NON_SUPPORT_PUBKEY,
        participantPubkeys: [TEST_PUBKEY, NON_SUPPORT_PUBKEY].sort(),
        peerPubkeys: [NON_SUPPORT_PUBKEY],
        content: 'hidden reply',
        createdAt: 1_234_567_891,
        isOutgoing: false,
      },
    ],
    fetchedCount: 2,
    decryptFailures: 0,
    malformedCount: 0,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { result } = renderHook(() => useUnreadDmCount(), {
    wrapper: createWrapper(queryClient),
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toBe(1);
});
```

- [ ] **Step 3: Run focused hooks tests and verify RED**

Run:

```bash
npx vitest run src/hooks/useDirectMessages.test.ts
```

Expected: FAIL because non-support sends publish and non-support messages remain
visible.

- [ ] **Step 4: Wire the policy into `useDirectMessages.ts`**

Import:

```ts
import {
  DmSupportOnlyError,
  assertSupportOnlyDmRecipients,
  filterSupportOnlyDmConversations,
  filterSupportOnlyDmMessages,
  isSupportOnlyDmPeerSet,
} from '@/lib/dmAccessPolicy';
import { decodeConversationId } from '@/lib/dm';
```

After recipient normalization and the existing empty-recipient check in
`useDmSend.mutationFn`, enforce the global policy before minor verification:

```ts
assertSupportOnlyDmRecipients(recipients);

await assertMinorDmRecipientsAllowed(recipients, {
  state: minorState,
  service: officialAccountsService,
});
```

In `onError`, give the typed global error factual copy:

```ts
const isSupportOnly = error instanceof DmSupportOnlyError;
const isBlocked = error instanceof DmSendBlockedError;
const isUnverified = error instanceof DmSendUnverifiedError;
const description = isSupportOnly
  ? error.message
  : isBlocked
    ? 'You can only message official Divine accounts.'
    : isUnverified
      ? "We couldn't verify your account just now. Try again in a minute."
      : error instanceof Error
        ? error.message
        : 'Unable to send your message right now';

toast({
  title: isSupportOnly || isBlocked || isUnverified
    ? 'Message not sent'
    : 'Message failed',
  description,
  variant: 'destructive',
});
```

After the protected-minor list filter, apply the global list filter:

```ts
const conversations = filterSupportOnlyDmConversations(
  filterProtectedMinorConversations(grouped, {
    state: minorState,
    isApproved: (pubkey) =>
      officialAccountsService.isApprovedMinorDmRecipientSync(pubkey),
  }),
);
```

Make inbox status use only visible messages:

```ts
if (filterSupportOnlyDmMessages(data.messages).length > 0) return 'ok';
```

In `useDmConversation`, decode the route peers and require the Support-only
policy before returning history:

```ts
const routePeerPubkeys = useMemo(
  () => decodeConversationId(conversationId || ''),
  [conversationId],
);
const allowedForMinor = isThreadAllowedForProtectedMinor(routePeerPubkeys, {
  state: minorState,
  isApproved: (pubkey) =>
    officialAccountsService.isApprovedMinorDmRecipientSync(pubkey),
});
const messages =
  isSupportOnlyDmPeerSet(routePeerPubkeys) && allowedForMinor
    ? threadMessages
    : [];
```

Use `routePeerPubkeys` for the existing protected-minor revalidation loop.

- [ ] **Step 5: Run hook tests and verify GREEN**

Run:

```bash
npx vitest run src/hooks/useDirectMessages.test.ts src/lib/dmAccessPolicy.test.ts
```

Expected: PASS with no unexpected console output.

- [ ] **Step 6: Commit hook enforcement**

```bash
git add src/hooks/useDirectMessages.ts src/hooks/useDirectMessages.test.ts
git commit -m "feat: enforce support-only DM access"
```

### Task 3: Turn messaging routes into one Support channel

**Files:**

- Replace: `src/pages/MessagesPage.tsx`
- Replace: `src/pages/MessagesPage.test.tsx`
- Modify: `src/pages/ConversationPage.tsx`
- Modify: `src/pages/ConversationPage.test.tsx`

- [ ] **Step 1: Rewrite the inbox test as a failing Support redirect test**

Replace `src/pages/MessagesPage.test.tsx` with:

```tsx
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { getSupportDmConversationPath } from '@/lib/dmAccessPolicy';
import MessagesPage from './MessagesPage';

const mockNavigate = vi.fn();

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

describe('MessagesPage', () => {
  it('redirects the compatibility inbox route to Divine Support', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/messages']}>
        <MessagesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        getSupportDmConversationPath(),
        { replace: true },
      );
    });
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Add failing conversation route tests**

Set the normal `RECIPIENT_PUBKEY` in `ConversationPage.test.tsx` to
`DIVINE_SUPPORT_PUBKEY`. Add `NON_SUPPORT_PUBKEY = 'b'.repeat(64)` and a
`renderConversation(pubkey)` helper.

Replace the obsolete protected-minor route-guard describe block with:

```tsx
describe('support-only thread route guard', () => {
  it('keeps the Divine Support thread open', async () => {
    renderConversation(DIVINE_SUPPORT_PUBKEY);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockNavigate).not.toHaveBeenCalledWith(
      getSupportDmConversationPath(),
      { replace: true },
    );
  });

  it('redirects a non-support deep link without showing its history', async () => {
    directMessageState.messages = [buildMessage({
      peerPubkeys: [NON_SUPPORT_PUBKEY],
      content: 'must stay hidden',
    })];
    renderConversation(NON_SUPPORT_PUBKEY);

    expect(screen.queryByText('must stay hidden')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        getSupportDmConversationPath(),
        { replace: true },
      );
    });
  });

  it('redirects a group conversation to Support', async () => {
    renderConversation([DIVINE_SUPPORT_PUBKEY, NON_SUPPORT_PUBKEY]);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        getSupportDmConversationPath(),
        { replace: true },
      );
    });
  });
});
```

Replace the current `renderPage` helper with:

```tsx
function renderConversation(peers: string | string[]) {
  const peerPubkeys = Array.isArray(peers) ? peers : [peers];
  const conversationId = encodeConversationId(peerPubkeys);

  return render(
    <MemoryRouter initialEntries={[`/messages/${conversationId}`]}>
      <Routes>
        <Route path="/messages/:conversationId" element={<ConversationPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderPage() {
  return renderConversation(RECIPIENT_PUBKEY);
}
```

- [ ] **Step 3: Run page tests and verify RED**

Run:

```bash
npx vitest run src/pages/MessagesPage.test.tsx src/pages/ConversationPage.test.tsx
```

Expected: FAIL because `/messages` still renders an inbox and non-support
conversation routes are still allowed for adults.

- [ ] **Step 4: Replace `MessagesPage` with the compatibility redirect**

Replace `src/pages/MessagesPage.tsx` with:

```tsx
import { useEffect } from 'react';

import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { getSupportDmConversationPath } from '@/lib/dmAccessPolicy';

export function MessagesPage() {
  const navigate = useSubdomainNavigate();

  useEffect(() => {
    navigate(getSupportDmConversationPath(), { replace: true });
  }, [navigate]);

  return null;
}

export default MessagesPage;
```

- [ ] **Step 5: Replace the page-level minor route guard with the global route guard**

In `ConversationPage.tsx`, remove the page-only imports and state for
`useProtectedMinorStatus`, `isMinorDmRestricted`,
`officialAccountsService`, and `useReducer`. The minor send and read gates stay
in `useDirectMessages.ts`.

Import:

```ts
import {
  getSupportDmConversationPath,
  isSupportOnlyDmPeerSet,
} from '@/lib/dmAccessPolicy';
```

Add:

```ts
const threadBlocked = !isSupportOnlyDmPeerSet(peerPubkeys);

useEffect(() => {
  if (threadBlocked) {
    navigate(getSupportDmConversationPath(), { replace: true });
  }
}, [navigate, threadBlocked]);
```

After all hooks and before rendering any route content, prevent a blocked
thread from flashing:

```tsx
if (threadBlocked) {
  return null;
}
```

- [ ] **Step 6: Run route tests and verify GREEN**

Run:

```bash
npx vitest run src/pages/MessagesPage.test.tsx src/pages/ConversationPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit routing**

```bash
git add src/pages/MessagesPage.tsx src/pages/MessagesPage.test.tsx \
  src/pages/ConversationPage.tsx src/pages/ConversationPage.test.tsx
git commit -m "feat: route messaging to Divine Support"
```

### Task 4: Restrict compose affordances and Support navigation

**Files:**

- Modify: `src/hooks/useDmComposeGuard.ts`
- Modify: `src/components/ProfileHeader.test.tsx`
- Modify: `src/components/AppHeader.tsx`
- Modify: `src/components/AppHeader.test.tsx`
- Modify: `src/components/AppSidebar.tsx`
- Modify: `src/components/AppSidebar.test.tsx`
- Modify: `src/pages/Support.tsx`
- Modify: `src/pages/Support.test.tsx`

- [ ] **Step 1: Change profile tests to require the Support pubkey**

In `ProfileHeader.test.tsx`, import `DIVINE_SUPPORT_PUBKEY`. Replace the adult
test that expects Message on an arbitrary profile with:

```tsx
it('hides the Message button on a non-support profile for every user', () => {
  pm.canUseDirectMessages = true;
  renderFor('a'.repeat(64));
  expect(screen.queryByRole('button', { name: /message/i }))
    .not.toBeInTheDocument();
});

it('shows the Message button on the Divine Support profile', () => {
  pm.canUseDirectMessages = true;
  renderFor(DIVINE_SUPPORT_PUBKEY);
  expect(screen.getByRole('button', { name: /message/i }))
    .toBeInTheDocument();
});
```

Keep protected-minor tests, but use `DIVINE_SUPPORT_PUBKEY` as the approved
official where a Message button is expected.

- [ ] **Step 2: Add failing header, sidebar, and Support-page navigation tests**

In `AppHeader.test.tsx`, extend the existing hoisted values:

```ts
import { getSupportDmConversationPath } from '@/lib/dmAccessPolicy';

const { mockNavigate, mockSetTheme, shell } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSetTheme: vi.fn(),
  shell: {
    user: null as { pubkey: string } | null,
    canUseDirectMessages: false,
  },
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: shell.user }),
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({
    canUseDirectMessages: shell.canUseDirectMessages,
  }),
  useUnreadDmCount: () => ({ data: 0 }),
}));
```

Reset both `shell` fields in `beforeEach`.

In `AppHeader.test.tsx`, add:

```tsx
it('labels and opens the canonical Support conversation', async () => {
  shell.user = { pubkey: 'a'.repeat(64) };
  shell.canUseDirectMessages = true;
  render(
    <MemoryRouter>
      <AppHeader />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Mensaje al soporte' }));
  expect(mockNavigate).toHaveBeenCalledWith(getSupportDmConversationPath());
});
```

In `AppSidebar.test.tsx`, add an independent mutable shell:

```ts
import { getSupportDmConversationPath } from '@/lib/dmAccessPolicy';

const { mockNavigate, mockSetTheme, mockCategories, shell } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSetTheme: vi.fn(),
  mockCategories: [] as CategoryWithConfig[],
  shell: {
    user: null as { pubkey: string } | null,
    canUseDirectMessages: false,
  },
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: shell.user }),
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({
    canUseDirectMessages: shell.canUseDirectMessages,
  }),
  useUnreadDmCount: () => ({ data: 0 }),
}));
```

Reset the shell in `beforeEach`, then add:

```tsx
it('labels and opens the canonical Support conversation', () => {
  shell.user = { pubkey: 'a'.repeat(64) };
  shell.canUseDirectMessages = true;
  render(
    <MemoryRouter>
      <AppSidebar />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Mensaje al soporte' }));
  expect(mockNavigate).toHaveBeenCalledWith(getSupportDmConversationPath());
});
```

In `Support.test.tsx`, add:

```ts
import { fireEvent } from '@testing-library/react';

import { getSupportDmConversationPath } from '@/lib/dmAccessPolicy';

const supportState = vi.hoisted(() => ({
  user: null as { pubkey: string } | null,
  canUseDirectMessages: false,
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: supportState.user }),
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({
    canUseDirectMessages: supportState.canUseDirectMessages,
  }),
}));
```

Reset `supportState` in `beforeEach`. Then render a signed-in, DM-capable user,
click `Abrir chat de soporte`, and assert:

```tsx
it('opens the canonical Support conversation', () => {
  supportState.user = { pubkey: 'a'.repeat(64) };
  supportState.canUseDirectMessages = true;
  render(
    <MemoryRouter>
      <Support />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Abrir chat de soporte' }));
  expect(mockNavigate).toHaveBeenCalledWith(getSupportDmConversationPath());
});
```

- [ ] **Step 3: Run affordance tests and verify RED**

Run:

```bash
npx vitest run src/components/ProfileHeader.test.tsx \
  src/components/AppHeader.test.tsx \
  src/components/AppSidebar.test.tsx \
  src/pages/Support.test.tsx
```

Expected: FAIL because arbitrary profiles still expose Message and navigation
still says Messages and targets `/messages`.

- [ ] **Step 4: Apply the central policy in the compose guard**

In `useDmComposeGuard.ts`, import `isSupportDmRecipient` and start the returned
predicate with:

```ts
const isComposeBlocked = (pubkey: string): boolean => {
  if (!isSupportDmRecipient(pubkey)) {
    return true;
  }

  if (isMinorDmRestricted(state)) {
    void officialAccountsService.isApprovedMinorDmRecipient(pubkey);
  }

  return isDmComposeBlockedForMinor(pubkey, {
    state,
    isApproved: (candidate) =>
      officialAccountsService.isApprovedMinorDmRecipientSync(candidate),
  });
};
```

Update its module comments to describe the global Support-only rule plus
protected-minor defense in depth.

- [ ] **Step 5: Point navigation directly at Support with localized copy**

In `AppHeader.tsx` and `AppSidebar.tsx`, import
`getSupportDmConversationPath`, change the click target to:

```tsx
onClick={() => navigate(getSupportDmConversationPath())}
```

Use the already-translated key:

```tsx
t('support.messageSupportTitle')
```

for the header `aria-label` and sidebar label. Keep the existing badge; its
count is now Support-only through Task 2.

In `Support.tsx`, replace the direct `DIVINE_SUPPORT_PUBKEY` path construction
with:

```tsx
<Button onClick={() => navigate(getSupportDmConversationPath())}>
  {t('support.messageSupportCta')}
</Button>
```

- [ ] **Step 6: Run affordance tests and verify GREEN**

Run:

```bash
npx vitest run src/components/ProfileHeader.test.tsx \
  src/components/AppHeader.test.tsx \
  src/components/AppSidebar.test.tsx \
  src/pages/Support.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit entry-point restrictions**

```bash
git add src/hooks/useDmComposeGuard.ts \
  src/components/ProfileHeader.test.tsx \
  src/components/AppHeader.tsx src/components/AppHeader.test.tsx \
  src/components/AppSidebar.tsx src/components/AppSidebar.test.tsx \
  src/pages/Support.tsx src/pages/Support.test.tsx
git commit -m "feat: expose only Message Support entry points"
```

### Task 5: Remove private video DMs and correct FAQ copy

**Files:**

- Modify: `src/components/VideoCard.tsx`
- Modify: `src/components/FullscreenVideoItem.tsx`
- Create: `tests/support-only-messaging-entry-points.test.ts`
- Modify: `src/pages/FAQPage.tsx`
- Modify: `src/pages/FAQPage.test.tsx`

- [ ] **Step 1: Write a failing static guard for video DM entry points**

Create `tests/support-only-messaging-entry-points.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const VIDEO_SURFACES = [
  'src/components/VideoCard.tsx',
  'src/components/FullscreenVideoItem.tsx',
];

describe('support-only messaging entry points', () => {
  it.each(VIDEO_SURFACES)('%s does not offer private video DMs', (file) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8');

    expect(source).not.toContain('sendViaMessage');
    expect(source).not.toContain('buildDmShareQueryString');
    expect(source).not.toContain('buildDmSharePayloadFromVideo');
  });
});
```

- [ ] **Step 2: Add a failing FAQ behavior test**

In `FAQPage.test.tsx`, add:

```tsx
it('describes the current private channel as Support-only', () => {
  render(
    <MemoryRouter>
      <FAQPage />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: /can i block users\?/i }));

  expect(screen.getByText('Private support messages')).toBeInTheDocument();
  expect(screen.getByText(/current private messaging channel is for contacting Divine Support/i))
    .toBeInTheDocument();
  expect(screen.queryByText(/direct messages between users/i))
    .not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run the tests and verify RED**

Run:

```bash
npx vitest run tests/support-only-messaging-entry-points.test.ts \
  src/pages/FAQPage.test.tsx
```

Expected: FAIL because both video components still include the general DM
action and the FAQ still describes user-to-user DMs.

- [ ] **Step 4: Remove video-DM actions**

In both video components:

- remove the `useDmCapability` import and call when it has no remaining use;
- remove `buildDmSharePayloadFromVideo` and `buildDmShareQueryString` imports;
- remove `handleShareViaDm` from `VideoCard.tsx`;
- remove the conditional menu item using `videoCard.menu.sendViaMessage`;
- remove the conditional menu item using
  `fullscreenVideoItem.sendViaMessage`.

Keep each component's `MessageCircle` icon import because it is also the
comments action.

The relevant menu sequence in `VideoCard.tsx` should become:

```tsx
<DropdownMenuItem onClick={() => setShowReportDialog(true)}>
  <Flag className="h-4 w-4 mr-2" />
  {t('videoCard.menu.reportVideo')}
</DropdownMenuItem>
<DropdownMenuItem onClick={() => setShowReportUserDialog(true)}>
  <Flag className="h-4 w-4 mr-2" />
  {t('videoCard.menu.reportUser')}
</DropdownMenuItem>
```

The fullscreen menu should become:

```tsx
<DropdownMenuItem
  onClick={() => setShowReportDialog(true)}
  className="focus:bg-white/10"
>
  <Flag className="h-4 w-4 mr-2" />
  {t('fullscreenVideoItem.reportVideo')}
</DropdownMenuItem>
<DropdownMenuItem
  onClick={() => setShowReportUserDialog(true)}
  className="focus:bg-white/10"
>
  <Flag className="h-4 w-4 mr-2" />
  {t('fullscreenVideoItem.reportUser')}
</DropdownMenuItem>
```

Confirm the removal is complete before moving on:

```bash
rg -n "sendViaMessage|buildDmShare(QueryString|PayloadFromVideo)|canUseDirectMessages" \
  src/components/VideoCard.tsx src/components/FullscreenVideoItem.tsx
```

Expected: no matches for the removed DM capability or sharing paths.

- [ ] **Step 5: Replace the inaccurate FAQ section**

In `FAQPage.tsx`, replace the “Direct messages ARE private” heading and its
paragraph with:

```tsx
<p className="font-semibold">
  Private support messages
</p>
<p>
  Divine's current private messaging channel is for contacting Divine Support.
  Messages use encrypted NIP-17 delivery, and the support team can read and
  respond to messages sent to that channel. User-to-user DMs and private video
  sharing are not available in Divine right now.
</p>
```

- [ ] **Step 6: Run the tests and verify GREEN**

Run:

```bash
npx vitest run tests/support-only-messaging-entry-points.test.ts \
  src/pages/FAQPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit surface cleanup**

```bash
git add src/components/VideoCard.tsx \
  src/components/FullscreenVideoItem.tsx \
  tests/support-only-messaging-entry-points.test.ts \
  src/pages/FAQPage.tsx src/pages/FAQPage.test.tsx
git commit -m "feat: remove general DM surfaces"
```

### Task 6: Verify the complete behavior

**Files:**

- Verify only; do not change unrelated files.

- [ ] **Step 1: Run all focused messaging and affected-surface tests**

```bash
npx vitest run \
  src/lib/dmAccessPolicy.test.ts \
  src/hooks/useDirectMessages.test.ts \
  src/pages/MessagesPage.test.tsx \
  src/pages/ConversationPage.test.tsx \
  src/components/ProfileHeader.test.tsx \
  src/components/AppHeader.test.tsx \
  src/components/AppSidebar.test.tsx \
  src/pages/Support.test.tsx \
  src/pages/FAQPage.test.tsx \
  tests/support-only-messaging-entry-points.test.ts
```

Expected: all listed files PASS.

- [ ] **Step 2: Run the full project gate**

```bash
npm run test
```

Expected: TypeScript, ESLint, all Vitest tests, and the production Vite build
PASS.

- [ ] **Step 3: Run browser-level visual verification**

Start the app:

```bash
npm run dev
```

With a DM-capable test login, verify at desktop and mobile widths:

1. App navigation says Message Support and opens the Support thread.
2. `/messages` replaces itself with the canonical Support conversation URL.
3. A non-support `/messages/:conversationId` URL replaces itself with Support
   and never renders the other participant's content.
4. A regular profile has no Message button; the Support profile does.
5. Video menus contain no Send via message action.
6. Only Support unread messages affect the badge.

Capture screenshots of the desktop navigation and Support conversation for the
handoff. Stop the dev server after verification.

- [ ] **Step 4: Inspect the final diff and worktree**

```bash
git diff --check
git status --short
git log --oneline -8
```

Expected: no whitespace errors; only the user's pre-existing untracked images
remain outside the committed feature work.
