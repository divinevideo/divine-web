# Compilation Playback Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable compilation playback mode that can launch from any ordered Divine video list, auto-advance through the source, preload upcoming videos, and preserve source/back context through the URL.

**Architecture:** Introduce a dedicated `/watch` compilation route backed by a normalized source descriptor. Search-backed lists resolve through `useInfiniteSearchVideos`; feed-backed lists resolve through `useVideoProvider`. A focused player page owns URL sync, preload state, tail pagination, and reusable trigger helpers shared by `SearchPage` and `VideoFeed`.

**Tech Stack:** React 18, React Router, TanStack Query, Vitest, Testing Library, existing `VideoPlayer`/video feed hooks

---

## Chunk 1: URL Model And Source Resolution

### Task 1: Add compilation route helpers

**Files:**
- Create: `src/lib/compilationPlayback.ts`
- Test: `src/lib/compilationPlayback.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {
  buildCompilationPlaybackUrl,
  parseCompilationPlaybackParams,
  getCompilationFallbackPath,
} from '@/lib/compilationPlayback';

describe('compilation playback url helpers', () => {
  it('builds and parses search descriptors with returnTo state', () => {
    const url = buildCompilationPlaybackUrl({
      source: 'search',
      query: 'twerking',
      filter: 'videos',
      sort: 'relevance',
      start: 0,
      returnTo: '/search?q=twerking&filter=videos',
    });

    expect(url).toContain('/watch?');
    expect(parseCompilationPlaybackParams(new URL(url, 'https://divine.video').searchParams)).toMatchObject({
      play: 'compilation',
      source: 'search',
      query: 'twerking',
      filter: 'videos',
      sort: 'relevance',
      start: 0,
      returnTo: '/search?q=twerking&filter=videos',
    });
  });

  it('derives deterministic fallback routes when returnTo is absent', () => {
    expect(getCompilationFallbackPath({ source: 'classics' })).toBe('/discovery/classics');
    expect(getCompilationFallbackPath({ source: 'hashtag', tag: 'dance' })).toBe('/hashtag/dance');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/compilationPlayback.test.ts`
Expected: FAIL with missing module/export errors

- [ ] **Step 3: Write minimal implementation**

```ts
export type CompilationSource =
  | { source: 'search'; query: string; filter?: string; sort?: string; start?: number; videoId?: string; returnTo?: string }
  | { source: 'hashtag'; tag: string; sort?: string; start?: number; videoId?: string; returnTo?: string }
  | { source: 'profile'; pubkey: string; sort?: string; start?: number; videoId?: string; returnTo?: string }
  | { source: 'category'; category: string; sort?: string; start?: number; videoId?: string; returnTo?: string }
  | { source: 'discovery' | 'home' | 'trending' | 'recent' | 'classics' | 'foryou'; sort?: string; start?: number; videoId?: string; returnTo?: string };

export function buildCompilationPlaybackUrl(source: CompilationSource): string {
  const params = new URLSearchParams({ play: 'compilation', source: source.source });
  // write source-specific params, start, video, and returnTo
  return `/watch?${params.toString()}`;
}

export function parseCompilationPlaybackParams(params: URLSearchParams) {
  // normalize URL params into a CompilationSource-like object plus play state
}

export function getCompilationFallbackPath(source: CompilationSource): string {
  // return browse routes such as /search, /hashtag/:tag, /profile/:npub-or-pubkey, /discovery, /trending, /category/:name
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/compilationPlayback.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/compilationPlayback.ts src/lib/compilationPlayback.test.ts
git commit -m "feat: add compilation playback url helpers"
```

### Task 2: Normalize compilation source loading

**Files:**
- Create: `src/hooks/useCompilationSource.ts`
- Test: `src/hooks/useCompilationSource.test.tsx`
- Reference: `src/hooks/useInfiniteSearchVideos.ts`
- Reference: `src/hooks/useVideoProvider.ts`

- [ ] **Step 1: Write the failing test**

