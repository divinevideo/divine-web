import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApproveCollab } from './useApproveCollab';
import { TestApp } from '@/test/TestApp';

const publishMutate = vi.fn();
const invalidateQueries = vi.fn();

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({ mutateAsync: publishMutate }),
}));
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries }),
  };
});
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: 'a'.repeat(64) } }),
}));

beforeEach(() => {
  publishMutate.mockReset();
  publishMutate.mockResolvedValue({ id: 'ack' });
  invalidateQueries.mockReset();
});

describe('useApproveCollab', () => {
  it('publishes a kind 34238 event with the right a- and d-tags', async () => {
    const { result } = renderHook(() => useApproveCollab(), { wrapper: TestApp });
    await act(async () => {
      await result.current.mutateAsync({
        creatorPubkey: 'b'.repeat(64),
        videoDTag: 'vid1',
      });
    });
    const arg = publishMutate.mock.calls[0][0];
    expect(arg.kind).toBe(34238);
    const aTag = arg.tags.find((t: string[]) => t[0] === 'a');
    expect(aTag?.[1]).toBe(`34236:${'b'.repeat(64)}:vid1`);
    const dTag = arg.tags.find((t: string[]) => t[0] === 'd');
    expect(typeof dTag?.[1]).toBe('string');
    expect(dTag?.[1].length).toBeGreaterThan(0);
  });

  it('invalidates inbox + confirmed query keys for the current user', async () => {
    const { result } = renderHook(() => useApproveCollab(), { wrapper: TestApp });
    await act(async () => {
      await result.current.mutateAsync({ creatorPubkey: 'b'.repeat(64), videoDTag: 'vid1' });
    });
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['collab-invites', 'a'.repeat(64)] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['user-collabs', 'a'.repeat(64)] });
    });
  });
});
