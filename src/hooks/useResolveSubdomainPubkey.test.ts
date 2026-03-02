// ABOUTME: Tests for useResolveSubdomainPubkey hook
// ABOUTME: Tests stale NIP-05 detection and relay-based pubkey resolution

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { isNip05MatchForSubdomain } from './useResolveSubdomainPubkey';

const STALE_PUBKEY = 'dece71d0' + 'a'.repeat(56);
const CORRECT_PUBKEY = 'bb9f2a' + 'b'.repeat(58);

// Mock NRelay1
const mockQuery = vi.fn();
const mockClose = vi.fn();
vi.mock('@nostrify/nostrify', () => ({
  NRelay1: vi.fn().mockImplementation(() => ({
    query: mockQuery,
    close: mockClose,
  })),
}));

// Mock getSubdomainUser
const mockGetSubdomainUser = vi.fn();
vi.mock('@/hooks/useSubdomainUser', () => ({
  getSubdomainUser: () => mockGetSubdomainUser(),
}));

// Mock relay config
vi.mock('@/config/relays', () => ({
  SEARCH_RELAY: { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('isNip05MatchForSubdomain', () => {
  it('matches _@subdomain.apex format', () => {
    expect(isNip05MatchForSubdomain('_@alice.divine.video', 'alice', 'divine.video')).toBe(true);
  });

  it('matches subdomain@apex format', () => {
    expect(isNip05MatchForSubdomain('alice@divine.video', 'alice', 'divine.video')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isNip05MatchForSubdomain('_@Alice.Divine.Video', 'alice', 'divine.video')).toBe(true);
    expect(isNip05MatchForSubdomain('Alice@Divine.Video', 'ALICE', 'divine.video')).toBe(true);
  });

  it('rejects mismatched subdomain', () => {
    expect(isNip05MatchForSubdomain('_@bob.divine.video', 'alice', 'divine.video')).toBe(false);
  });

  it('rejects mismatched domain', () => {
    expect(isNip05MatchForSubdomain('_@alice.other.video', 'alice', 'divine.video')).toBe(false);
  });

  it('handles empty inputs', () => {
    expect(isNip05MatchForSubdomain('', 'alice', 'divine.video')).toBe(false);
    expect(isNip05MatchForSubdomain('_@alice.divine.video', '', 'divine.video')).toBe(false);
    expect(isNip05MatchForSubdomain('_@alice.divine.video', 'alice', '')).toBe(false);
  });
});

describe('useResolveSubdomainPubkey', () => {
  let useResolveSubdomainPubkey: typeof import('./useResolveSubdomainPubkey').useResolveSubdomainPubkey;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockClose.mockReset();
    mockGetSubdomainUser.mockReturnValue(null);

    const hook = await import('./useResolveSubdomainPubkey');
    useResolveSubdomainPubkey = hook.useResolveSubdomainPubkey;
  });

  it('returns original pubkey when not on a subdomain', () => {
    mockGetSubdomainUser.mockReturnValue(null);

    const { result } = renderHook(() => useResolveSubdomainPubkey(), {
      wrapper: createWrapper(),
    });

    expect(result.current.pubkey).toBe('');
    expect(result.current.isResolved).toBe(false);
    expect(result.current.isSearching).toBe(false);
  });

  it('returns original pubkey when nip05Stale is false', () => {
    mockGetSubdomainUser.mockReturnValue({
      subdomain: 'alice',
      pubkey: STALE_PUBKEY,
      npub: 'npub1test',
      apexDomain: 'divine.video',
      nip05Stale: false,
    });

    const { result } = renderHook(() => useResolveSubdomainPubkey(), {
      wrapper: createWrapper(),
    });

    expect(result.current.pubkey).toBe(STALE_PUBKEY);
    expect(result.current.isResolved).toBe(false);
    expect(result.current.isSearching).toBe(false);
  });

  it('searches relay when nip05Stale is true and returns resolved pubkey', async () => {
    mockGetSubdomainUser.mockReturnValue({
      subdomain: 'kirstenswasey',
      pubkey: STALE_PUBKEY,
      npub: 'npub1stale',
      apexDomain: 'divine.video',
      nip05Stale: true,
    });

    mockQuery.mockResolvedValueOnce([
      {
        pubkey: 'unrelated' + 'c'.repeat(55),
        content: JSON.stringify({ nip05: '_@other.divine.video' }),
      },
      {
        pubkey: CORRECT_PUBKEY,
        content: JSON.stringify({ nip05: '_@kirstenswasey.divine.video' }),
      },
    ]);

    const { result } = renderHook(() => useResolveSubdomainPubkey(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
    });

    expect(result.current.pubkey).toBe(CORRECT_PUBKEY);
    expect(result.current.isResolved).toBe(true);
    expect(mockClose).toHaveBeenCalled();
  });

  it('falls back to original pubkey when search finds no match', async () => {
    mockGetSubdomainUser.mockReturnValue({
      subdomain: 'kirstenswasey',
      pubkey: STALE_PUBKEY,
      npub: 'npub1stale',
      apexDomain: 'divine.video',
      nip05Stale: true,
    });

    mockQuery.mockResolvedValueOnce([
      {
        pubkey: 'unrelated' + 'c'.repeat(55),
        content: JSON.stringify({ nip05: '_@other.divine.video' }),
      },
    ]);

    const { result } = renderHook(() => useResolveSubdomainPubkey(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
    });

    expect(result.current.pubkey).toBe(STALE_PUBKEY);
    expect(result.current.isResolved).toBe(false);
  });

  it('falls back to original pubkey when relay search fails', async () => {
    mockGetSubdomainUser.mockReturnValue({
      subdomain: 'kirstenswasey',
      pubkey: STALE_PUBKEY,
      npub: 'npub1stale',
      apexDomain: 'divine.video',
      nip05Stale: true,
    });

    mockQuery.mockRejectedValueOnce(new Error('Relay connection failed'));

    const { result } = renderHook(() => useResolveSubdomainPubkey(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
    });

    expect(result.current.pubkey).toBe(STALE_PUBKEY);
    expect(result.current.isResolved).toBe(false);
  });

  it('skips events with invalid JSON content', async () => {
    mockGetSubdomainUser.mockReturnValue({
      subdomain: 'alice',
      pubkey: STALE_PUBKEY,
      npub: 'npub1stale',
      apexDomain: 'divine.video',
      nip05Stale: true,
    });

    mockQuery.mockResolvedValueOnce([
      {
        pubkey: 'bad' + 'd'.repeat(61),
        content: 'not json at all',
      },
      {
        pubkey: CORRECT_PUBKEY,
        content: JSON.stringify({ nip05: '_@alice.divine.video' }),
      },
    ]);

    const { result } = renderHook(() => useResolveSubdomainPubkey(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
    });

    expect(result.current.pubkey).toBe(CORRECT_PUBKEY);
    expect(result.current.isResolved).toBe(true);
  });
});