```tsx
import { renderHook } from '@testing-library/react';
import { useCompilationSource } from '@/hooks/useCompilationSource';

it('uses search pagination for search descriptors', () => {
  const { result } = renderHook(() =>
    useCompilationSource({
      source: 'search',
      query: 'twerking',
      filter: 'videos',
      sort: 'relevance',
    })
  );

  expect(result.current.kind).toBe('search');
});

it('uses feed pagination for classics descriptors', () => {
  const { result } = renderHook(() =>
    useCompilationSource({
      source: 'classics',
      sort: 'top',
    })
  );

  expect(result.current.kind).toBe('feed');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useCompilationSource.test.tsx`
Expected: FAIL with missing hook/module errors

- [ ] **Step 3: Write minimal implementation**

```ts
export function useCompilationSource(source: CompilationSource) {
  const searchQuery = useInfiniteSearchVideos(/* map search descriptor */);
  const feedQuery = useVideoProvider(/* map feed descriptor */);

  if (source.source === 'search') {
    return {
      kind: 'search' as const,
      videos: /* flattened search videos */,
      fetchNextPage: searchQuery.fetchNextPage,
      hasNextPage: searchQuery.hasNextPage,
      isLoading: searchQuery.isLoading,
      error: searchQuery.error,
    };
  }

  return {
    kind: 'feed' as const,
    videos: /* flattened provider videos */,
    fetchNextPage: feedQuery.fetchNextPage,
    hasNextPage: feedQuery.hasNextPage,
    isLoading: feedQuery.isLoading,
    error: feedQuery.error,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useCompilationSource.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCompilationSource.ts src/hooks/useCompilationSource.test.tsx
git commit -m "feat: normalize compilation source loading"
```

## Chunk 2: Route-Level Player

### Task 3: Add the compilation player page and route

**Files:**
- Create: `src/pages/WatchPage.tsx`
- Create: `src/pages/WatchPage.test.tsx`
- Modify: `src/AppRouter.tsx`
- Reference: `src/components/VideoPlayer.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('renders compilation metadata for a search-backed source', async () => {
  renderRoute('/watch?play=compilation&source=search&q=twerking&filter=videos&start=0');

  expect(await screen.findByText('Search: "twerking"')).toBeInTheDocument();
  expect(screen.getByTestId('compilation-player')).toBeInTheDocument();
});

it('navigates back to returnTo when the back button is pressed', async () => {
  renderRoute('/watch?play=compilation&source=classics&returnTo=%2Fsearch%3Fq%3Dvine');
  await user.click(await screen.findByRole('button', { name: /back/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/search?q=vine');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/WatchPage.test.tsx`
Expected: FAIL because route/page do not exist

- [ ] **Step 3: Write minimal implementation**

```tsx
export function WatchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useSubdomainNavigate();
  const descriptor = parseCompilationPlaybackParams(searchParams);
  const source = useCompilationSource(descriptor);

  return (
    <div data-testid="compilation-player">
      <button onClick={() => navigate(descriptor.returnTo ?? getCompilationFallbackPath(descriptor))}>
        Back
      </button>
      <h1>{getCompilationTitle(descriptor)}</h1>
      {/* wire player shell in later tasks */}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/WatchPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/WatchPage.tsx src/pages/WatchPage.test.tsx src/AppRouter.tsx
git commit -m "feat: add compilation watch route"
```

### Task 4: Add sequential playback, URL sync, and tail pagination

**Files:**
- Modify: `src/pages/WatchPage.tsx`
- Create: `src/components/CompilationPlayerSurface.tsx`
- Create: `src/components/CompilationPlayerSurface.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('advances to the next video and replaces the video query param on ended', async () => {
  render(<CompilationPlayerSurface videos={[videoA, videoB]} initialIndex={0} />);

  fireEvent.ended(screen.getByTestId('compilation-video'));

  expect(mockReplaceSearch).toHaveBeenCalledWith(expect.stringContaining('video=video-b'));
  expect(screen.getByText('Video B')).toBeInTheDocument();
});

it('requests another page when playback nears the end of loaded videos', async () => {
  render(
    <CompilationPlayerSurface
      videos={[videoA, videoB, videoC]}
      initialIndex={1}
      hasNextPage
      fetchNextPage={fetchNextPage}
    />
  );

  fireEvent.ended(screen.getByTestId('compilation-video'));
  expect(fetchNextPage).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CompilationPlayerSurface.test.tsx`
