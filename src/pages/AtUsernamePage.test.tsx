import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes } from 'react';
import { nip19 } from 'nostr-tools';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AtUsernamePage } from './AtUsernamePage';
import { initializeI18n } from '@/lib/i18n';

const { mockNavigate, mockUseParams, mockGetSubdomainUser } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseParams: vi.fn<() => { username?: string; nip19?: string }>(),
  mockGetSubdomainUser: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
  };
});

vi.mock('@/hooks/useSubdomainUser', () => ({
  getSubdomainUser: () => mockGetSubdomainUser(),
}));

vi.mock('./ProfilePage', () => ({
  default: () => <div data-testid="profile-page">Profile Page</div>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryDelay: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AtUsernamePage />
    </QueryClientProvider>,
  );
}

describe('AtUsernamePage', () => {
  const validPubkey = 'a'.repeat(64);

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ username: 'alice' });
    mockGetSubdomainUser.mockReturnValue(null);
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
    vi.restoreAllMocks();
  });

  it('navigates to the resolved profile after a successful lookup', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ names: { alice: validPubkey } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        `/profile/${nip19.npubEncode(validPubkey)}`,
        { replace: true },
      );
    });
  });

  it('lowercases the username before the client-side NIP-05 lookup', async () => {
    mockUseParams.mockReturnValue({ username: 'KingBach' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ names: { kingbach: validPubkey } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://divine.video/.well-known/nostr.json?name=kingbach',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it('shows the not-found state when the lookup fails', async () => {
    mockUseParams.mockReturnValue({ nip19: '@missing' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    renderPage();

    expect(await screen.findByRole('heading', { name: 'User Not Found' })).toBeInTheDocument();
    expect(screen.getByText('@missing')).toBeInTheDocument();
  });

  it('shows the not-found state when the resolved pubkey is invalid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ names: { alice: 'not-a-pubkey' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderPage();

    expect(await screen.findByRole('heading', { name: 'User Not Found' })).toBeInTheDocument();
  });

  it('shows the loading state while the lookup is pending', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Looking up @alice...')).toBeInTheDocument();
  });

  it('skips the fetch and renders the profile page when subdomain data is already injected', () => {
    mockGetSubdomainUser.mockReturnValue({
      subdomain: 'alice',
      pubkey: validPubkey,
      npub: nip19.npubEncode(validPubkey),
      username: 'alice',
      displayName: 'Alice',
      picture: null,
      banner: null,
      about: null,
      nip05: '_@alice.divine.video',
      followersCount: 0,
      followingCount: 0,
      videoCount: 0,
      apexDomain: 'divine.video',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderPage();

    expect(screen.getByTestId('profile-page')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
