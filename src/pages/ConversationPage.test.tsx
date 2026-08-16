import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  decodeConversationId,
  DIVINE_SUPPORT_PUBKEY,
  encodeConversationId,
  type DmMessage,
} from '@/lib/dm';
import { getSupportDmConversationPath } from '@/lib/dmAccessPolicy';
import { initializeI18n } from '@/lib/i18n';
import ConversationPage from './ConversationPage';

const RECIPIENT_PUBKEY = DIVINE_SUPPORT_PUBKEY;
const CONVERSATION_ID = encodeConversationId([RECIPIENT_PUBKEY]);
const NON_SUPPORT_PUBKEY = 'b'.repeat(64);

const {
  currentUserPubkey,
  dmCapabilityState,
  mockAuthorMap,
  directMessageState,
  mockNavigate,
  mockMarkConversationRead,
  mockSendMutate,
  mockSendMutateAsync,
  protectedMinorState,
  approvedMinorPubkeys,
  mockRevalidateMinorRecipient,
} = vi.hoisted(() => ({
  currentUserPubkey: 'a'.repeat(64),
  protectedMinorState: {
    value: 'not_protected' as 'not_protected' | 'protected' | 'unknown',
  },
  approvedMinorPubkeys: new Set<string>(),
  mockRevalidateMinorRecipient: vi.fn(),
  dmCapabilityState: {
    canUseDirectMessages: true,
    isCheckingDmCapability: false,
  },
  directMessageState: {
    messages: [] as DmMessage[],
    latestMessageAt: 0,
    lastReadAt: 0,
    isLoading: false,
    isPending: false,
  },
  mockNavigate: vi.fn(),
  mockMarkConversationRead: vi.fn(),
  mockSendMutate: vi.fn(),
  mockSendMutateAsync: vi.fn(),
  mockAuthorMap: {} as Record<string, {
    metadata: {
      display_name?: string;
      name?: string;
      picture?: string;
      nip05?: string;
    };
  }>,
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => dmCapabilityState,
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

vi.mock('@/hooks/useProtectedMinorStatus', () => ({
  useProtectedMinorStatus: () => ({
    state: protectedMinorState.value,
  }),
}));

vi.mock('@/lib/officialAccounts', () => ({
  DIVINE_MODERATION_PUBKEY: '8fd5eb6d8f362163bc00a5ab6b4a3167dbf32d00ec4efdbcf43b3c9514433b7e',
  officialAccountsService: {
    isApprovedMinorDmRecipient: (pubkey: string) => {
      mockRevalidateMinorRecipient(pubkey);
      return Promise.resolve(approvedMinorPubkeys.has(pubkey));
    },
    isApprovedMinorDmRecipientSync: (pubkey: string) =>
      approvedMinorPubkeys.has(pubkey),
    onVerdictChanged: () => () => undefined,
  },
}));

function buildMessage(overrides: Partial<DmMessage> = {}): DmMessage {
  return {
    conversationId: CONVERSATION_ID,
    wrapId: 'wrap-1',
    rumorId: 'rumor-1',
    senderPubkey: currentUserPubkey,
    participantPubkeys: [currentUserPubkey, RECIPIENT_PUBKEY],
    peerPubkeys: [RECIPIENT_PUBKEY],
    content: 'hello',
    createdAt: 1_234_567_890,
    isOutgoing: true,
    ...overrides,
  };
}

function renderConversationRoute(conversationId: string) {
  return render(
    <MemoryRouter initialEntries={[`/messages/${conversationId}`]}>
      <Routes>
        <Route path="/messages/:conversationId" element={<ConversationPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function encodeRawConversationId(value: string) {
  return window.btoa(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function renderConversation(peers: string | string[]) {
  const conversationId = encodeConversationId(
    typeof peers === 'string' ? [peers] : peers,
  );

  return renderConversationRoute(conversationId);
}

function renderPage() {
  return renderConversation(RECIPIENT_PUBKEY);
}

describe('ConversationPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    protectedMinorState.value = 'not_protected';
    approvedMinorPubkeys.clear();
    approvedMinorPubkeys.add(RECIPIENT_PUBKEY);
    dmCapabilityState.canUseDirectMessages = true;
    dmCapabilityState.isCheckingDmCapability = false;
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
    for (const pubkey of Object.keys(mockAuthorMap)) {
      delete mockAuthorMap[pubkey];
    }
    mockAuthorMap[RECIPIENT_PUBKEY] = {
      metadata: {
        display_name: 'Divine Support',
        name: 'support',
        picture: 'https://example.com/support.png',
      },
    };
    directMessageState.messages = [];
    directMessageState.latestMessageAt = 0;
    directMessageState.lastReadAt = 0;
    directMessageState.isLoading = false;
    directMessageState.isPending = false;
    mockSendMutate.mockImplementation(() => undefined);
    mockSendMutateAsync.mockImplementation(() => new Promise<void>(() => undefined));
  });

  it('keeps the support route open with the existing conversation UI', () => {
    directMessageState.messages = [
      buildMessage({
        content: 'Support history stays visible',
        isOutgoing: false,
      }),
    ];

    renderPage();

    expect(screen.getByRole('heading', { name: 'Divine Support' })).toBeInTheDocument();
    expect(screen.getByText('Private support chat')).toBeInTheDocument();
    expect(screen.getByText('Support history stays visible')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith(getSupportDmConversationPath(), {
      replace: true,
    });
  });

  it('navigates from the thread header back to Support', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getByRole('button', { name: 'Back to Support' }));

    expect(mockNavigate).toHaveBeenCalledWith('/support');
  });

  it('offers a Support exit when direct messages are unavailable', async () => {
    const user = userEvent.setup();
    dmCapabilityState.canUseDirectMessages = false;

    renderPage();

    await user.click(screen.getByRole('button', { name: 'Back to Support' }));

    expect(mockNavigate).toHaveBeenCalledWith('/support');
  });

  it('redirects a non-support deep link without rendering its history', async () => {
    directMessageState.messages = [
      buildMessage({
        content: 'Secret non-support history',
        peerPubkeys: [NON_SUPPORT_PUBKEY],
      }),
    ];

    const { container } = renderConversation(NON_SUPPORT_PUBKEY);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(getSupportDmConversationPath(), {
        replace: true,
      });
    });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Secret non-support history')).not.toBeInTheDocument();
  });

  it('redirects a support plus non-support group with replace', async () => {
    const { container } = renderConversation([
      RECIPIENT_PUBKEY,
      NON_SUPPORT_PUBKEY,
    ]);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(getSupportDmConversationPath(), {
        replace: true,
      });
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('redirects an encoded support plus junk route without rendering history', async () => {
    const conversationId = encodeRawConversationId(`${RECIPIENT_PUBKEY},not-a-pubkey`);
    directMessageState.messages = [
      buildMessage({
        content: 'History from a noncanonical route',
      }),
    ];

    expect(decodeConversationId(conversationId)).toEqual([RECIPIENT_PUBKEY]);

    const { container } = renderConversationRoute(conversationId);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(getSupportDmConversationPath(), {
        replace: true,
      });
    });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('History from a noncanonical route')).not.toBeInTheDocument();
  });

  it('redirects a syntactically encoded empty peer route without rendering UI', async () => {
    const conversationId = encodeRawConversationId('not-a-pubkey');

    expect(decodeConversationId(conversationId)).toEqual([]);

    const { container } = renderConversationRoute(conversationId);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(getSupportDmConversationPath(), {
        replace: true,
      });
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('redirects a malformed peer route with replace', async () => {
    const { container } = renderConversationRoute('not-a-conversation');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(getSupportDmConversationPath(), {
        replace: true,
      });
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('redirects protected minors away when Support is not approved', async () => {
    protectedMinorState.value = 'protected';
    approvedMinorPubkeys.clear();

    const { container } = renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(getSupportDmConversationPath(), {
        replace: true,
      });
    });
    expect(mockRevalidateMinorRecipient).toHaveBeenCalledWith(RECIPIENT_PUBKEY);
    expect(container).toBeEmptyDOMElement();
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

    // clientId is minted at the call site so a retry can replay the same
    // rumor rather than build a second one (#578).
    await waitFor(() => expect(mockSendMutateAsync).toHaveBeenCalledWith({
      clientId: expect.stringMatching(/^dm-/),
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
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

    // clientId is minted at the call site so a retry can replay the same
    // rumor rather than build a second one (#578).
    await waitFor(() => expect(mockSendMutateAsync).toHaveBeenCalledWith({
      clientId: expect.stringMatching(/^dm-/),
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
    }));
    expect(composer).toHaveValue('hello');
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
    });
  });
});
