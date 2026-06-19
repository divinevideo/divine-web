import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { HTMLAttributes } from 'react';
import { nip19 } from 'nostr-tools';
import { UniversalUserPage } from './UniversalUserPage';
import { initializeI18n } from '@/lib/i18n';

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

vi.mock('./ProfilePage', () => ({
  default: ({ pubkeyOverride }: { pubkeyOverride?: string }) => (
    <div data-testid="profile-page" data-pubkey-override={pubkeyOverride}>Profile Page</div>
  ),
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
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves numeric Vine user IDs from vine metadata and renders ProfilePage', async () => {
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
      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('profile-page').dataset.pubkeyOverride).toBe(pubkey);
    expect(mockNavigate).not.toHaveBeenCalledWith(
      `/${nip19.npubEncode(pubkey)}`,
      expect.anything(),
    );
  });

  it('prefers exact legacy Vine username matches over the default-apex NIP-05 candidates', async () => {
    const legacyPubkey = 'b'.repeat(64);
    const fallbackPubkey = 'c'.repeat(64);
    mockNostrQuery.mockResolvedValue([
      createProfileEvent(fallbackPubkey, {
        name: 'Default Apex User',
        nip05: '_@someuser.divine.video',
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
      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('profile-page').dataset.pubkeyOverride).toBe(legacyPubkey);
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
      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('profile-page').dataset.pubkeyOverride).toBe(pubkey);
  });

  it('falls back to the default-apex NIP-05 candidates when there is no legacy Vine username match', async () => {
    const pubkey = 'e'.repeat(64);
    mockNostrQuery.mockResolvedValue([
      createProfileEvent(pubkey, {
        name: 'Default Apex User',
        nip05: 'someuser@divine.video',
      }),
    ]);

    renderPage('/u/someuser');

    await waitFor(() => {
      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('profile-page').dataset.pubkeyOverride).toBe(pubkey);
  });

  it('shows the not-found state when no legacy or NIP-05 match exists', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch;
    mockNostrQuery.mockResolvedValue([
      createProfileEvent('f'.repeat(64), {
        name: 'Someone Else',
        nip05: '_@other.divine.video',
      }),
    ]);

    try {
      renderPage('/u/missinguser');

      expect(await screen.findByText('User Not Found')).toBeInTheDocument();
      expect(screen.getByText(/missinguser/)).toBeInTheDocument();
      expect(screen.queryByTestId('profile-page')).not.toBeInTheDocument();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('resolves a bare-name URL via the default-apex NIP-05 candidate list', async () => {
    const pubkey = '1'.repeat(64);
    mockNostrQuery.mockResolvedValue([
      createProfileEvent(pubkey, {
        name: 'Jacky!',
        nip05: '_@jacky.divine.video',
      }),
    ]);

    renderPage('/u/jacky');

    await waitFor(() => {
      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('profile-page').dataset.pubkeyOverride).toBe(pubkey);
  });

  it('resolves an explicit default-apex URL when only the non-underscore variant is set', async () => {
    const pubkey = '2'.repeat(64);
    mockNostrQuery.mockResolvedValue([
      createProfileEvent(pubkey, {
        name: 'Alice',
        nip05: 'alice@divine.video',
      }),
    ]);

    renderPage('/u/alice.divine.video');

    await waitFor(() => {
      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('profile-page').dataset.pubkeyOverride).toBe(pubkey);
  });

  it('resolves an explicit alternate-apex URL', async () => {
    const pubkey = '3'.repeat(64);
    mockNostrQuery.mockResolvedValue([
      createProfileEvent(pubkey, {
        name: 'Sam',
        nip05: '_@sam.dvine.video',
      }),
    ]);

    renderPage('/u/sam.dvine.video');

    await waitFor(() => {
      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('profile-page').dataset.pubkeyOverride).toBe(pubkey);
  });

  it('falls back to NIP-05 DNS when no kind-0 profile matches a bare name', async () => {
    const pubkey = '4'.repeat(64);
    mockNostrQuery.mockResolvedValue([]);

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ names: { _: pubkey } }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      renderPage('/u/jacky');

      await waitFor(() => {
        expect(screen.getByTestId('profile-page')).toBeInTheDocument();
      });
      expect(screen.getByTestId('profile-page').dataset.pubkeyOverride).toBe(pubkey);
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not try the legacy Vine branch for subdomain-shaped inputs', async () => {
    const pubkey = '5'.repeat(64);
    mockNostrQuery.mockResolvedValue([
      createProfileEvent('6'.repeat(64), {
        name: 'Wrong Match',
        vine_metadata: {
          username: 'jacky.divine.video',
        },
      }),
      createProfileEvent(pubkey, {
        name: 'Jacky!',
        nip05: '_@jacky.divine.video',
      }),
    ]);

    renderPage('/u/jacky.divine.video');

    await waitFor(() => {
      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('profile-page').dataset.pubkeyOverride).toBe(pubkey);
  });

  it('normalizes a raw NIP-05 URL segment to the canonical friendly form', () => {
    renderPage('/u/_@jimmyhere.divine.video');

    expect(mockNavigate).toHaveBeenCalledWith('/u/jimmyhere', { replace: true });
  });

  it('does not normalize an already-canonical URL segment', () => {
    const originalReplaceState = window.history.replaceState;
    const replaceStateSpy = vi.fn();
    window.history.replaceState = replaceStateSpy;

    renderPage('/u/jimmyhere');

    expect(replaceStateSpy).not.toHaveBeenCalled();

    window.history.replaceState = originalReplaceState;
  });

  it('normalizes a percent-encoded raw NIP-05 URL segment to the canonical friendly form', () => {
    renderPage('/u/jimmyhere%40divine.video');

    expect(mockNavigate).toHaveBeenCalledWith('/u/jimmyhere', { replace: true });
  });

  it('does not normalize a third-party dotted segment that is already canonical', () => {
    const originalReplaceState = window.history.replaceState;
    const replaceStateSpy = vi.fn();
    window.history.replaceState = replaceStateSpy;

    renderPage('/u/alice.primal.net');

    expect(replaceStateSpy).not.toHaveBeenCalled();

    window.history.replaceState = originalReplaceState;
  });
});
