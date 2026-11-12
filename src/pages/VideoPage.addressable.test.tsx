// End-to-end check that an author-named video link (an naddr1 or a raw
// kind:pubkey:d coordinate) opens that author's video and no one else's.
// The data hooks are real; only the Funnelcake client and the relay are faked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { VideoPage } from './VideoPage';
import { NIP19Page } from './NIP19Page';
import { initializeI18n } from '@/lib/i18n';

const { AUTHOR, SQUATTER, SHARED_D_TAG, relayEvents, mockFetchVideoById, mockQuery } = vi.hoisted(() => ({
  AUTHOR: 'a'.repeat(64),
  SQUATTER: 'b'.repeat(64),
  // Divine's d tag is the sha256 of the uploaded file, so two accounts that
  // upload the same file share one, and anyone can publish under any d tag.
  SHARED_D_TAG: 'c'.repeat(64),
  relayEvents: [] as NostrEvent[],
  mockFetchVideoById: vi.fn(),
  mockQuery: vi.fn(),
}));

function videoEvent(pubkey: string, id: string): NostrEvent {
  return {
    id,
    pubkey,
    created_at: 1_700_000_000,
    kind: 34236,
    tags: [
      ['d', SHARED_D_TAG],
      ['title', `video by ${pubkey.slice(0, 1)}`],
      ['imeta', `url https://media.example/${id}.mp4`, 'm video/mp4'],
    ],
    content: '',
    sig: '0'.repeat(128),
  };
}

function matchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  const dTags = filter['#d'];
  if (dTags && !event.tags.some(tag => tag[0] === 'd' && dTags.includes(tag[1]))) return false;
  return true;
}

