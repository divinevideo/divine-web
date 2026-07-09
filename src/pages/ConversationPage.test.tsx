import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DmMessage } from '@/lib/dm';
import { encodeConversationId } from '@/lib/dm';
import ConversationPage from './ConversationPage';
import { initializeI18n } from '@/lib/i18n';

const RECIPIENT_PUBKEY = 'b'.repeat(64);
const CONVERSATION_ID = encodeConversationId([RECIPIENT_PUBKEY]);

const {
  currentUserPubkey,
  mockAuthorMap,
  directMessageState,
  mockNavigate,
  mockMarkConversationRead,
  mockSendMutate,
  mockSendMutateAsync,
} = vi.hoisted(() => ({
  currentUserPubkey: 'a'.repeat(64),
  directMessageState: {
    messages: [] as DmMessage[],
    latestMessageAt: 0,
    lastReadAt: 0,
    isLoading: false,
    isPending: false,
    share: null as null,
  },
  mockNavigate: vi.fn(),
  mockMarkConversationRead: vi.fn(),
  mockSendMutate: vi.fn(),
  mockSendMutateAsync: vi.fn(),
  mockAuthorMap: {
    ['b'.repeat(64)]: {
      metadata: {
        display_name: 'Inbox Friend',
        name: 'inboxfriend',
        picture: 'https://example.com/friend.png',
      },
    },
  } as Record<string, { metadata: { display_name?: string; name?: string; picture?: string; nip05?: string } }>,
}));

const pm = vi.hoisted(() => ({
  state: 'not_protected' as 'protected' | 'not_protected' | 'unknown',
  approved: new Set<string>(),
}));

vi.mock('@/hooks/useProtectedMinorStatus', () => ({
  useProtectedMinorStatus: () => ({
    state: pm.state,
    isKnown: pm.state !== 'unknown',
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
  useDmConversation: () => ({
    data: directMessageState.messages,
    isLoading: directMessageState.isLoading,
    latestMessageAt: directMessageState.latestMessageAt,
    lastReadAt: directMessageState.lastReadAt,
    markConversationRead: mockMarkConversationRead,
  }),
  useDmSend: () => ({
    mutate: mockSendMutate,
    mutateAsync: mockSendMutateAsync,
    isPending: directMessageState.isPending,
  }),
  useParsedDmShare: () => directMessageState.share,
}));

vi.mock('@/hooks/useBatchedAuthors', () => ({
  useBatchedAuthors: () => ({
    data: mockAuthorMap,
  }),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: currentUserPubkey },
  }),
}));

