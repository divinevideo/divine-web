// ABOUTME: Tests for useFollowRelationship hook - specifically the follow list overwrite protection
// ABOUTME: Ensures Kind 3 contact list is fetched fresh before publishing to prevent data loss

import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FollowRaceError } from './useFollowRelationship';
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
const mockNostrReq = vi.fn();
const mockPublishEvent = vi.fn();
const mockUserPubkey = 'aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344';
const mockTargetPubkey = '11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd';

// Mock nostrify
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
      req: mockNostrReq,
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

function makeContactListEvent(
  pubkeys: string[],
  createdAt: number = Math.floor(Date.now() / 1000),
  id = 'event-' + createdAt,
): NostrEvent {
  return {
    id,
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
    mockNostrReq.mockImplementation(async function* () {
      const events = await mockNostrQuery();
      for (const event of events) {
        yield ['EVENT', 'subscription', event];
      }
      yield ['EOSE', 'subscription'];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(mockNostrReq).toHaveBeenCalledWith(
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

  it('refuses to publish when the authoritative relay read aborts and returns no events', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    mockNostrQuery.mockResolvedValue([]);

    const { useFollowUser } = await import('./useFollowRelationship');
    const { result } = renderHook(() => useFollowUser(), { wrapper: createWrapper() });

    // Assert on the mutation promise directly. Wrapping the rejecting
    // mutateAsync in act() turns a resolved (non-throwing) run into an
    // unhandled rejection instead of a failing assertion, which would let this
    // safety guard silently pass. See the abort-refuse path it protects.
    await expect(
      result.current.mutateAsync({
        targetPubkey: mockTargetPubkey,
        currentContactList: null,
        targetDisplayName: 'Test User',
      }),
    ).rejects.toThrow('Could not load your existing follow list');

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('refuses to publish when every relay closes the authoritative read', async () => {
    mockNostrQuery.mockResolvedValue([]);
    mockNostrReq.mockImplementation(async function* () {
      yield ['CLOSED', 'subscription', 'error: unavailable'];
    });

    const { useFollowUser } = await import('./useFollowRelationship');
    const { result } = renderHook(() => useFollowUser(), { wrapper: createWrapper() });

    await expect(
      result.current.mutateAsync({
        targetPubkey: mockTargetPubkey,
        currentContactList: null,
        targetDisplayName: 'Test User',
      }),
    ).rejects.toThrow('Could not load your existing follow list');

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('uses the passed contact list when the relay read aborts with partial results', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const passedContactList = makeContactListEvent(['aaaa'.padEnd(64, '0')], 1000);
    const relayContactList = makeContactListEvent(['bbbb'.padEnd(64, '0')], 2000);
    mockNostrQuery.mockResolvedValue([relayContactList]);

    const { useFollowUser } = await import('./useFollowRelationship');
    const { result } = renderHook(() => useFollowUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        targetPubkey: mockTargetPubkey,
        currentContactList: passedContactList,
        targetDisplayName: 'Test User',
      });
    });

    const followedPubkeys = mockPublishEvent.mock.calls[0][0].tags
      .filter((t: string[]) => t[0] === 'p')
      .map((t: string[]) => t[1]);
    expect(followedPubkeys).toEqual(['aaaa'.padEnd(64, '0'), mockTargetPubkey]);
    expect(followedPubkeys).not.toContain('bbbb'.padEnd(64, '0'));
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

  it('uses newer relay contact list when it removed a follow', async () => {
    const removedPubkey = 'cccc'.padEnd(64, '0');
    const keptPubkey = 'bbbb'.padEnd(64, '0');
    const staleContactList = makeContactListEvent([keptPubkey, removedPubkey], 1000);
    const relayContactList = makeContactListEvent([keptPubkey], 2000);

    mockNostrQuery.mockResolvedValue([relayContactList]);

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
    const followedPubkeys = publishedTags
      .filter((t: string[]) => t[0] === 'p')
      .map((t: string[]) => t[1]);

    expect(followedPubkeys).toEqual([keptPubkey, mockTargetPubkey]);
    expect(followedPubkeys).not.toContain(removedPubkey);
  });

  it('uses the canonical relay event when relays return a timestamp tie', async () => {
    const canonicalPubkey = 'bbbb'.padEnd(64, '0');
    const nonCanonicalPubkey = 'cccc'.padEnd(64, '0');
    const nonCanonical = makeContactListEvent(
      [nonCanonicalPubkey],
      2000,
      'b'.repeat(64),
    );
    const canonical = makeContactListEvent(
      [canonicalPubkey],
      2000,
      'a'.repeat(64),
    );
    mockNostrQuery.mockResolvedValue([nonCanonical, canonical]);

    const { useFollowUser } = await import('./useFollowRelationship');
    const { result } = renderHook(() => useFollowUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        targetPubkey: mockTargetPubkey,
        currentContactList: null,
        targetDisplayName: 'Test User',
      });
    });

    const followedPubkeys = mockPublishEvent.mock.calls[0][0].tags
      .filter((tag: string[]) => tag[0] === 'p')
      .map((tag: string[]) => tag[1]);
    expect(followedPubkeys).toEqual([canonicalPubkey, mockTargetPubkey]);
  });

  it('requests the relay stream directly before publishing', async () => {
    const existing = makeContactListEvent(['bbbb'.padEnd(64, '0')], 1000);
    mockNostrQuery.mockResolvedValue([existing]);

    const { useFollowUser } = await import('./useFollowRelationship');
    const { result } = renderHook(() => useFollowUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        targetPubkey: mockTargetPubkey,
        currentContactList: existing,
        targetDisplayName: 'Test User',
      });
    });

    expect(mockNostrReq).toHaveBeenCalledWith(
      [{ kinds: [3], authors: [mockUserPubkey], limit: 1 }],
      { signal: expect.any(AbortSignal) },
    );
  });

  it('allows first follow when user has no existing contact list', async () => {
    // Relay query succeeds but returns nothing — brand new account
    mockNostrQuery.mockResolvedValue([]);

    const { useFollowUser } = await import('./useFollowRelationship');
    const { result } = renderHook(() => useFollowUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        targetPubkey: mockTargetPubkey,
        currentContactList: null,
        targetDisplayName: 'Test User',
      });
    });

    // Should publish a Kind 3 with just the one new follow and default relay content
    expect(mockPublishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 3,
        tags: [['p', mockTargetPubkey, '', 'Test User']],
        content: JSON.stringify({ 'wss://relay.divine.video': { read: true, write: true } }),
      }),
    );
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
    ).rejects.toThrow(FollowRaceError);

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});

