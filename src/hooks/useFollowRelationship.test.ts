// ABOUTME: Tests for useFollowRelationship hook - specifically the follow list overwrite protection
// ABOUTME: Ensures Kind 3 contact list is fetched fresh before publishing to prevent data loss

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { NostrEvent } from '@nostrify/nostrify';

// Mock debug module
vi.mock('@/lib/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}));

// Mock follow list cache
vi.mock('@/lib/followListCache', () => ({
  followListCache: {
    invalidate: vi.fn(),
    getCached: vi.fn().mockReturnValue(null),
    setCached: vi.fn(),
    isFresh: vi.fn().mockReturnValue(false),
    loadFromIndexedDB: vi.fn().mockResolvedValue(null),
  },
}));

// Mock relay config
vi.mock('@/config/relays', () => ({
  PRIMARY_RELAY: { url: 'wss://relay.divine.video' },
}));

// Create mock functions
const mockNostrQuery = vi.fn();
const mockPublishEvent = vi.fn();
const mockUserPubkey = 'aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344';
const mockTargetPubkey = '11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd';

// Mock nostrify
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

// Mock useCurrentUser
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: mockUserPubkey },
  }),
}));

// Mock useNostrPublish
vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: mockPublishEvent,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeContactListEvent(pubkeys: string[], createdAt: number = Math.floor(Date.now() / 1000)): NostrEvent {
  return {
    id: 'event-' + createdAt,
    pubkey: mockUserPubkey,
    created_at: createdAt,
    kind: 3,
    tags: pubkeys.map(pk => ['p', pk, '', '']),
    content: JSON.stringify({ 'wss://relay.divine.video': { read: true, write: true } }),
    sig: 'fake-sig',
  };
}

describe('useFollowUser - follow list overwrite protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublishEvent.mockResolvedValue({ id: 'new-event-id' });
  });

  it('fetches latest Kind 3 from relay before publishing, even when passed null', async () => {
    // Simulate: user has 40 follows on the relay, but UI passed null (not loaded yet)
    const existingFollows = Array.from({ length: 40 }, (_, i) =>
      i.toString(16).padStart(64, '0')
    );
    const existingContactList = makeContactListEvent(existingFollows);

    // When the mutation queries for the latest Kind 3, return the existing one
    mockNostrQuery.mockResolvedValue([existingContactList]);

    const { useFollowUser } = await import('./useFollowRelationship');
    const { result } = renderHook(() => useFollowUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        targetPubkey: mockTargetPubkey,
        currentContactList: null, // UI hasn't loaded it yet
        targetDisplayName: 'Test User',
      });
    });

    // Should have queried the relay for the latest Kind 3
    expect(mockNostrQuery).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ kinds: [3], authors: [mockUserPubkey] }),
      ]),
      expect.any(Object),
    );

    // Should publish with ALL 41 follows (40 existing + 1 new), not just 1
    expect(mockPublishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 3,
        tags: expect.any(Array),
      }),
    );

    const publishedTags = mockPublishEvent.mock.calls[0][0].tags;
    const pTags = publishedTags.filter((t: string[]) => t[0] === 'p');
    expect(pTags).toHaveLength(41); // 40 existing + 1 new
  });

  it('uses passed contactList when relay fetch fails', async () => {
    // Relay query fails, but we have a cached contact list from the UI
    const existingFollows = ['aaaa'.padEnd(64, '0'), 'bbbb'.padEnd(64, '0')];
    const cachedContactList = makeContactListEvent(existingFollows);

    mockNostrQuery.mockRejectedValue(new Error('timeout'));

    const { useFollowUser } = await import('./useFollowRelationship');
    const { result } = renderHook(() => useFollowUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        targetPubkey: mockTargetPubkey,
        currentContactList: cachedContactList,
        targetDisplayName: 'Test User',
      });
    });

    // Should fall back to the passed contact list
    const publishedTags = mockPublishEvent.mock.calls[0][0].tags;
    const pTags = publishedTags.filter((t: string[]) => t[0] === 'p');
    expect(pTags).toHaveLength(3); // 2 existing + 1 new
  });

  it('refuses to publish when both relay fetch and passed contactList are empty but relay had follows', async () => {
    // Edge case: relay fetch fails AND no passed contact list
    // This is the dangerous scenario - we should NOT publish a Kind 3 with just 1 follow
    mockNostrQuery.mockRejectedValue(new Error('timeout'));

    const { useFollowUser } = await import('./useFollowRelationship');
    const { result } = renderHook(() => useFollowUser(), { wrapper: createWrapper() });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          targetPubkey: mockTargetPubkey,
          currentContactList: null,
          targetDisplayName: 'Test User',
        });
      }),
    ).rejects.toThrow();

    // Should NOT have published anything
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('prefers relay contact list over passed one when relay has more follows', async () => {
    // Passed contact list is stale (only 2 follows), relay has the real one (10 follows)
    const staleFollows = ['aaaa'.padEnd(64, '0'), 'bbbb'.padEnd(64, '0')];
    const staleContactList = makeContactListEvent(staleFollows, 1000);

    const realFollows = Array.from({ length: 10 }, (_, i) =>
      (i + 100).toString(16).padStart(64, '0')
    );
    const realContactList = makeContactListEvent(realFollows, 2000);

    mockNostrQuery.mockResolvedValue([realContactList]);

    const { useFollowUser } = await import('./useFollowRelationship');
    const { result } = renderHook(() => useFollowUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        targetPubkey: mockTargetPubkey,
        currentContactList: staleContactList,
        targetDisplayName: 'Test User',
      });
    });

    const publishedTags = mockPublishEvent.mock.calls[0][0].tags;
    const pTags = publishedTags.filter((t: string[]) => t[0] === 'p');
    expect(pTags).toHaveLength(11); // 10 from relay + 1 new
  });

  it('does not add duplicate follow if target already in fetched contact list', async () => {
    // Target is already in the relay's contact list
    const existingFollows = [mockTargetPubkey, 'bbbb'.padEnd(64, '0')];
    const existingContactList = makeContactListEvent(existingFollows);

    mockNostrQuery.mockResolvedValue([existingContactList]);

    const { useFollowUser } = await import('./useFollowRelationship');
    const { result } = renderHook(() => useFollowUser(), { wrapper: createWrapper() });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          targetPubkey: mockTargetPubkey,
          currentContactList: null,
          targetDisplayName: 'Test User',
        });
      }),
    ).rejects.toThrow('Already following');

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});
