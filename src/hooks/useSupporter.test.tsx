import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchSupporter } from '@/lib/supportersClient';
import { useSupporter } from './useSupporter';

vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: vi.fn() }));
vi.mock('@/lib/supportersClient', () => ({ fetchSupporter: vi.fn(), updateSupporterRecognition: vi.fn() }));
const active = { status: 'active', entitlement: { isActive: true }, recognition: { haloVisible: false, discoveryVisible: false, foundingHistoryVisible: false } } as const;
function setUser(pubkey: string, isHostedAccount = true) {
  vi.mocked(useCurrentUser).mockReturnValue({ user: { pubkey }, signer: {}, isHostedAccount } as ReturnType<typeof useCurrentUser>);
}
function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(fetchSupporter).mockResolvedValue(active);
  setUser('a'.repeat(64));
});
describe('useSupporter', () => {
  it('loads automatically for hosted accounts and refreshes on window focus', async () => {
    const { result, unmount } = renderHook(() => useSupporter(), { wrapper });
    await waitFor(() => expect(result.current.isActive).toBe(true));
    act(() => { focusManager.setFocused(false); focusManager.setFocused(true); });
    await waitFor(() => expect(fetchSupporter).toHaveBeenCalledTimes(2));
    unmount();
    focusManager.setFocused(undefined);
  });
  it('loads automatically for a local-key login independent of signer package identity', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ user: { pubkey: 'a'.repeat(64), method: 'nsec' }, signer: {}, isHostedAccount: false } as unknown as ReturnType<typeof useCurrentUser>);
    const { result } = renderHook(() => useSupporter(), { wrapper });
    await waitFor(() => expect(result.current.isActive).toBe(true));
  });
  it('does not prompt an external signer until a deliberate check', async () => {
    setUser('b'.repeat(64), false);
    const { result } = renderHook(() => useSupporter(), { wrapper });
    expect(fetchSupporter).not.toHaveBeenCalled();
    expect(result.current.isActive).toBe(false);
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.isActive).toBe(true));
  });
  it('does not show a previous account entitlement after switching or a failed read', async () => {
    const { result, rerender } = renderHook(() => useSupporter(), { wrapper });
    await waitFor(() => expect(result.current.isActive).toBe(true));
    setUser('b'.repeat(64));
    vi.mocked(fetchSupporter).mockRejectedValue(new Error('unavailable'));
    rerender();
    expect(result.current.isActive).toBe(false);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
