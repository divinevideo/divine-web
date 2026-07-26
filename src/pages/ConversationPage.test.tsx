import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
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
    directMessageState.share = null;
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

  it('redirects a malformed peer route with replace', async () => {
    const { container } = renderConversationRoute('not-a-conversation');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(getSupportDmConversationPath(), {
        replace: true,
      });
    });
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
