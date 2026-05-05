import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePeopleListStats } from './usePeopleListStats';

vi.mock('./usePeopleList', () => ({
  usePeopleList: vi.fn(),
}));
vi.mock('@/lib/funnelcakeHealth', () => ({
  isFunnelcakeAvailable: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/funnelcakeClient', () => ({
  fetchBulkUsers: vi.fn(),
}));

import { usePeopleList } from './usePeopleList';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { fetchBulkUsers } from '@/lib/funnelcakeClient';

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const PK = 'a'.repeat(64);
const M = (i: number) => String(i).repeat(64).slice(0, 64);

describe('usePeopleListStats', () => {
  beforeEach(() => {
    vi.mocked(usePeopleList).mockReset();
    vi.mocked(fetchBulkUsers).mockReset();
    vi.mocked(isFunnelcakeAvailable).mockReturnValue(true);
  });

  it('sums video_count for ≤200 members', async () => {
    vi.mocked(usePeopleList).mockReturnValue({
      data: { id: 'x', pubkey: PK, name: 'x', members: [M(1), M(2)], createdAt: 0 },
      isSuccess: true,
    } as any);
    vi.mocked(fetchBulkUsers).mockResolvedValue({
      users: [
        { pubkey: M(1), stats: { video_count: 10 } },
        { pubkey: M(2), stats: { video_count: 5 } },
      ],
      missing: [],
    } as any);
    const { result } = renderHook(() => usePeopleListStats(PK, 'x'), { wrapper: wrap });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ members: 2, videos: 15, loops: null });
  });

  it('returns null videos when >200 members (no fetch)', async () => {
    const big = Array.from({ length: 201 }, (_, i) => M(i + 1));
    vi.mocked(usePeopleList).mockReturnValue({
      data: { id: 'x', pubkey: PK, name: 'x', members: big, createdAt: 0 },
      isSuccess: true,
    } as any);
    const { result } = renderHook(() => usePeopleListStats(PK, 'x'), { wrapper: wrap });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({ members: 201, videos: null, loops: null });
    expect(fetchBulkUsers).not.toHaveBeenCalled();
  });

  it('returns null videos when REST is unhealthy', async () => {
    vi.mocked(isFunnelcakeAvailable).mockReturnValue(false);
    vi.mocked(usePeopleList).mockReturnValue({
      data: { id: 'x', pubkey: PK, name: 'x', members: [M(1)], createdAt: 0 },
      isSuccess: true,
    } as any);
    const { result } = renderHook(() => usePeopleListStats(PK, 'x'), { wrapper: wrap });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({ members: 1, videos: null, loops: null });
    expect(fetchBulkUsers).not.toHaveBeenCalled();
  });
});
