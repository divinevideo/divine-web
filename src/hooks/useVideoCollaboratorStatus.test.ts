import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useVideoCollaboratorStatus } from './useVideoCollaboratorStatus';
import { TestApp } from '@/test/TestApp';
import type { NostrEvent } from '@nostrify/nostrify';

const queryMock = vi.fn();
vi.mock('@nostrify/react', async () => {
  const actual = await vi.importActual<typeof import('@nostrify/react')>('@nostrify/react');
  return {
    ...actual,
    useNostr: () => ({ nostr: { query: queryMock, event: vi.fn() } }),
  };
});

beforeEach(() => queryMock.mockReset());

const COORD = `34236:${'b'.repeat(64)}:vid1`;
const TOM = 't'.repeat(64);
const SONY = 's'.repeat(64);

const ack = (pk: string): NostrEvent => ({
  id: 'ack-' + pk, pubkey: pk, created_at: 1, kind: 34238, content: '',
  tags: [['a', COORD], ['d', 'd-' + pk]], sig: '',
});

describe('useVideoCollaboratorStatus', () => {
  it('reports confirmed for pubkeys whose 34238 references the coord', async () => {
    queryMock.mockResolvedValueOnce([ack(TOM)]);
    const { result } = renderHook(
      () => useVideoCollaboratorStatus(COORD, [TOM, SONY]),
      { wrapper: TestApp },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      [TOM]: 'confirmed',
      [SONY]: 'pending',
    });
  });

  it('returns an empty map when collaborator list is empty', async () => {
    const { result } = renderHook(
      () => useVideoCollaboratorStatus(COORD, []),
      { wrapper: TestApp },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({});
    expect(queryMock).not.toHaveBeenCalled();
  });
});
