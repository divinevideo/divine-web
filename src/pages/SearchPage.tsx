// ABOUTME: Comprehensive search page with debounced input, filter tabs, infinite scroll, and sort modes
// ABOUTME: Supports searching videos, users, hashtags with NIP-50 full-text search

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useSeoMeta } from '@unhead/react';
import { Search, Hash, Users, Video } from 'lucide-react';
import { trackSearch } from '@/lib/analytics';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VideoCard } from '@/components/VideoCard';
import { Loader2 } from 'lucide-react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { useInfiniteSearchVideos } from '@/hooks/useInfiniteSearchVideos';
import { useSearchUsers } from '@/hooks/useSearchUsers';
import { useSearchHashtags } from '@/hooks/useSearchHashtags';
import { genUserName } from '@/lib/genUserName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import type { SortMode } from '@/types/nostr';
import { SEARCH_SORT_MODES as SORT_MODES } from '@/lib/constants/sortModes';

type SearchFilter = 'all' | 'videos' | 'users' | 'hashtags';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sortMode, setSortMode] = useState<SortMode | 'relevance'>(
    (searchParams.get('sort') as SortMode | 'relevance') || 'relevance'
  );
  const [activeFilter, setActiveFilter] = useState<SearchFilter>(
    (searchParams.get('filter') as SearchFilter) || 'all'
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Video search with infinite scroll and NIP-50
  const {
    data: videoData,
    fetchNextPage: fetchNextVideos,
    hasNextPage: hasNextVideos,
    isLoading: isLoadingVideos,
    error: videoError,
  } = useInfiniteSearchVideos({
    query: searchQuery,
    sortMode,
    pageSize: 20,
  });

  const videoResults = videoData?.pages.flatMap(page => page.videos) ?? [];

  const {
    data: userResults = [],
    isLoading: isLoadingUsers,
    error: userError,
  } = useSearchUsers({
    query: searchQuery,
    limit: 20,
  });

  const {
    data: hashtagResults = [],
    isLoading: isLoadingHashtags,
    error: hashtagError,
  } = useSearchHashtags({
    query: searchQuery,
    limit: 20,
  });

  // Popular hashtags for suggestions
  const {
    data: popularHashtags = [],
  } = useSearchHashtags({
    query: '',
    limit: 10,
  });

  useSeoMeta({
    title: searchQuery ? `Search: ${searchQuery} - diVine Web` : 'Search - diVine Web',
    description: 'Search for videos, users, and hashtags on Divine Web',
  });

  // Debounced URL update - only update URL after user stops typing for 300ms
  // This prevents analytics from firing on every keystroke
  const debouncedSearchQuery = useRef(searchQuery);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer to update URL after 300ms of no typing
    debounceTimerRef.current = setTimeout(() => {
      debouncedSearchQuery.current = searchQuery;
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (sortMode !== 'relevance') params.set('sort', sortMode);
      if (activeFilter !== 'all') params.set('filter', activeFilter);
      setSearchParams(params, { replace: true });

      // Track search analytics when user stops typing
      if (searchQuery.trim()) {
        const totalResults = videoResults.length + userResults.length + hashtagResults.length;
        trackSearch(searchQuery, activeFilter, totalResults);
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, sortMode, activeFilter, setSearchParams, videoResults.length, userResults.length, hashtagResults.length]);

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    // Detect and redirect to npub/nprofile profiles
    const trimmedValue = value.trim();
    if (trimmedValue.startsWith('npub1') || trimmedValue.startsWith('nprofile1')) {
      try {
        const decoded = nip19.decode(trimmedValue);
        if (decoded.type === 'npub') {
          navigate(`/${trimmedValue}`);
          return;
        } else if (decoded.type === 'nprofile') {
          const npub = nip19.npubEncode(decoded.data.pubkey);
          navigate(`/${npub}`);
          return;
        }
      } catch {
        // Invalid npub/nprofile, continue with normal search
      }
    }

    setSearchQuery(value);
    setShowSuggestions(false);
  };

  // Handle hashtag suggestion click
  const handleHashtagClick = (hashtag: string) => {
    setSearchQuery(`#${hashtag}`);
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  // Handle filter tab change
  const handleFilterChange = (filter: SearchFilter) => {
    setActiveFilter(filter);
  };

  // Loading state based on active filter
  const isLoading = (() => {
    switch (activeFilter) {
      case 'videos':
        return isLoadingVideos;
      case 'users':
        return isLoadingUsers;
      case 'hashtags':
        return isLoadingHashtags;
      default:
        return isLoadingVideos || isLoadingUsers || isLoadingHashtags;
    }
  })();

  // Error state based on active filter
  const error = (() => {
    switch (activeFilter) {
      case 'videos':
        return videoError;
      case 'users':
        return userError;
      case 'hashtags':
        return hashtagError;
      default:
        return videoError || userError || hashtagError;
    }
  })();

  // Results count based on active filter
  const getResultsCount = () => {
    switch (activeFilter) {
      case 'videos':
        return videoResults.length;
      case 'users':
        return userResults.length;
      case 'hashtags':
        return hashtagResults.length;
      default:
        return videoResults.length + userResults.length + hashtagResults.length;
    }
  };

  // Check if we have any results
  const hasResults = videoResults.length > 0 || userResults.length > 0 || hashtagResults.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Main content */}
      <main className="container py-6">
        {/* Search bar with sort selector */}
        <div className="mb-6 flex-1 max-w-2xl mx-auto space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search for videos, users, or hashtags..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setShowSuggestions(!searchQuery.trim())}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="pl-10 pr-4"
              autoFocus
            />
          </div>

          {/* Sort mode selector for video results */}
          {(activeFilter === 'all' || activeFilter === 'videos') && searchQuery.trim() && (
            <div className="flex items-center gap-2 justify-end">
              <span className="text-sm text-muted-foreground">Sort:</span>
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_MODES.map(mode => (
                    <SelectItem key={mode.value} value={mode.value}>
                      <div className="flex items-center gap-2">
                        <mode.icon className="h-4 w-4" />
                        {mode.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Search suggestions dropdown */}
          {showSuggestions && popularHashtags.length > 0 && (
            <Card className="absolute top-full mt-1 w-full z-50 max-h-64 overflow-y-auto">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Popular Hashtags
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {popularHashtags.slice(0, 8).map((hashtag) => (
                    <Button
                      key={hashtag.tag}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleHashtagClick(hashtag.tag)}
                      className="h-auto px-2 py-1 text-xs"
                    >
                      #{hashtag.tag}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Search tabs */}
        <Tabs value={activeFilter} onValueChange={handleFilterChange} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-4 mb-6">
            <TabsTrigger value="all" className="gap-2">
              <Search className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">All</span>
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-2">
              <Video className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Videos</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="hashtags" className="gap-2">
              <Hash className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Hashtags</span>
            </TabsTrigger>
          </TabsList>

          {/* Results count */}
          {searchQuery.trim() && (
            <div className="text-center mb-4">
              {isLoading ? (
                <p className="text-muted-foreground">Searching...</p>
              ) : error ? (
                <p className="text-destructive">Search error occurred</p>
              ) : (
                <p className="text-muted-foreground">
                  {getResultsCount() === 0
                    ? 'No results found'
                    : `${getResultsCount()} ${
                        activeFilter === 'all'
                          ? 'results'
                          : activeFilter === 'videos'
                          ? 'videos'
                          : activeFilter === 'users'
                          ? 'users'
                          : 'hashtags'
                      } found`}
                </p>
              )}
            </div>
          )}

          {/* All results tab */}
          <TabsContent value="all" className="mt-0">
            {!searchQuery.trim() ? (
              <EmptySearchState />
            ) : isLoading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState />
            ) : !hasResults ? (
              <NoResultsState />
            ) : (
              <div className="space-y-8">
                {/* Videos section with infinite scroll */}
                {videoResults.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Video className="h-5 w-5" />
                        Videos ({videoResults.length}{hasNextVideos ? '+' : ''})
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveFilter('videos')}
                      >
                        View all
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {videoResults.slice(0, 6).map((video) => (
                        <VideoCard key={video.id} video={video} mode="thumbnail" />
                      ))}
                    </div>
                  </section>
                )}

                {/* Users section */}
                {userResults.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Users ({userResults.length})
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {userResults.slice(0, 6).map((user) => (
                        <UserCard key={user.pubkey} user={user} />
                      ))}
                    </div>
                    {userResults.length > 6 && (
                      <div className="text-center mt-4">
                        <Button
                          variant="outline"
                          onClick={() => setActiveFilter('users')}
                        >
                          View all {userResults.length} users
                        </Button>
                      </div>
                    )}
                  </section>
                )}

                {/* Hashtags section */}
                {hashtagResults.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      Hashtags ({hashtagResults.length})
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {hashtagResults.slice(0, 12).map((hashtag) => (
                        <HashtagCard
                          key={hashtag.tag}
                          hashtag={hashtag}
                          onClick={() => handleHashtagClick(hashtag.tag)}
                        />
                      ))}
                    </div>
                    {hashtagResults.length > 12 && (
                      <div className="text-center mt-4">
                        <Button
                          variant="outline"
                          onClick={() => setActiveFilter('hashtags')}
                        >
                          View all {hashtagResults.length} hashtags
                        </Button>
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </TabsContent>

          {/* Videos only tab with infinite scroll */}
          <TabsContent value="videos" className="mt-0">
            {!searchQuery.trim() ? (
              <EmptySearchState />
            ) : isLoadingVideos ? (
              <LoadingState />
            ) : videoError ? (
              <ErrorState />
            ) : videoResults.length === 0 ? (
              <NoResultsState />
            ) : (
              <InfiniteScroll
                dataLength={videoResults.length}
                next={fetchNextVideos}
                hasMore={hasNextVideos ?? false}
                loader={
                  <div className="py-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  </div>
                }
                endMessage={
                  videoResults.length > 10 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      <p>No more results</p>
                    </div>
                  ) : null
                }
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {videoResults.map((video) => (
                    <VideoCard key={video.id} video={video} mode="thumbnail" />
                  ))}
                </div>
              </InfiniteScroll>
            )}
          </TabsContent>

          {/* Users only tab */}
          <TabsContent value="users" className="mt-0">
            {!searchQuery.trim() ? (
              <EmptySearchState />
            ) : isLoadingUsers ? (
              <LoadingState />
            ) : userError ? (
              <ErrorState />
            ) : userResults.length === 0 ? (
              <NoResultsState />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {userResults.map((user) => (
                  <UserCard key={user.pubkey} user={user} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Hashtags only tab */}
          <TabsContent value="hashtags" className="mt-0">
            {!searchQuery.trim() ? (
              <EmptySearchState />
            ) : isLoadingHashtags ? (
              <LoadingState />
            ) : hashtagError ? (
              <ErrorState />
            ) : hashtagResults.length === 0 ? (
              <NoResultsState />
            ) : (
              <div className="flex flex-wrap gap-2">
                {hashtagResults.map((hashtag) => (
                  <HashtagCard
                    key={hashtag.tag}
                    hashtag={hashtag}
                    onClick={() => handleHashtagClick(hashtag.tag)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

interface UserCardMetadata {
  display_name?: string;
  name?: string;
  about?: string;
  picture?: string;
}

// User card component
function UserCard({ user }: { user: { pubkey: string; metadata?: UserCardMetadata } }) {
  const navigate = useNavigate();
  const displayName = user.metadata?.display_name || user.metadata?.name || genUserName(user.pubkey);
  const username = user.metadata?.name || genUserName(user.pubkey);
  const about = user.metadata?.about;
  const picture = getSafeProfileImage(user.metadata?.picture);
  const npub = nip19.npubEncode(user.pubkey);

  const handleClick = () => {
    navigate(`/${npub}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`View profile of ${displayName}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={picture} alt={displayName} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{displayName}</h3>
            <p className="text-sm text-muted-foreground truncate">@{username}</p>
            {about && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {about}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Hashtag card component
function HashtagCard({
  hashtag,
  onClick
}: {
  hashtag: { tag: string; count: number };
  onClick: () => void;
}) {
  return (
    <Badge
      variant="secondary"
      className="cursor-pointer hover:bg-secondary/80 px-3 py-1"
      onClick={onClick}
    >
      #{hashtag.tag}
      <span className="ml-2 text-xs opacity-70">{hashtag.count} videos</span>
    </Badge>
  );
}

// Loading state component
function LoadingState() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Empty search state
function EmptySearchState() {
  return (
    <div className="text-center py-12">
      <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">Search Divine Web</h3>
      <p className="text-muted-foreground mb-4">
        Find videos, users, and hashtags across the Nostr network
      </p>
      <p className="text-sm text-muted-foreground">
        Try searching for #dance, #music, or any creator's name
      </p>
    </div>
  );
}

// No results state
function NoResultsState() {
  return (
    <div className="col-span-full">
      <Card className="border-dashed">
        <CardContent className="py-12 px-8 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <Search className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground mb-4">
                Try different keywords
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Error state
function ErrorState() {
  return (
    <div className="col-span-full">
      <Card className="border-destructive/50">
        <CardContent className="py-12 px-8 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <div className="text-destructive">
              <Search className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Search Error</h3>
              <p className="text-sm">
                Something went wrong while searching. Please try again.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SearchPage;