Expected: FAIL with missing component/behavior

- [ ] **Step 3: Write minimal implementation**

```tsx
export function CompilationPlayerSurface(props: Props) {
  const [currentIndex, setCurrentIndex] = useState(props.initialIndex);
  const currentVideo = props.videos[currentIndex];

  useEffect(() => {
    if (props.hasNextPage && currentIndex >= props.videos.length - 2) {
      void props.fetchNextPage?.();
    }
  }, [currentIndex, props.hasNextPage, props.fetchNextPage, props.videos.length]);

  const handleEnded = () => {
    if (currentIndex < props.videos.length - 1) {
      setCurrentIndex(index => index + 1);
      props.onVideoChange?.(props.videos[currentIndex + 1]);
    }
  };

  return (
    <VideoPlayer
      key={currentVideo.id}
      videoId={currentVideo.id}
      src={currentVideo.videoUrl}
      poster={currentVideo.thumbnailUrl}
      onEnded={handleEnded}
      data-testid="compilation-video"
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/CompilationPlayerSurface.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/WatchPage.tsx src/components/CompilationPlayerSurface.tsx src/components/CompilationPlayerSurface.test.tsx
git commit -m "feat: add compilation playback sequencing"
```

## Chunk 3: Seamless Preload And Metadata Flow

### Task 5: Preload the next one or two videos

**Files:**
- Modify: `src/components/CompilationPlayerSurface.tsx`
- Test: `src/components/CompilationPlayerSurface.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('preloads the next two videos while the current one plays', () => {
  render(<CompilationPlayerSurface videos={[videoA, videoB, videoC]} initialIndex={0} />);
  expect(screen.getByTestId('compilation-preload-video-video-b')).toHaveAttribute('preload', 'auto');
  expect(screen.getByTestId('compilation-preload-video-video-c')).toHaveAttribute('preload', 'auto');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CompilationPlayerSurface.test.tsx -t preload`
Expected: FAIL because preload nodes are absent

- [ ] **Step 3: Write minimal implementation**

