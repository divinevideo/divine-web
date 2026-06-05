import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { NostrEvent } from '@nostrify/nostrify';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useComments } from '@/hooks/useComments';
import { SHORT_VIDEO_KIND } from '@/types/video';

const nostrQuery = vi.hoisted(() => vi.fn());

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: nostrQuery,
    },
  }),
}));

const ROOT_ID = '61e1c1413aa0e6b239eef566eadad4ce5ab70923facfddfec3aac2f6b04fa741';
const ROOT_PUBKEY = '91ac02c1490ca2f1f78ed7c2b55d6513bf0b9bdaaf40037eb63820f616c7ba9f';
const ROOT_D = 'e58ce5181cc90b8aa6dc995a92a9af14ce8756d06246811d5dfa62bd7e8163c7';
const ROOT_COORDINATE = `${SHORT_VIDEO_KIND}:${ROOT_PUBKEY}:${ROOT_D}`;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function rootEvent(): NostrEvent {
  return {
    id: ROOT_ID,
    pubkey: ROOT_PUBKEY,
    kind: SHORT_VIDEO_KIND,
    tags: [['d', ROOT_D]],
    content: '',
    created_at: 1780229091,
    sig: 'aa'.repeat(64),
  };
}

function topLevelComment(): NostrEvent {
  return {
    id: '42fb4012ecabcce659f35b502bc32723fcf33d3f35fa438e37c84c58794ec985',
    pubkey: 'aedd8f688e95f9533139ea7078b5c0fae73916f36ce29ad66e6c93d8296cf1be',
    kind: 1111,
    tags: [
      ['E', ROOT_ID],
      ['A', ROOT_COORDINATE],
      ['K', String(SHORT_VIDEO_KIND)],
      ['P', ROOT_PUBKEY],
      ['e', ROOT_ID],
      ['a', ROOT_COORDINATE],
      ['k', String(SHORT_VIDEO_KIND)],
      ['p', ROOT_PUBKEY],
    ],
    content: 'beta testing curiosity',
    created_at: 1780517073,
    sig: 'bb'.repeat(64),
  };
}

describe('useComments', () => {
  beforeEach(() => {
    nostrQuery.mockReset();
  });

  it('immediately retries when a known comment count loads as empty', async () => {
    const comment = topLevelComment();
    nostrQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([comment])
      .mockResolvedValueOnce([]);

    const { result } = renderHook(
      () => useComments(rootEvent(), 500, { expectedCommentCount: 22 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.data?.topLevelComments).toHaveLength(1);
    });

    expect(nostrQuery).toHaveBeenCalledTimes(4);
  });
});
