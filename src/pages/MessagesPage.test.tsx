import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/config';
import { initializeI18n } from '@/lib/i18n';

import MessagesPage from './MessagesPage';
import type { DmConversation } from '@/lib/dm';

const {
  currentUserPubkey,
  otherUserPubkey,
  mockNavigate,
  mockConversations,
  mockAuthorMap,
  mockSearchResults,
} = vi.hoisted(() => ({
  currentUserPubkey: 'a'.repeat(64),
  otherUserPubkey: 'c'.repeat(64),
  mockNavigate: vi.fn(),
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
    ['78a5c21b5166dc1474b64ddf7454bf79e6b5d6b4a77148593bf1e866b73c2738']: {
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

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({ canUseDirectMessages: true }),
  useDmConversations: () => ({ data: mockConversations, isLoading: false }),
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
    mockSearchResults.length = 0;
    mockConversations[0].lastMessage = {
      conversationId: 'conversation-1',
      wrapId: 'wrap-1',
      rumorId: 'rumor-1',
      senderPubkey: 'b'.repeat(64),
      participantPubkeys: ['b'.repeat(64)],
      peerPubkeys: ['b'.repeat(64)],
      content: 'Hello from the inbox',
      createdAt: 1_700_000_000,
      isOutgoing: false,
    };

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
});
