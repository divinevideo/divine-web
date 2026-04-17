import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DmMessage } from '@/lib/dm';
import { encodeConversationId } from '@/lib/dm';
import ConversationPage from './ConversationPage';

const RECIPIENT_PUBKEY = 'b'.repeat(64);
const CONVERSATION_ID = encodeConversationId([RECIPIENT_PUBKEY]);

const {
  directMessageState,
  mockNavigate,
  mockMarkConversationRead,
  mockSendMutate,
  mockSendMutateAsync,
} = vi.hoisted(() => ({
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
}));

vi.mock('@/hooks/useDirectMessages', () => ({
  useDmCapability: () => ({ canUseDirectMessages: true }),
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
    data: {
      [RECIPIENT_PUBKEY]: {
        metadata: {
          display_name: 'Inbox Friend',
          name: 'inboxfriend',
          picture: 'https://example.com/friend.png',
        },
      },
    },
  }),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
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
  beforeEach(() => {
    vi.clearAllMocks();
    directMessageState.messages = [];
    directMessageState.latestMessageAt = 0;
    directMessageState.lastReadAt = 0;
    directMessageState.isLoading = false;
    directMessageState.isPending = false;
    directMessageState.share = null;
    mockSendMutate.mockImplementation(() => undefined);
    mockSendMutateAsync.mockImplementation(() => new Promise<void>(() => undefined));
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
