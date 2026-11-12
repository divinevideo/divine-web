// ABOUTME: Tests for usePublishIdentity, useAddIdentity, and useRemoveIdentity hooks
// ABOUTME: Tests NIP-39 kind 10011 event publishing for identity management

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockSignEvent = vi.fn();
const mockNostrEvent = vi.fn();
const mockNostrQuery = vi.fn();
const mockRevoke = vi.hoisted(() => vi.fn());

const TEST_PUBKEY = 'a'.repeat(64);

// Mock nostrify
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      event: mockNostrEvent,
      query: mockNostrQuery,
    },
  }),
}));

// Mock useCurrentUser
vi.mock('./useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey: TEST_PUBKEY,
    },
    signer: {
      signEvent: mockSignEvent,
    },
  }),
}));

// Keep the real platform mapping; replace only the network call
vi.mock('@/lib/signInRevoke', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/signInRevoke')>()),
  revokeSignInLink: mockRevoke,
}));

import { useAddIdentity, useRemoveIdentity } from './usePublishIdentity';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAddIdentity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: no existing identities
    mockNostrQuery.mockResolvedValue([]);
    mockSignEvent.mockImplementation(async (event: Record<string, unknown>) => ({
      ...event,
      id: 'signed-event-id',
      pubkey: TEST_PUBKEY,
      sig: 'test-sig',
    }));
    mockNostrEvent.mockResolvedValue(undefined);
  });

  it('publishes kind 10011 event with identity tag', async () => {
    const { result } = renderHook(
      () => useAddIdentity(),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.mutateAsync({
        platform: 'github',
        identity: 'semisol',
        proof: 'abc123',
      });
    });

    expect(mockSignEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 10011,
        content: '',
        tags: [['i', 'github:semisol', 'abc123']],
      }),
    );
    expect(mockNostrEvent).toHaveBeenCalled();
  });

  it('signs event with correct kind and timestamp', async () => {
    const { result } = renderHook(
      () => useAddIdentity(),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.mutateAsync({
        platform: 'twitter',
        identity: 'alice',
        proof: '123456',
      });
    });

    const signedArgs = mockSignEvent.mock.calls[0][0];
    expect(signedArgs.kind).toBe(10011);
    expect(signedArgs.created_at).toBeGreaterThan(0);
    expect(signedArgs.content).toBe('');
  });

  it('throws when sign event fails', async () => {
    mockSignEvent.mockRejectedValueOnce(new Error('Signing failed'));

    const { result } = renderHook(
      () => useAddIdentity(),
      { wrapper: createWrapper() },
    );

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          platform: 'github',
          identity: 'test',
          proof: 'abc',
        });
      }),
    ).rejects.toThrow('Signing failed');
  });
});

