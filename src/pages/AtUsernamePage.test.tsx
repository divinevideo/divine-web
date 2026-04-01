import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { HTMLAttributes } from 'react';
import { AtUsernamePage } from './AtUsernamePage';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
}));

const mockGetSubdomainUser = vi.hoisted(() => vi.fn(() => null));
vi.mock('@/hooks/useSubdomainUser', () => ({
  getSubdomainUser: mockGetSubdomainUser,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

const VALID_PUBKEY = 'a'.repeat(64);
const originalLocation = window.location;

function setLocation(url: string) {
  Object.defineProperty(window, 'location', {
    value: new URL(url),
    writable: true,
    configurable: true,
  });
}

function renderPage(username: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AtUsernamePage username={username} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockFetchSuccess(username: string, pubkey: string) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ names: { [username]: pubkey } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function mockFetchEmpty() {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ names: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function mockFetchError(status = 500) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('Internal Server Error', { status }),
  );
}

describe('AtUsernamePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocation('https://divine.video/@alice');
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('redirects to subdomain on successful NIP-05 lookup', async () => {
    mockFetchSuccess('alice', VALID_PUBKEY);
    renderPage('alice');

    await waitFor(() => {
      expect(window.location.href).toMatch(/^https:\/\/alice\.divine\.video\/?$/);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/.well-known/nostr.json?name=alice',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('lowercases the username before lookup', async () => {
    mockFetchSuccess('kingbach', VALID_PUBKEY);
    renderPage('KingBach');

    await waitFor(() => {
      expect(window.location.href).toMatch(/^https:\/\/kingbach\.divine\.video\/?$/);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/.well-known/nostr.json?name=kingbach',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('shows not-found when username is not in NIP-05 response', async () => {
    mockFetchEmpty();
    renderPage('nonexistent');

    expect(await screen.findByText('User Not Found')).toBeInTheDocument();
    expect(screen.getByText('@nonexistent')).toBeInTheDocument();
  });

  it('shows not-found when fetch fails', async () => {
    // mockResolvedValue (not Once) so retries also fail
    mockFetchError(500);
    renderPage('broken');

    expect(await screen.findByText('User Not Found', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('shows not-found when pubkey is not valid hex', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ names: { baduser: 'not-a-valid-pubkey' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    renderPage('baduser');

    expect(await screen.findByText('User Not Found')).toBeInTheDocument();
  });

  it('shows loading state while fetching', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderPage('loading');

    expect(screen.getByText('Looking up @loading...')).toBeInTheDocument();
  });

  it('redirects to apex domain when on a subdomain', async () => {
    mockGetSubdomainUser.mockReturnValue({
      subdomain: 'alice',
      pubkey: 'b'.repeat(64),
      npub: 'npub1test',
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
    renderPage('bob');

    await waitFor(() => {
      expect(window.location.href).toMatch(/^https:\/\/divine\.video\/@bob\/?$/);
    });

    // Should NOT have attempted a NIP-05 fetch
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
