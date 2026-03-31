import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { HTMLAttributes } from 'react';
import { nip19 } from 'nostr-tools';
import { UniversalUserPage } from './UniversalUserPage';

const { mockNavigate, mockNostrQuery } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockNostrQuery: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

function renderPage(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/u/:userId" element={<UniversalUserPage />} />
          <Route path="/:npub" element={<div data-testid="profile-page">Profile page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function createProfileEvent(pubkey: string, metadata: Record<string, unknown>) {
  return {
    id: 'e'.repeat(64),
    pubkey,
    created_at: 1_700_000_000,
    kind: 0,
    tags: [],
    content: JSON.stringify(metadata),
    sig: '0'.repeat(128),
  };
}

describe('UniversalUserPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves numeric Vine user IDs from vine metadata', async () => {
    const pubkey = 'a'.repeat(64);
    mockNostrQuery.mockResolvedValue([
      createProfileEvent(pubkey, {
        name: 'Legacy Vine User',
        vine_metadata: {
          user_id: '1080167736266633216',
        },
      }),
    ]);

    renderPage('/u/1080167736266633216');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(`/${nip19.npubEncode(pubkey)}`, { replace: true });
    });
  });

  it('prefers exact legacy Vine username matches before the openvine fallback', async () => {
    const legacyPubkey = 'b'.repeat(64);
    const fallbackPubkey = 'c'.repeat(64);
    mockNostrQuery.mockResolvedValue([
      createProfileEvent(fallbackPubkey, {
        name: 'OpenVine User',
        nip05: 'someuser@openvine.co',
      }),
      createProfileEvent(legacyPubkey, {
        name: 'Legacy Vine User',
        vine_metadata: {
          username: 'someuser',
        },
      }),
    ]);

    renderPage('/u/someuser');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(`/${nip19.npubEncode(legacyPubkey)}`, { replace: true });
    });
  });

  it('resolves legacy Vine usernames from vine profile website urls', async () => {
    const pubkey = 'd'.repeat(64);
    mockNostrQuery.mockResolvedValue([
      createProfileEvent(pubkey, {
        name: 'Website Match User',
        website: 'https://vine.co/someuser?ref=profile',
      }),
    ]);

    renderPage('/u/someuser');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(`/${nip19.npubEncode(pubkey)}`, { replace: true });
    });
  });

  it('falls back to openvine NIP-05 when there is no legacy Vine username match', async () => {
    const pubkey = 'e'.repeat(64);
    mockNostrQuery.mockResolvedValue([
      createProfileEvent(pubkey, {
        name: 'OpenVine User',
        nip05: 'someuser@openvine.co',
      }),
    ]);

    renderPage('/u/someuser');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(`/${nip19.npubEncode(pubkey)}`, { replace: true });
    });
  });

  it('shows the not-found state when no legacy or NIP-05 match exists', async () => {
    mockNostrQuery.mockResolvedValue([
      createProfileEvent('f'.repeat(64), {
        name: 'Someone Else',
        nip05: 'other@openvine.co',
      }),
    ]);

    renderPage('/u/missinguser');

    expect(await screen.findByText('User Not Found')).toBeInTheDocument();
    expect(screen.getByText(/missinguser/)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