function buildMessage(overrides: Partial<DmMessage> = {}): DmMessage {
  return {
    conversationId: CONVERSATION_ID,
    wrapId: 'wrap-1',
    rumorId: 'rumor-1',
    senderPubkey: 'a'.repeat(64),
    participantPubkeys: ['a'.repeat(64), RECIPIENT_PUBKEY],
    peerPubkeys: [RECIPIENT_PUBKEY],
    content: 'hello',
    createdAt: 1_234_567_890,
    isOutgoing: true,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/messages/${CONVERSATION_ID}`]}>
      <Routes>
        <Route path="/messages/:conversationId" element={<ConversationPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ConversationPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    pm.state = 'not_protected';
    pm.approved.clear();
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
    await initializeI18n({ force: true, languages: ['en-US'] });
    mockAuthorMap[RECIPIENT_PUBKEY] = {
      metadata: {
        display_name: 'Inbox Friend',
        name: 'inboxfriend',
        picture: 'https://example.com/friend.png',
      },
    };
    directMessageState.messages = [];
    directMessageState.latestMessageAt = 0;
    directMessageState.lastReadAt = 0;
    directMessageState.isLoading = false;
    directMessageState.isPending = false;
    directMessageState.share = null;
    mockSendMutate.mockImplementation(() => undefined);
    mockSendMutateAsync.mockImplementation(() => new Promise<void>(() => undefined));
  });

  describe('protected-minor thread route guard (#176)', () => {
    it('redirects a protected minor away from a non-approved thread', async () => {
      pm.state = 'protected'; // RECIPIENT_PUBKEY not approved
      renderPage();
      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith('/messages', {
          replace: true,
        }),
      );
    });

    it('does NOT redirect when the thread peer is an approved official', async () => {
      pm.state = 'protected';
      pm.approved.add(RECIPIENT_PUBKEY);
      renderPage();
      // let the guard effect run
      await new Promise((r) => setTimeout(r, 20));
      expect(mockNavigate).not.toHaveBeenCalledWith('/messages', {
        replace: true,
      });
    });

    it('does NOT redirect a non-protected user', async () => {
      renderPage();
      await new Promise((r) => setTimeout(r, 20));
      expect(mockNavigate).not.toHaveBeenCalledWith('/messages', {
        replace: true,
      });
    });

    it('fails closed on unknown: redirects away from a non-approved thread', async () => {
      pm.state = 'unknown'; // RECIPIENT_PUBKEY not approved
      renderPage();
      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith('/messages', {
          replace: true,
        }),
      );
    });

    it('does NOT redirect from an approved-official thread while unknown', async () => {
      pm.state = 'unknown';
      pm.approved.add(RECIPIENT_PUBKEY);
      renderPage();
      await new Promise((r) => setTimeout(r, 20));
      expect(mockNavigate).not.toHaveBeenCalledWith('/messages', {
        replace: true,
      });
    });
  });

  it('renders the composer with a two-line baseline', () => {
    renderPage();

    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '2');
  });

  it('clears the composer only after a successful send', async () => {
    const user = userEvent.setup();
    let resolveSend: (() => void) | undefined;

    mockSendMutateAsync.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveSend = resolve;
    }));

    renderPage();

    const composer = screen.getByRole('textbox');

    await user.type(composer, 'hello');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(mockSendMutateAsync).toHaveBeenCalledWith({
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
      share: undefined,
    }));
    expect(composer).toHaveValue('hello');

    resolveSend?.();
    await waitFor(() => expect(composer).toHaveValue(''));
  });

  it('keeps the composer content when send fails', async () => {
    const user = userEvent.setup();

    mockSendMutateAsync.mockRejectedValueOnce(new Error('publish failed'));

    renderPage();

    const composer = screen.getByRole('textbox');

    await user.type(composer, 'hello');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(mockSendMutateAsync).toHaveBeenCalledWith({
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
      share: undefined,
    }));
    expect(composer).toHaveValue('hello');
  });

  it('prefers nip05 in the header subtitle when it is available', () => {
    mockAuthorMap[RECIPIENT_PUBKEY] = {
      metadata: {
        display_name: 'Rabble',
        nip05: '_@rabble.divine.video',
      },
    };

    renderPage();

    expect(screen.getByRole('heading', { name: 'Rabble' })).toBeInTheDocument();
    expect(screen.getByText('@rabble.divine.video')).toBeInTheDocument();
  });

  it('renders a sending indicator for optimistic messages', () => {
    directMessageState.messages = [
      buildMessage({
        clientId: 'local-1',
        deliveryState: 'sending',
        isOptimistic: true,
      }),
    ];

    renderPage();

    expect(screen.getByText(/sending/i)).toBeInTheDocument();
  });

  it('renders retry for failed optimistic messages', async () => {
    const user = userEvent.setup();

    directMessageState.messages = [
      buildMessage({
        clientId: 'local-1',
        content: 'hello again',
        deliveryState: 'failed',
        errorMessage: 'signal has been aborted',
        isOptimistic: true,
      }),
    ];

    renderPage();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(mockSendMutate).toHaveBeenCalledWith({
      clientId: 'local-1',
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello again',
      share: undefined,
    });
  });
});
