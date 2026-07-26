// ABOUTME: Tests paginated relay video queries for people-list members

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNostrQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: mockNostrQuery } }),
}));

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe('usePeopleListVideos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNostrQuery.mockResolvedValue([]);
  });

  it('queries member authors in bounded batches', async () => {
    const members = Array.from({ length: 101 }, (_, index) => index.toString(16).padStart(64, '0'));
    const { usePeopleListVideos } = await import('./usePeopleListVideos');

    const { result } = renderHook(() => usePeopleListVideos(members), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const filters = mockNostrQuery.mock.calls[0][0];
    expect(filters).toHaveLength(2);
    expect(filters[0].authors).toHaveLength(100);
    expect(filters[1].authors).toHaveLength(1);
    expect(filters.every((filter: { limit: number }) => filter.limit === 60)).toBe(true);
  });

  it('stays idle for an empty people list', async () => {
    const { usePeopleListVideos } = await import('./usePeopleListVideos');
    const { result } = renderHook(() => usePeopleListVideos([]), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });
});
