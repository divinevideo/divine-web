// ABOUTME: Tests for PeopleListVideosGrid — member-feed video grid with moderation filtering
// ABOUTME: Verifies rendering, empty state, loading state, and muted-author filtering

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---- module mocks -----------------------------------------------------------

vi.mock('@/hooks/usePeopleListMemberVideos');
vi.mock('@/hooks/useModeration');
vi.mock('@/components/VideoGrid');
vi.mock('@/lib/videoParser');

import { usePeopleListMemberVideos } from '@/hooks/usePeopleListMemberVideos';
import { useContentModeration } from '@/hooks/useModeration';
import { VideoGrid } from '@/components/VideoGrid';
import { parseVideoEvents } from '@/lib/videoParser';
import type { NostrEvent } from '@nostrify/nostrify';
import type { ParsedVideoData } from '@/types/video';

// Re-export the component under test after mocks are in place
import { PeopleListVideosGrid } from './PeopleListVideosGrid';

// ---- helpers ----------------------------------------------------------------

const PUBKEY = 'a'.repeat(64);
const D_TAG = 'my-list';

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'evt-' + Math.random().toString(36).slice(2),
    kind: 34236,
    pubkey: 'b'.repeat(64),
    created_at: 1_000_000,
    tags: [['d', 'vid-1']],
    content: '',
    sig: 'sig',
    ...overrides,
  };
}

function makeParsedVideo(overrides: Partial<ParsedVideoData> = {}): ParsedVideoData {
  return {
    id: 'video-' + Math.random().toString(36).slice(2),
    pubkey: 'b'.repeat(64),
    kind: 34236,
    createdAt: 1_000_000,
    content: 'Test video',
    videoUrl: 'https://example.com/video.mp4',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    hashtags: [],
    ...overrides,
  } as ParsedVideoData;
}

const mockUsePeopleListMemberVideos = vi.mocked(usePeopleListMemberVideos);
const mockUseContentModeration = vi.mocked(useContentModeration);
const mockVideoGrid = vi.mocked(VideoGrid);
const mockParseVideoEvents = vi.mocked(parseVideoEvents);

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function makeQuerySuccess(pages: NostrEvent[][]) {
  return {
    isLoading: false,
    isSuccess: true,
    isError: false,
    data: { pages, pageParams: [] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
  } as unknown as ReturnType<typeof usePeopleListMemberVideos>;
}

function makeQueryLoading() {
  return {
    isLoading: true,
    isSuccess: false,
    isError: false,
    data: undefined,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
  } as unknown as ReturnType<typeof usePeopleListMemberVideos>;
}

function makeModeration(mutedPubkeys: string[] = []) {
  return {
    isMuted: (pk: string) => mutedPubkeys.includes(pk),
    muteList: [],
    checkContent: vi.fn().mockReturnValue({ shouldFilter: false }),
  };
}

// ---- tests ------------------------------------------------------------------

describe('PeopleListVideosGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default VideoGrid mock — render items so we can inspect them
    mockVideoGrid.mockImplementation(({ videos, loading }) => (
      <div data-testid="video-grid-mock" data-loading={String(loading)}>
        {videos.map((v) => (
          <div key={v.id} data-testid="video-item" data-pubkey={v.pubkey} data-id={v.id} />
        ))}
      </div>
    ));
  });

  // Test 1: Renders one entry per event from the hook
  it('renders one VideoGrid item per parsed event', () => {
    const events = [makeEvent({ pubkey: 'b'.repeat(64) }), makeEvent({ pubkey: 'c'.repeat(64) })];
    const parsed = [
      makeParsedVideo({ id: events[0].id, pubkey: events[0].pubkey }),
      makeParsedVideo({ id: events[1].id, pubkey: events[1].pubkey }),
    ];

    mockUsePeopleListMemberVideos.mockReturnValue(makeQuerySuccess([events]));
    mockUseContentModeration.mockReturnValue(makeModeration() as any);
    mockParseVideoEvents.mockReturnValue(parsed);

    render(<PeopleListVideosGrid pubkey={PUBKEY} dTag={D_TAG} />, { wrapper: wrap });

    expect(screen.getAllByTestId('video-item')).toHaveLength(2);
  });

  // Test 2: Empty state shown when 0 events
  it('shows empty state when no events are returned', () => {
    mockUsePeopleListMemberVideos.mockReturnValue(makeQuerySuccess([[]]));
    mockUseContentModeration.mockReturnValue(makeModeration() as any);
    mockParseVideoEvents.mockReturnValue([]);

    render(<PeopleListVideosGrid pubkey={PUBKEY} dTag={D_TAG} />, { wrapper: wrap });

    expect(screen.getByTestId('people-list-videos-empty')).toBeInTheDocument();
    expect(screen.getByText(/no loops yet from these creators/i)).toBeInTheDocument();
  });

  // Test 3: Loading state shown when isLoading
  it('passes loading=true to VideoGrid when hook is loading', () => {
    mockUsePeopleListMemberVideos.mockReturnValue(makeQueryLoading());
    mockUseContentModeration.mockReturnValue(makeModeration() as any);
    mockParseVideoEvents.mockReturnValue([]);

    render(<PeopleListVideosGrid pubkey={PUBKEY} dTag={D_TAG} />, { wrapper: wrap });

    const grid = screen.getByTestId('video-grid-mock');
    expect(grid.dataset.loading).toBe('true');
  });

  // Test 4: Videos by viewer-muted authors are filtered out
  it('filters out videos by muted authors', () => {
    const mutedPubkey = 'd'.repeat(64);
    const visiblePubkey = 'e'.repeat(64);

    const events = [
      makeEvent({ pubkey: mutedPubkey }),
      makeEvent({ pubkey: visiblePubkey }),
    ];
    const parsedAll = [
      makeParsedVideo({ id: events[0].id, pubkey: mutedPubkey }),
      makeParsedVideo({ id: events[1].id, pubkey: visiblePubkey }),
    ];

    mockUsePeopleListMemberVideos.mockReturnValue(makeQuerySuccess([events]));
    mockUseContentModeration.mockReturnValue(makeModeration([mutedPubkey]) as any);
    mockParseVideoEvents.mockReturnValue(parsedAll);

    render(<PeopleListVideosGrid pubkey={PUBKEY} dTag={D_TAG} />, { wrapper: wrap });

    const items = screen.getAllByTestId('video-item');
    expect(items).toHaveLength(1);
    expect(items[0].dataset.pubkey).toBe(visiblePubkey);
  });
});
