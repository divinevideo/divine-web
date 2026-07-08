import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { initializeI18n } from '@/lib/i18n';

import MessagesPage from './MessagesPage';
import type { DmConversation } from '@/lib/dm';
import type { DmInboxStatus } from '@/hooks/useDirectMessages';

const {
  currentUserPubkey,
  otherUserPubkey,
  mockNavigate,
  mockConversations,
  mockAuthorMap,
  mockSearchResults,
  mockInboxStatus,
} = vi.hoisted(() => ({
  currentUserPubkey: 'a'.repeat(64),
  otherUserPubkey: 'c'.repeat(64),
  mockNavigate: vi.fn(),
  mockInboxStatus: { value: 'ok' as DmInboxStatus },
  mockConversations: [
    {
      id: 'conversation-1',
      participantPubkeys: ['b'.repeat(64)],
      unreadCount: 0,
      lastMessage: {
        conversationId: 'conversation-1',
        wrapId: 'wrap-1',
        rumorId: 'rumor-1',
        senderPubkey: 'b'.repeat(64),
        participantPubkeys: ['b'.repeat(64)],
        peerPubkeys: ['b'.repeat(64)],
        content: 'Hello from the inbox',
        createdAt: 1_700_000_000,
        isOutgoing: false,
      },
    },
  ] as DmConversation[],
  mockAuthorMap: {
    // DIVINE_SUPPORT_PUBKEY now resolves to the Moderation pinned key (#176);
    // key the support metadata under it so this exercises real metadata
    // resolution rather than only the hard-coded display-name fallback.
    ['8fd5eb6d8f362163bc00a5ab6b4a3167dbf32d00ec4efdbcf43b3c9514433b7e']: {
      metadata: {
        display_name: 'Divine Support',
        picture: 'https://example.com/support.png',
      },
    },
    ['b'.repeat(64)]: {
      metadata: {
        display_name: 'Inbox Friend',
        picture: 'https://example.com/friend.png',
      },
    },
    ['a'.repeat(64)]: {
      metadata: {
        display_name: 'Rabble',
        name: 'rabble',
        nip05: '_@rabble.divine.video',
      },
    },
    ['c'.repeat(64)]: {
      metadata: {
        display_name: 'Alice',
        name: 'alice',
      },
    },
  },
  mockSearchResults: [] as Array<{
    pubkey: string;
    metadata?: {
      display_name?: string;
      name?: string;
      picture?: string;
      nip05?: string;
    };
  }>,
}));

const pm = vi.hoisted(() => ({
  isProtectedMinor: false,
  approved: new Set<string>(),
}));

vi.mock('@/hooks/useProtectedMinorStatus', () => ({
  useIsProtectedMinor: () => pm.isProtectedMinor,
  useProtectedMinorStatus: () => ({
    state: pm.isProtectedMinor ? 'protected' : 'not_protected',
    isProtectedMinor: pm.isProtectedMinor,
    isKnown: true,
    verifiedMinorAt: null,
  }),
}));

vi.mock('@/lib/officialAccounts', async (orig) => ({
  ...(await orig<typeof import('@/lib/officialAccounts')>()),
  officialAccountsService: {
    isApprovedMinorDmRecipientSync: (pk: string) => pm.approved.has(pk),
    isApprovedMinorDmRecipient: async (pk: string) => pm.approved.has(pk),
    onVerdictChanged: () => () => {},
  },
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({ canUseDirectMessages: true, isCheckingDmCapability: false }),
  useDmConversations: () => ({ data: mockConversations, isLoading: false }),
  useDmInboxStatus: () => mockInboxStatus.value,
  useParsedDmShare: () => null,
}));

vi.mock('@/hooks/useSearchUsers', () => ({
  useSearchUsers: () => ({ data: mockSearchResults, isLoading: false }),
}));

vi.mock('@/hooks/useBatchedAuthors', () => ({
  useBatchedAuthors: () => ({ data: mockAuthorMap }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: currentUserPubkey } }),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/messages']}>
      <MessagesPage />
    </MemoryRouter>
  );
}

