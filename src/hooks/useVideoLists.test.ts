// ABOUTME: Tests for useVideoLists hooks — NIP-51 video list management
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useDeleteVideoList } from './useVideoLists';

const mockPublish = vi.fn();
vi.mock('./useNostrPublish', () => ({
  useNostrPublish: () => ({ mutateAsync: mockPublish }),
}));
vi.mock('./useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: 'a'.repeat(64) } }),
}));
vi.mock('@nostrify/react', () => ({ useNostr: () => ({ nostr: {} }) }));

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useDeleteVideoList', () => {
  beforeEach(() => mockPublish.mockReset());

  it('publishes kind 5 with both a and k tags', async () => {
    mockPublish.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteVideoList(), { wrapper: wrap });
    await result.current.mutateAsync({ listId: 'my-list' });
    expect(mockPublish).toHaveBeenCalledTimes(1);
    const evt = mockPublish.mock.calls[0][0];
    expect(evt.kind).toBe(5);
    expect(evt.tags).toContainEqual(['a', `30005:${'a'.repeat(64)}:my-list`]);
    expect(evt.tags).toContainEqual(['k', '30005']);
  });
});
