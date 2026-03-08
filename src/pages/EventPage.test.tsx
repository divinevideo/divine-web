import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ImgHTMLAttributes,
  ReactNode,
} from 'react';
import { nip19 } from 'nostr-tools';
import EventPage from './EventPage';

const { mockFetchEventById, mockFetchAddressableEvent, mockNavigate } = vi.hoisted(() => ({
  mockFetchEventById: vi.fn(),
  mockFetchAddressableEvent: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: {
      metadata: {
        name: 'Test Author',
        picture: 'https://example.com/avatar.png',
      },
    },
  }),
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: vi.fn(),
    },
  }),
}));

vi.mock('@/lib/eventLookup', () => ({
  fetchEventById: mockFetchEventById,
  fetchAddressableEvent: mockFetchAddressableEvent,
}));

vi.mock('@/components/NoteContent', () => ({
  NoteContent: ({ event }: { event: { content: string } }) => (
    <div data-testid="note-content">{event.content}</div>
  ),
}));

vi.mock('@/components/SmartLink', () => ({
  SmartLink: ({
    to,
    children,
    ownerPubkey: _ownerPubkey,
    ...props
  }: {
    to: string;
    children: ReactNode;
    ownerPubkey?: string | null;
  } & HTMLAttributes<HTMLAnchorElement>) => (
    <Link to={to} {...props}>{children}</Link>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AvatarImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
  AvatarFallback: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

function renderPage(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/event/:eventId" element={<EventPage />} />
          <Route path="/event/a/:kind/:pubkey/:identifier" element={<EventPage />} />
          <Route path="/list/:pubkey/:listId" element={<div data-testid="list-page">List page</div>} />
          <Route path="/video/:id" element={<div data-testid="video-page">Video page</div>} />
          <Route path="/profile/:npub" element={<div data-testid="profile-page">Profile page</div>} />
          <Route path="/t/:tag" element={<div data-testid="tag-page">Tag page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('EventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders kind 1 events with note content', async () => {
    mockFetchEventById.mockResolvedValue({
      id: 'e'.repeat(64),
      pubkey: 'f'.repeat(64),
      created_at: 1_700_000_000,
      kind: 1,
      tags: [],
      content: 'hello from a text note',
      sig: '0'.repeat(128),
    });

    renderPage([`/event/${'e'.repeat(64)}`]);

    expect(await screen.findByTestId('note-content')).toHaveTextContent('hello from a text note');
    expect(screen.getAllByText('Text Note').length).toBeGreaterThan(0);
  });

  it('redirects video lists to the existing list page', async () => {
    const pubkey = 'a'.repeat(64);
    mockFetchEventById.mockResolvedValue({
      id: 'b'.repeat(64),
      pubkey,
      created_at: 1_700_000_000,
      kind: 30005,
      tags: [['d', 'favorites']],
      content: '',
      sig: '1'.repeat(128),
    });

    renderPage([`/event/${'b'.repeat(64)}`]);

    expect(await screen.findByTestId('list-page')).toBeInTheDocument();
  });

  it('shows generic list-style events with reference links and raw json', async () => {
    const authorPubkey = 'c'.repeat(64);
    const referencedPubkey = 'd'.repeat(64);
    const referencedEventId = 'e'.repeat(64);
    const event = {
      id: 'f'.repeat(64),
      pubkey: authorPubkey,
      created_at: 1_700_000_000,
      kind: 30001,
      tags: [
        ['d', 'reading-list'],
        ['title', 'Reading List'],
        ['p', referencedPubkey],
        ['e', referencedEventId],
        ['a', `30023:${referencedPubkey}:post-123`],
        ['t', 'music'],
      ],
      content: 'hand-picked references',
      sig: '2'.repeat(128),
    };
    mockFetchAddressableEvent.mockResolvedValue(event);
    mockFetchEventById.mockResolvedValue(event);

    renderPage([`/event/a/30001/${authorPubkey}/reading-list`]);

    expect(await screen.findByText('Reading List')).toBeInTheDocument();
    expect(screen.getByText('List Items')).toBeInTheDocument();

    const npub = nip19.npubEncode(referencedPubkey);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Test Author' })).toHaveAttribute('href', `/profile/${toNpub(authorPubkey)}`);
    });

    const links = screen.getAllByRole('link', { name: 'Open referenced item' });
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveAttribute('href', `/profile/${npub}`);
    expect(links[1]).toHaveAttribute('href', `/event/${referencedEventId}`);
    expect(links[2]).toHaveAttribute('href', `/event/a/30023/${referencedPubkey}/post-123`);
    expect(links[3]).toHaveAttribute('href', '/t/music');

    expect(document.querySelector('pre')?.textContent).toContain('"kind": 30001');
  });
});

function toNpub(pubkey: string): string {
  return nip19.npubEncode(pubkey);
}