describe('MessagesPage', () => {
  beforeEach(async () => {
    pm.isProtectedMinor = false;
    pm.approved.clear();
    mockSearchResults.length = 0;
    mockInboxStatus.value = 'ok';
    mockConversations.length = 0;
    mockConversations.push({
      id: 'conversation-1',
      participantPubkeys: ['b'.repeat(64)],
      unreadCount: 0,
      lastMessage: {
        conversationId: 'conversation-1',
        wrapId: 'wrap-1',
        rumorId: 'rumor-1',
        senderPubkey: 'b'.repeat(64),
        participantPubkeys: ['b'.repeat(64)],
        peerPubkeys: ['b'.repeat(64)],
        content: 'Hello from the inbox',
        createdAt: 1_700_000_000,
        isOutgoing: false,
      },
    });

    const storage = new Map<string, string>();

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });

    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    await initializeI18n({ force: true, languages: ['en-US'] });
  });

  it('renders a localized compose-first header without an inline support action', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /mensajes directos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo mensaje/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /message support/i })).not.toBeInTheDocument();
  });

  it('keeps divine support outside the header card', () => {
    renderPage();

    const headerSection = screen.getByRole('heading', { name: /mensajes directos/i }).closest('section');

    expect(headerSection).not.toBeNull();
    expect(screen.getByText(/divine support/i)).toBeInTheDocument();
    expect(within(headerSection as HTMLElement).queryByText(/divine support/i)).not.toBeInTheDocument();
  });

  it('shows sending state in the conversation preview for optimistic last messages', () => {
    mockConversations[0].lastMessage = {
      ...mockConversations[0].lastMessage,
      content: 'Sending this now',
      isOutgoing: true,
      deliveryState: 'sending',
      isOptimistic: true,
    } as DmConversation['lastMessage'];

    renderPage();

    expect(screen.getByText(/sending\.\.\. sending this now/i)).toBeInTheDocument();
  });

  it('shows failed state in the conversation preview for failed last messages', () => {
    mockConversations[0].lastMessage = {
      ...mockConversations[0].lastMessage,
      content: 'This one failed',
      isOutgoing: true,
      deliveryState: 'failed',
      isOptimistic: true,
    } as DmConversation['lastMessage'];

    renderPage();

    expect(screen.getByText(/failed to send: this one failed/i)).toBeInTheDocument();
  });

  it("renders the inbox-unavailable state when status is 'unavailable' and no conversations are visible", () => {
    mockConversations.length = 0;
    mockInboxStatus.value = 'unavailable';

    renderPage();

    expect(screen.getByText(/inbox temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/no other messages yet/i)).not.toBeInTheDocument();
  });

  it("keeps the empty state when status is 'empty' (no relays returned wraps)", () => {
    mockConversations.length = 0;
    mockInboxStatus.value = 'empty';

    renderPage();

    expect(screen.getByText(/no other messages yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/inbox temporarily unavailable/i)).not.toBeInTheDocument();
  });

  it('filters the current user out of compose search results', async () => {
    const user = userEvent.setup();

    mockSearchResults.push(
      {
        pubkey: currentUserPubkey,
        metadata: {
          display_name: 'Rabble',
          name: 'rabble',
          nip05: '_@rabble.divine.video',
        },
      },
      {
        pubkey: otherUserPubkey,
        metadata: {
          display_name: 'Alice',
          name: 'alice',
        },
      },
    );

    renderPage();

    await user.type(screen.getByRole('textbox'), 'a');

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Rabble')).not.toBeInTheDocument();
  });

  it('filters compose search results to approved accounts for a protected minor (#176)', async () => {
    const user = userEvent.setup();
    const HQ = 'c4a39f1291291d452405cd8ddd798c4a29a3858c52cd0d843f1f6852cf17682e';
    pm.isProtectedMinor = true;
    pm.approved.add(HQ);

    mockSearchResults.push(
      { pubkey: HQ, metadata: { display_name: 'Divine HQ' } },
      { pubkey: otherUserPubkey, metadata: { display_name: 'Alice' } },
    );

    renderPage();
    await user.type(screen.getByRole('textbox'), 'a');

    // Only the approved official is offered as a compose target.
    expect(screen.getByText('Divine HQ')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });
});