```tsx
const preloadVideos = props.videos.slice(currentIndex + 1, currentIndex + 3);

return (
  <>
    <VideoPlayer /* active video */ />
    {preloadVideos.map(video => (
      <video
        key={video.id}
        data-testid={`compilation-preload-video-${video.id}`}
        src={video.videoUrl}
        preload="auto"
        muted
        playsInline
        className="hidden"
      />
    ))}
  </>
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/CompilationPlayerSurface.test.tsx -t preload`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/CompilationPlayerSurface.tsx src/components/CompilationPlayerSurface.test.tsx
git commit -m "feat: preload upcoming compilation videos"
```

### Task 6: Keep metadata in sync with the active video

**Files:**
- Modify: `src/pages/WatchPage.tsx`
- Test: `src/pages/WatchPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('updates title, author, and about text when playback advances', async () => {
  renderCompilationPageWithVideos([videoA, videoB]);

  fireEvent.ended(screen.getByTestId('compilation-video'));

  expect(screen.getByText(videoB.title)).toBeInTheDocument();
  expect(screen.getByText(videoB.authorName)).toBeInTheDocument();
  expect(screen.getByText(videoB.content)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/WatchPage.test.tsx -t metadata`
Expected: FAIL because metadata remains stuck on the first video

- [ ] **Step 3: Write minimal implementation**

```tsx
const [activeVideo, setActiveVideo] = useState(initialVideo);

<CompilationPlayerSurface
  videos={videos}
  initialIndex={initialIndex}
  onVideoChange={setActiveVideo}
  /* other props */
/>

<h2>{activeVideo.title ?? 'Untitled video'}</h2>
<p>{activeVideo.authorName}</p>
<p>{activeVideo.content}</p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/WatchPage.test.tsx -t metadata`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/WatchPage.tsx src/pages/WatchPage.test.tsx
git commit -m "feat: sync compilation metadata with playback"
```

## Chunk 4: Launchers In Search And Feed Views

### Task 7: Add the compilation button to search results

**Files:**
- Modify: `src/pages/SearchPage.tsx`
- Modify: `src/pages/SearchPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('renders a play-all button for video search results and navigates with source context', async () => {
  renderSearchPageWithVideos();

  const button = await screen.findByRole('button', { name: /play all as compilation/i });
  await user.click(button);

  expect(mockNavigate).toHaveBeenCalledWith(
    expect.stringContaining('/watch?play=compilation&source=search')
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/SearchPage.test.tsx`
Expected: FAIL because no trigger exists

- [ ] **Step 3: Write minimal implementation**

```tsx
const compilationUrl = searchQuery.trim()
  ? buildCompilationPlaybackUrl({
      source: 'search',
      query: searchQuery,
      filter: activeFilter,
      sort: sortMode,
      start: 0,
      returnTo: `${location.pathname}${location.search}`,
    })
  : null;

{compilationUrl && activeFilter !== 'users' && activeFilter !== 'hashtags' && videoResults.length > 0 && (
  <Button onClick={() => navigate(compilationUrl)}>Play all as compilation</Button>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/SearchPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/SearchPage.tsx src/pages/SearchPage.test.tsx
git commit -m "feat: add search compilation launcher"
```

### Task 8: Add the compilation button to feed-backed lists

**Files:**
- Modify: `src/components/VideoFeed.tsx`
- Create: `src/components/VideoFeed.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('renders a compilation launcher for eligible feed-backed sources', async () => {
  render(<VideoFeed feedType="classics" viewMode="grid" mode="thumbnail" />);
  expect(await screen.findByRole('button', { name: /play all as compilation/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/VideoFeed.test.tsx`
Expected: FAIL because no trigger exists

- [ ] **Step 3: Write minimal implementation**

```tsx
const canPlayCompilation = filteredVideos.length > 0;
const compilationUrl = canPlayCompilation
  ? buildCompilationPlaybackUrl({
      source: feedType,
      hashtag,
      pubkey,
      category,
      sort: sortMode,
      start: 0,
      returnTo: `${location.pathname}${location.search}`,
    })
  : null;

{compilationUrl && (
  <Button variant="outline" size="sm" onClick={() => navigate(compilationUrl)}>
    Play all as compilation
  </Button>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/VideoFeed.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/VideoFeed.tsx src/components/VideoFeed.test.tsx
git commit -m "feat: add feed compilation launcher"
```

## Chunk 5: End-To-End Verification

### Task 9: Run targeted verification for compilation playback

**Files:**
- Verify: `src/lib/compilationPlayback.test.ts`
- Verify: `src/hooks/useCompilationSource.test.tsx`
- Verify: `src/components/CompilationPlayerSurface.test.tsx`
- Verify: `src/pages/WatchPage.test.tsx`
- Verify: `src/pages/SearchPage.test.tsx`
- Verify: `src/components/VideoFeed.test.tsx`

- [ ] **Step 1: Run the targeted test suite**

Run:

```bash
npx vitest run \
  src/lib/compilationPlayback.test.ts \
  src/hooks/useCompilationSource.test.tsx \
  src/components/CompilationPlayerSurface.test.tsx \
  src/pages/WatchPage.test.tsx \
  src/pages/SearchPage.test.tsx \
  src/components/VideoFeed.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run full repo verification**

Run: `npm run test`
Expected: PASS with only pre-existing warnings

- [ ] **Step 3: Commit the final implementation**

```bash
git add src AppRouter.tsx docs/superpowers/plans/2026-04-16-compilation-playback.md
git commit -m "feat: add compilation playback mode"
```
