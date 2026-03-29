import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import MessagesPage from './MessagesPage';
import type { DmConversation } from '@/lib/dm';

const { mockNavigate, mockConversations, mockAuthorMap } = vi.hoisted(() => ({
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
  ] satisfies DmConversation[],
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
  },
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({ canUseDirectMessages: true }),
  useDmConversations: () => ({ data: mockConversations, isLoading: false }),
  useParsedDmShare: () => null,
}));

vi.mock('@/hooks/useSearchUsers', () => ({
  useSearchUsers: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/useBatchedAuthors', () => ({
  useBatchedAuthors: () => ({ data: mockAuthorMap }),
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
  it('renders a compose-first header without an inline support action', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /direct messages/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new message/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /message support/i })).not.toBeInTheDocument();
  });

  it('keeps divine support outside the header card', () => {
    renderPage();

    const headerSection = screen.getByRole('heading', { name: /direct messages/i }).closest('section');

    expect(headerSection).not.toBeNull();
    expect(screen.getByText(/divine support/i)).toBeInTheDocument();
    expect(within(headerSection as HTMLElement).queryByText(/divine support/i)).not.toBeInTheDocument();
  });
});
