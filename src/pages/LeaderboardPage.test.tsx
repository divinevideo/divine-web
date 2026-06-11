// ABOUTME: Tests for LeaderboardPage creator profile links
// ABOUTME: Guards against routing through the unreliable /u/<nip05> resolver

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import { initializeI18n } from '@/lib/i18n';
import LeaderboardPage from './LeaderboardPage';

vi.mock('@unhead/react', () => ({
  useSeoMeta: vi.fn(),
}));

const CREATOR_PUBKEY = 'c'.repeat(64);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LeaderboardPage', () => {
  beforeEach(async () => {
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

    window.location.hash = '#creators-alltime';

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/leaderboard/creators')) {
        return {
          ok: true,
          json: async () => ({
            period: 'alltime',
            entries: [
              {
                pubkey: CREATOR_PUBKEY,
                name: 'alice',
                display_name: 'Alice Creator',
                picture: 'https://example.com/alice.jpg',
                nip05: 'alice@divine.video',
                views: 1000,
                unique_viewers: 100,
                loops: 500,
                videos_with_views: 5,
              },
            ],
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ entries: [] }),
      } as Response;
    }));
  });

  it('links creators directly to their npub profile even when the API returns a NIP-05 alias', async () => {
    renderPage();

    const creatorName = await screen.findByText('Alice Creator');
    const link = creatorName.closest('a');

    expect(link).toHaveAttribute(
      'href',
      `/profile/${nip19.npubEncode(CREATOR_PUBKEY)}`,
    );
  });
});