describe('useRemoveIdentity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRevoke.mockResolvedValue({ revoked: true });
    mockSignEvent.mockImplementation(async (event: Record<string, unknown>) => ({
      ...event,
      id: 'signed-event-id',
      pubkey: TEST_PUBKEY,
      sig: 'test-sig',
    }));
    mockNostrEvent.mockResolvedValue(undefined);
  });

  it('publishes event without the removed identity', async () => {
    // Simulate existing identities
    mockNostrQuery.mockResolvedValue([{
      kind: 10011,
      pubkey: TEST_PUBKEY,
      created_at: 1700000000,
      tags: [
        ['i', 'github:alice', 'proof1'],
        ['i', 'twitter:alice', 'proof2'],
      ],
      content: '',
      id: 'event1',
      sig: 'sig1',
    }]);

    const { result } = renderHook(
      () => useRemoveIdentity(),
      { wrapper: createWrapper() },
    );

    // Wait for internal useExternalIdentities query to resolve
    await waitFor(() => expect(mockNostrQuery).toHaveBeenCalled());
    // Allow React Query to populate data
    await new Promise((r) => setTimeout(r, 50));

    await act(async () => {
      await result.current.mutateAsync({
        platform: 'github',
        identity: 'alice',
      });
    });

    // Should publish with only the twitter identity remaining
    const signedArgs = mockSignEvent.mock.calls[0][0];
    expect(signedArgs.tags).toEqual([['i', 'twitter:alice', 'proof2']]);
  });

  it('publishes empty tags when removing the only identity', async () => {
    mockNostrQuery.mockResolvedValue([{
      kind: 10011,
      pubkey: TEST_PUBKEY,
      created_at: 1700000000,
      tags: [['i', 'github:alice', 'proof1']],
      content: '',
      id: 'event1',
      sig: 'sig1',
    }]);

    const { result } = renderHook(
      () => useRemoveIdentity(),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(mockNostrQuery).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));

    await act(async () => {
      await result.current.mutateAsync({
        platform: 'github',
        identity: 'alice',
      });
    });

    const signedArgs = mockSignEvent.mock.calls[0][0];
    expect(signedArgs.tags).toEqual([]);
    expect(signedArgs.kind).toBe(10011);
  });
  async function setup(tags: string[][]) {
    mockNostrQuery.mockResolvedValue([{
      kind: 10011,
      pubkey: TEST_PUBKEY,
      created_at: 1700000000,
      tags,
      content: '',
      id: 'event1',
      sig: 'sig1',
    }]);
    const hook = renderHook(() => useRemoveIdentity(), { wrapper: createWrapper() });
    await waitFor(() => expect(mockNostrQuery).toHaveBeenCalled());
    // Let the identities query settle inside act so it does not warn
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    return hook;
  }

  it('clears the sign-in record with the list it just published', async () => {
    const { result } = await setup([
      ['i', 'bluesky:alice.bsky.social', 'oauth'],
      ['i', 'github:alice', 'proof1'],
    ]);

    let removed!: Awaited<ReturnType<typeof result.current.mutateAsync>>;
    await act(async () => {
      removed = await result.current.mutateAsync({ platform: 'bluesky', identity: 'alice.bsky.social' });
    });

    expect(mockRevoke).toHaveBeenCalledTimes(1);
    expect(mockRevoke).toHaveBeenCalledWith({
      platform: 'bluesky',
      identity: 'alice.bsky.social',
      pubkey: TEST_PUBKEY,
      list: removed.event,
    });
    expect(removed.event.tags).toEqual([['i', 'github:alice', 'proof1']]);
    expect(mockNostrEvent.mock.invocationCallOrder[0]).toBeLessThan(mockRevoke.mock.invocationCallOrder[0]);
    expect(removed.signIn).toEqual({ revoked: true });
  });

  it('sends twitter for an x: row', async () => {
    const { result } = await setup([['i', 'x:alice', 'oauth']]);

    await act(async () => {
      await result.current.mutateAsync({ platform: 'x', identity: 'alice' });
    });

    expect(mockRevoke).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'twitter', identity: 'alice' }),
    );
  });

  it('does not ask the verifier about a platform without sign-in', async () => {
    const { result } = await setup([['i', 'github:alice', 'proof1']]);

    let removed!: Awaited<ReturnType<typeof result.current.mutateAsync>>;
    await act(async () => {
      removed = await result.current.mutateAsync({ platform: 'github', identity: 'alice' });
    });

    expect(mockRevoke).not.toHaveBeenCalled();
    expect(removed.signIn).toBeNull();
  });

  it('keeps the removal when the verifier refuses', async () => {
    const refusal = { revoked: false, code: 'unlink_claim_listed', error: 'This list still holds the linked account.' };
    mockRevoke.mockResolvedValueOnce(refusal);
    const { result } = await setup([
      ['i', 'bluesky:alice.bsky.social', 'oauth'],
      ['i', 'bluesky:Alice.bsky.social', 'oauth'],
    ]);

    let removed!: Awaited<ReturnType<typeof result.current.mutateAsync>>;
    await act(async () => {
      removed = await result.current.mutateAsync({ platform: 'bluesky', identity: 'alice.bsky.social' });
    });

    expect(removed.signIn).toEqual(refusal);
    expect(removed.event.tags).toEqual([['i', 'bluesky:Alice.bsky.social', 'oauth']]);
    expect(mockNostrEvent).toHaveBeenCalledTimes(1);
  });

  it('sends nothing to the verifier when publishing fails', async () => {
    mockNostrEvent.mockRejectedValueOnce(new Error('relay timeout'));
    const { result } = await setup([['i', 'bluesky:alice.bsky.social', 'oauth']]);

    await act(async () => {
      await expect(
        result.current.mutateAsync({ platform: 'bluesky', identity: 'alice.bsky.social' }),
      ).rejects.toThrow('relay timeout');
    });

    expect(mockRevoke).not.toHaveBeenCalled();
  });
});