vi.mock('@nostrify/react', () => ({ useNostr: () => ({ nostr: { query: mockQuery } }) }));
vi.mock('@/lib/funnelcakeClient', () => ({
  fetchVideoById: mockFetchVideoById,
  fetchUserVideos: vi.fn(),
  searchVideos: vi.fn(),
}));
vi.mock('@/hooks/useAppContext', () => ({ useAppContext: () => ({ config: { relayUrl: 'wss://relay.divine.video' } }) }));
vi.mock('@/hooks/useFeaturedTab', () => ({ useFeaturedTab: () => ({ tab: null, isResolved: true }) }));
vi.mock('@/hooks/useFeaturedTabVideos', () => ({
  useFeaturedTabVideos: () => ({
    data: undefined, error: null, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false, isLoading: false,
  }),
}));
vi.mock('@/hooks/useFeedBlocklist', () => ({ useFeedBlocklist: () => new Set<string>() }));
vi.mock('@/hooks/useFollowList', () => ({ useFollowList: () => ({ data: [] }) }));
vi.mock('@/hooks/usePeopleLists', () => ({ usePeopleList: () => ({ data: null, isLoading: false }) }));
vi.mock('@/hooks/usePeopleListVideos', () => ({ usePeopleListVideos: () => ({ data: null, isLoading: false }) }));
vi.mock('@/lib/funnelcakeFallbackReporting', () => ({ reportFunnelcakeFallback: vi.fn() }));
vi.mock('@unhead/react', () => ({ useSeoMeta: vi.fn(), useHead: vi.fn() }));
vi.mock('@/hooks/useSubdomainNavigate', () => ({ useSubdomainNavigate: () => vi.fn() }));
vi.mock('@/hooks/useAuthor', () => ({ useAuthor: () => ({ data: undefined }) }));
vi.mock('@/hooks/useBatchedVideoInteractions', () => ({ useBatchedVideoInteractions: () => ({ interactions: new Map() }) }));
vi.mock('@/hooks/useNostrPublish', () => ({ useNostrPublish: () => ({ mutateAsync: vi.fn() }) }));
vi.mock('@/hooks/usePublishVideo', () => ({ useRepostVideo: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: undefined }) }));
vi.mock('@/hooks/useVideoSocialMetrics', () => ({ useVideoSocialMetrics: () => ({ data: null }) }));
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/LoginDialogContext', () => ({ useLoginDialog: () => ({ openLoginDialog: vi.fn() }) }));
vi.mock('@/components/VideoCard', () => ({
  VideoCard: ({ video }: { video: { id: string; pubkey: string } }) => (
    <div data-testid="video-card" data-pubkey={video.pubkey}>{video.id}</div>
  ),
}));

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/video/:id" element={<VideoPage />} />
          <Route path="/:nip19" element={<NIP19Page />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

const authorNaddr = () => nip19.naddrEncode({ kind: 34236, pubkey: AUTHOR, identifier: SHARED_D_TAG });

describe('VideoPage author-named video links', () => {
  let client: QueryClient | undefined;

  beforeEach(async () => {
    await initializeI18n({ force: true, languages: ['en-US'] });
    Element.prototype.scrollIntoView = vi.fn();
    relayEvents.length = 0;
    mockFetchVideoById.mockReset();
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (filters: NostrFilter[]) =>
      relayEvents.filter(event => filters.some(filter => matchesFilter(event, filter))));
    // The single-video REST lookup matches a d tag across every account and
    // answers with someone else's video.
    mockFetchVideoById.mockResolvedValue({
      id: 'squatter-event', pubkey: SQUATTER, kind: 34236, created_at: 1_700_000_000,
      d_tag: SHARED_D_TAG, video_url: 'https://media.example/squatter-event.mp4',
    });
  });

  afterEach(() => {
    client?.clear();
  });

  it("opens the named author's video from an naddr1 link when REST answers with another account's", async () => {
    relayEvents.push(videoEvent(SQUATTER, 'squatter-event'), videoEvent(AUTHOR, 'author-event'));

    client = renderAt(`/${authorNaddr()}`);

    const card = await screen.findByTestId('video-card');
    expect(card).toHaveAttribute('data-pubkey', AUTHOR);
    expect(card).toHaveTextContent('author-event');
    expect(screen.queryByText('squatter-event')).not.toBeInTheDocument();
    // Exactly the author-held lookup: no popularity `search` riding along,
    // which the relay would treat as a ranked query.
    expect(mockQuery).toHaveBeenCalledWith(
      [{ kinds: [34236], authors: [AUTHOR], '#d': [SHARED_D_TAG], limit: 1 }],
      expect.anything(),
    );
  });

  it("shows not found instead of another account's video when the author has none", async () => {
    relayEvents.push(videoEvent(SQUATTER, 'squatter-event'));

    client = renderAt(`/video/34236:${AUTHOR}:${SHARED_D_TAG}`);

    expect(await screen.findByText('Video not found')).toBeInTheDocument();
    expect(screen.queryByTestId('video-card')).not.toBeInTheDocument();
  });

  it("shows not found for an naddr1 with an empty identifier, never a video whose d tag is the literal segment", async () => {
    relayEvents.push(videoEvent(SQUATTER, 'squatter-event'));

    client = renderAt(`/${nip19.naddrEncode({ kind: 34236, pubkey: AUTHOR, identifier: '' })}`);

    expect(await screen.findByText('Video not found')).toBeInTheDocument();
    expect(screen.queryByTestId('video-card')).not.toBeInTheDocument();
    expect(mockFetchVideoById).not.toHaveBeenCalledWith(
      expect.any(String), `34236:${AUTHOR}:`, expect.anything(), expect.anything(),
    );
  });

  it('keeps resolving a bare d-tag link, which names no author, as before', async () => {
    client = renderAt(`/video/${SHARED_D_TAG}`);

    await waitFor(() => expect(screen.getByTestId('video-card')).toHaveAttribute('data-pubkey', SQUATTER));
    expect(mockFetchVideoById).toHaveBeenCalledWith(expect.any(String), SHARED_D_TAG, undefined, expect.any(AbortSignal));
  });
});
