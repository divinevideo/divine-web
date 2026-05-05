// src/hooks/usePeopleList.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePeopleList } from './usePeopleList';

const mockQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: mockQuery } }),
}));

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const PK = 'a'.repeat(64);
const MEMBER = 'b'.repeat(64);
const D_TAG = 'my-list';

describe('usePeopleList', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns parsed list when relay returns single event', async () => {
    mockQuery.mockResolvedValue([
      {
        id: 'evt1',
        kind: 30000,
        pubkey: PK,
        created_at: 200,
        sig: '',
        content: '',
        tags: [['d', D_TAG], ['title', 'My List'], ['p', MEMBER]],
      },
    ]);
    const { result } = renderHook(() => usePeopleList(PK, D_TAG), { wrapper: wrap });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.id).toBe(D_TAG);
    expect(result.current.data?.name).toBe('My List');
    expect(result.current.data?.members).toEqual([MEMBER]);
  });

  it('picks the event with the highest created_at when relay returns 2 events with same d-tag', async () => {
    mockQuery.mockResolvedValue([
      {
        id: 'evt-old',
        kind: 30000,
        pubkey: PK,
        created_at: 100,
        sig: '',
        content: '',
        tags: [['d', D_TAG], ['title', 'Old Name'], ['p', MEMBER]],
      },
      {
        id: 'evt-new',
        kind: 30000,
        pubkey: PK,
        created_at: 300,
        sig: '',
        content: '',
        tags: [['d', D_TAG], ['title', 'New Name']],
      },
    ]);
    const { result } = renderHook(() => usePeopleList(PK, D_TAG), { wrapper: wrap });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('New Name');
    expect(result.current.data?.createdAt).toBe(300);
  });

  it('returns null when relay returns no events', async () => {
    mockQuery.mockResolvedValue([]);
    const { result } = renderHook(() => usePeopleList(PK, D_TAG), { wrapper: wrap });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('is disabled when pubkey is empty', () => {
    const { result } = renderHook(() => usePeopleList('', D_TAG), { wrapper: wrap });
    expect(result.current.isFetching).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('is disabled when dTag is empty', () => {
    const { result } = renderHook(() => usePeopleList(PK, ''), { wrapper: wrap });
    expect(result.current.isFetching).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