describe('useUnfollowUser - follow list overwrite protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublishEvent.mockResolvedValue({ id: 'new-event-id' });
    mockNostrReq.mockImplementation(async function* () {
      const events = await mockNostrQuery();
      for (const event of events) {
        yield ['EVENT', 'subscription', event];
      }
      yield ['EOSE', 'subscription'];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses newer relay contact list when it removed a different follow', async () => {
    const targetToUnfollow = mockTargetPubkey;
    const removedElsewhere = 'cccc'.padEnd(64, '0');
    const keptPubkey = 'bbbb'.padEnd(64, '0');
    const staleContactList = makeContactListEvent([targetToUnfollow, keptPubkey, removedElsewhere], 1000);
    const relayContactList = makeContactListEvent([targetToUnfollow, keptPubkey], 2000);

    mockNostrQuery.mockResolvedValue([relayContactList]);

    const { useUnfollowUser } = await import('./useFollowRelationship');
    const { result } = renderHook(() => useUnfollowUser(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        targetPubkey: targetToUnfollow,
        currentContactList: staleContactList,
      });
    });

    const publishedTags = mockPublishEvent.mock.calls[0][0].tags;
    const followedPubkeys = publishedTags
      .filter((t: string[]) => t[0] === 'p')
      .map((t: string[]) => t[1]);

    expect(followedPubkeys).toEqual([keptPubkey]);
    expect(followedPubkeys).not.toContain(removedElsewhere);
    expect(followedPubkeys).not.toContain(targetToUnfollow);
  });

  it('refuses to publish when relay fetch fails and no cached contact list exists', async () => {
    mockNostrQuery.mockRejectedValue(new Error('timeout'));

    const { useUnfollowUser } = await import('./useFollowRelationship');
    const { result } = renderHook(() => useUnfollowUser(), { wrapper: createWrapper() });

    await expect(
      result.current.mutateAsync({
        targetPubkey: mockTargetPubkey,
        currentContactList: null,
      }),
    ).rejects.toThrow('Could not load your existing follow list');

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});
