// ABOUTME: Tests that the profile grid feeds infinite scroll a fetched-row count
// ABOUTME: divine-web#380 — a page that dedupes away must still re-arm the trigger

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';

const PUBKEY = 'a'.repeat(64);

// Two rows that collapse to one under `pubkey:kind:d-tag` dedup, plus one unique
// row. Rendered length is 2; fetched length is 3.
function makeVideo(vineId: string, id: string) {
  return {
    id,
    pubkey: PUBKEY,
    kind: 34236,
    createdAt: 1700000000,
    content: '',
    videoUrl: `https://cdn.example/${id}.mp4`,
    thumbnailUrl: undefined,
    title: vineId,
    hashtags: [],
    vineId,
    reposts: [],
  };
}

const videoProviderResult = {
  data: {
    pages: [
      { videos: [makeVideo('v1', 'e1'), makeVideo('v2', 'e2')], nextCursor: undefined },
      // Whole page is a repeat of v1 — dedup drops it entirely.
      { videos: [makeVideo('v1', 'e3')], nextCursor: undefined },
    ],
    pageParams: [undefined, undefined],
  },
  fetchNextPage: vi.fn(),
  hasNextPage: true,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  fetchedCount: 3,
  dataSource: 'funnelcake' as const,
  apiUrl: 'https://api.example',
};

const infiniteScrollProps: Array<Record<string, unknown>> = [];

vi.mock('react-infinite-scroll-component', () => ({
  default: (props: Record<string, unknown>) => {
    infiniteScrollProps.push(props);
    return <div data-testid="infinite-scroll">{props.children as React.ReactNode}</div>;
  },
}));

vi.mock('@/hooks/useVideoProvider', () => ({
  useVideoProvider: () => videoProviderResult,
}));

vi.mock('@/hooks/useFunnelcakeProfile', () => ({
  useFunnelcakeProfile: () => ({ data: { video_count: 3, name: 'tester' }, isLoading: false }),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({ data: { metadata: { name: 'tester' } }, isLoading: false }),
}));

vi.mock('@/hooks/useProfileJoinedDate', () => ({
  useProfileJoinedDate: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/hooks/useClassicVineArchiveStats', () => ({
  useClassicVineArchiveStats: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('@/hooks/useNip05Validation', () => ({
  useNip05Validation: () => ({ isValid: false }),
}));

vi.mock('@/hooks/useRssFeedAvailable', () => ({
  useRssFeedAvailable: () => ({ data: false }),
}));

vi.mock('@/hooks/useResolveSubdomainPubkey', () => ({
  useResolveSubdomainPubkey: () => ({ pubkey: undefined, isLoading: false }),
}));

vi.mock('@/hooks/useNip05Pubkey', () => ({
  useNip05Pubkey: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('@/hooks/useSubdomainUser', () => ({
  getSubdomainUser: () => null,
}));

describe('ProfilePage infinite scroll', () => {
  beforeEach(() => {
    infiniteScrollProps.length = 0;
    vi.clearAllMocks();
  });

  it('passes the fetched row count as dataLength, not the deduplicated length', async () => {
    const { ProfilePage } = await import('./ProfilePage');

    render(
      <TestApp>
        <ProfilePage pubkeyOverride={PUBKEY} />
      </TestApp>
    );

    const props = infiniteScrollProps.at(-1);
    expect(props).toBeDefined();
    // Rendered grid shows 2 unique videos; 3 rows were fetched. Using the
    // rendered length here is what stalls the feed, because the second page
    // leaves it unchanged and the scroll trigger never re-arms.
    expect(props?.dataLength).toBe(3);
    expect(props?.hasMore).toBe(true);
  });
});
