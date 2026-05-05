// src/hooks/usePeopleLists.test.ts
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePeopleLists } from './usePeopleLists';

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

describe('usePeopleLists', () => {
  beforeEach(() => mockQuery.mockReset());

  it('parses and dedupes by d-tag, keeping latest', async () => {
    mockQuery.mockResolvedValue([
      { id: '1', kind: 30000, pubkey: PK, created_at: 100, sig: '', content: '',
        tags: [['d', 'a'], ['title', 'old']] },
      { id: '2', kind: 30000, pubkey: PK, created_at: 200, sig: '', content: '',
        tags: [['d', 'a'], ['title', 'new'], ['p', MEMBER]] },
      { id: '3', kind: 30000, pubkey: PK, created_at: 150, sig: '', content: '',
        tags: [['d', 'b']] },
    ]);
    const { result } = renderHook(() => usePeopleLists(PK), { wrapper: wrap });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    const a = result.current.data!.find(l => l.id === 'a')!;
    expect(a.name).toBe('new');
    expect(a.members).toEqual([MEMBER]);
  });

  it('returns empty array when no events', async () => {
    mockQuery.mockResolvedValue([]);
    const { result } = renderHook(() => usePeopleLists(PK), { wrapper: wrap });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('skips when pubkey is empty', () => {
    const { result } = renderHook(() => usePeopleLists(''), { wrapper: wrap });
    expect(result.current.isFetching).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
