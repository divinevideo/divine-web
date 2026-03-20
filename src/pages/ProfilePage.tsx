// ABOUTME: Enhanced profile page with header, stats, video grid, and follow functionality
// ABOUTME: Displays user profile with comprehensive social features and responsive video grid

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useHead, useSeoMeta } from '@unhead/react';
import { feedUrls } from '@/lib/feedUrls';
import { useRssFeedAvailable } from '@/hooks/useRssFeedAvailable';
import { Grid, List, Loader2 } from 'lucide-react';
import { PROFILE_SORT_MODES } from '@/lib/constants/sortModes';
import InfiniteScroll from 'react-infinite-scroll-component';
import { ProfileHeader } from '@/components/ProfileHeader';
import { VideoGrid } from '@/components/VideoGrid';
import { VideoFeed } from '@/components/VideoFeed';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EditProfileDialog } from '@/components/EditProfileDialog';
import { FollowListSafetyDialog } from '@/components/FollowListSafetyDialog';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getSubdomainUser } from '@/hooks/useSubdomainUser';
import { useResolveSubdomainPubkey } from '@/hooks/useResolveSubdomainPubkey';
import { useVideoProvider } from '@/hooks/useVideoProvider';
import { useFunnelcakeProfile } from '@/hooks/useFunnelcakeProfile';
import { useProfileJoinedDate } from '@/hooks/useProfileJoinedDate';
import { useClassicVineArchiveStats } from '@/hooks/useClassicVineArchiveStats';
import { useFollowRelationship, useFollowUser, useUnfollowUser } from '@/hooks/useFollowRelationship';
import { useFollowListSafetyCheck } from '@/hooks/useFollowListSafetyCheck';
import { PinnedVideosSection } from '@/components/PinnedVideosSection';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import { debugLog } from '@/lib/debug';
import { getDivineNip05Info } from '@/lib/nip05Utils';
import { useNip05Validation } from '@/hooks/useNip05Validation';
import { genUserName } from '@/lib/genUserName';
import { parseLegacySocials } from '@/lib/legacySocials';
import { buildProfileStats } from '@/lib/profileStats';
import type { SortMode } from '@/types/nostr';

export function ProfilePage() {
  const { npub, nip19: nip19Param } = useParams<{ npub?: string; nip19?: string }>();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<SortMode | undefined>(undefined);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [safetyDialogOpen, setSafetyDialogOpen] = useState(false);
  const [pendingFollowAction, setPendingFollowAction] = useState<boolean | null>(null);
  const { user: currentUser } = useCurrentUser();

  // Get the identifier from route params, or from subdomain user if rendered at /
  const subdomainUser = getSubdomainUser();
  const resolved = useResolveSubdomainPubkey();
  // Use resolved pubkey when KV store mapping is stale
  const identifier = npub || nip19Param || (resolved.isResolved ? resolved.npub : subdomainUser?.npub);

  // Decode npub to get pubkey
  let pubkey: string | null = null;
  let error: string | null = null;

  if (identifier) {
    try {
      if (identifier.startsWith('npub1')) {
        const decoded = nip19.decode(identifier);
        if (decoded.type === 'npub') {
          pubkey = decoded.data;
        } else {
          error = 'Invalid npub format';
        }
      } else if (/^[0-9a-fA-F]{64}$/.test(identifier)) {
        // Valid 64-char hex pubkey
        pubkey = identifier;
      } else {
        error = 'Invalid profile identifier';
      }
    } catch {
      error = 'Invalid npub format';
    }
  } else {
    error = 'No user identifier provided';
  }

  // Fetch profile data from Funnelcake REST API (fast) - includes profile metadata AND stats
  const { data: funnelcakeProfile, isLoading: funnelcakeLoading } = useFunnelcakeProfile(pubkey || '', !!pubkey);

  // Fetch profile data from Nostr relays (slower, but more authoritative)
  const { data: authorData, isLoading: authorLoading } = useAuthor(pubkey || '');

  // Fetch videos for profile using Funnelcake (fast, includes cached author data)
  const {
    data: videosData,
    isLoading: videosLoading,
    error: videosError,
    fetchNextPage,
    hasNextPage,
  } = useVideoProvider({
    feedType: 'profile',
    sortMode,
    pubkey: pubkey || '',
    enabled: !!pubkey,
  });
  // Deduplicate videos by pubkey:kind:d-tag (addressable event key)
  // The API may return duplicate rows for the same video
  const videos = useMemo(() => {
    const all = videosData?.pages?.flatMap(p => p.videos) ?? [];
    const seen = new Set<string>();
    return all.filter(video => {
      const key = `${video.pubkey}:${video.kind}:${video.vineId || video.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [videosData]);

  // Data source priority:
  // 1. Funnelcake (fast REST API) - use if available
  // 2. Nostr relays (WebSocket) - fallback for users not in Funnelcake
  const nostrMeta = authorData?.metadata;
  const fcMeta = funnelcakeProfile;

  // Check if we have a real name from either source
  const hasNameFromFunnelcake = !!(fcMeta?.display_name || fcMeta?.name);
  const hasNameFromNostr = !!(nostrMeta?.display_name || nostrMeta?.name);

  // Still loading name if: no name from either source AND either query is still in progress
  const stillLoadingName = !hasNameFromFunnelcake && !hasNameFromNostr && (funnelcakeLoading || authorLoading);

  // Build metadata object - prefer Funnelcake (fast) then Nostr
  const metadata = {
    display_name: fcMeta?.display_name || nostrMeta?.display_name,
    name: fcMeta?.name || nostrMeta?.name,
    picture: fcMeta?.picture || nostrMeta?.picture || '/user-avatar.png',
    about: fcMeta?.about || nostrMeta?.about,
    banner: fcMeta?.banner || nostrMeta?.banner,
    nip05: fcMeta?.nip05 || nostrMeta?.nip05,
    website: fcMeta?.website || nostrMeta?.website,
    lud16: fcMeta?.lud16 || nostrMeta?.lud16,
    // Flag to indicate name is still loading (used by ProfileHeader)
    _stillLoadingName: stillLoadingName,
  };

  // Redirect to subdomain if user has a verified divine.video NIP-05 and we're on the apex domain
  const nip05 = metadata.nip05;
  const nip05Validation = useNip05Validation(
    !subdomainUser ? nip05 : undefined,
    pubkey || '',
  );
  useEffect(() => {
    // Only redirect if we're on the apex domain (not already on a subdomain)
    if (subdomainUser) return;
    if (!nip05) return;
    // Only redirect after NIP-05 is verified to belong to this pubkey
    if (!nip05Validation.isValid) return;

    const divineInfo = getDivineNip05Info(nip05);
    if (divineInfo) {
      debugLog('[ProfilePage] Redirecting to subdomain:', divineInfo.href);
      window.location.href = divineInfo.href;
    }
  }, [nip05, subdomainUser, nip05Validation.isValid]);

  // Use actual loaded video count once all pages are loaded (API video_count may be inflated by dups)
  const allLoaded = !hasNextPage && videos.length > 0;
  const totalVideoCount = funnelcakeProfile?.video_count ?? videos.length;
  const joinedDateQuery = useProfileJoinedDate(pubkey || '', {
    videos,
    totalVideoCount,
    allVideosLoaded: allLoaded,
    enabled: !!pubkey,
  });
  const archiveStatsQuery = useClassicVineArchiveStats(
    pubkey || '',
    !!pubkey && (videos.length > 0 || (funnelcakeProfile?.video_count ?? 0) > 0)
  );
  const stats = useMemo(() => buildProfileStats({
    funnelcakeProfile,
    loadedVideos: videos,
    archiveStats: archiveStatsQuery.data,
    joinedDate: joinedDateQuery.data ?? null,
    joinedDateLoading: joinedDateQuery.isLoading,
    hasNextPage,
  }), [
    archiveStatsQuery.data,
    funnelcakeProfile,
    hasNextPage,
    joinedDateQuery.data,
    joinedDateQuery.isLoading,
    videos,
  ]);
  const statsLoading = funnelcakeLoading;
  const legacySocials = useMemo(() => (
    stats.isClassicViner
      ? parseLegacySocials({
          displayName: metadata.display_name,
          name: metadata.name,
          about: metadata.about,
          website: metadata.website,
        })
      : []
  ), [
    metadata.about,
    metadata.display_name,
    metadata.name,
    metadata.website,
    stats.isClassicViner,
  ]);

  // Follow relationship data
  const { data: followData, isLoading: followLoading } = useFollowRelationship(pubkey || '');
  const { mutateAsync: followUser, isPending: isFollowing } = useFollowUser();
  const { mutateAsync: unfollowUser, isPending: isUnfollowing } = useUnfollowUser();
  const { openLoginDialog } = useLoginDialog();

  // Safety check for follow list
  const { data: safetyCheck } = useFollowListSafetyCheck(
    currentUser?.pubkey,
    !!currentUser?.pubkey // Only check if user is logged in
  );

  // Check if this is the current user's own profile
  const isOwnProfile = currentUser?.pubkey === pubkey;

  const displayName = metadata?.display_name || metadata?.name || (pubkey ? genUserName(pubkey) : 'User');

  // RSS auto-discovery link for feed readers (only if feed endpoints exist)
  const rssFeedAvailable = useRssFeedAvailable();
  const profileNpub = pubkey ? nip19.npubEncode(pubkey) : '';
  useHead({
    link: rssFeedAvailable && profileNpub ? [
      {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: `${displayName}'s Videos - diVine`,
        href: feedUrls.userVideos(profileNpub),
      },
    ] : [],
  });

  // Dynamic SEO meta tags for social sharing
  useSeoMeta({
    title: `${displayName} - diVine`,
    description: metadata?.about || `${displayName}'s profile on diVine`,
    ogTitle: `${displayName} - diVine Profile`,
    ogDescription: metadata?.about || `${displayName}'s profile on diVine`,
    ogImage: metadata?.picture || '/app_icon.avif',
    ogType: 'profile',
    twitterCard: 'summary',
    twitterTitle: `${displayName} - diVine`,
    twitterDescription: metadata?.about || `${displayName}'s profile on diVine`,
    twitterImage: metadata?.picture || '/app_icon.avif',
  });

  // Show spinner while resolving stale subdomain mapping
  if (resolved.isSearching && subdomainUser?.nip05Stale) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !pubkey) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold mb-4">Invalid Profile</h2>
              <p className="text-muted-foreground">
                {error || 'Unable to load profile'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Handle follow/unfollow
  const handleFollowToggle = async (shouldFollow: boolean) => {
    if (!currentUser) {
      openLoginDialog();
      return;
    }

    debugLog('[ProfilePage] ========================================');
    debugLog('[ProfilePage] Follow toggle clicked');
    debugLog('[ProfilePage] Should follow?', shouldFollow);
    debugLog('[ProfilePage] Safety check data:', safetyCheck);
    debugLog('[ProfilePage] ========================================');

    // Check if we need to show safety warning
    if (shouldFollow && safetyCheck?.needsWarning) {
      debugLog('[ProfilePage] ⚠️  Safety check triggered - showing warning dialog');
      setPendingFollowAction(true);
      setSafetyDialogOpen(true);
      return;
    }

    debugLog('[ProfilePage] ✅ No safety warning needed, proceeding with follow');

    // Proceed with follow/unfollow action
    await executeFollowAction(shouldFollow);
  };

  // Execute the actual follow/unfollow action
  const executeFollowAction = async (shouldFollow: boolean) => {
    try {
      if (shouldFollow) {
        await followUser({
          targetPubkey: pubkey,
          currentContactList: followData?.contactListEvent || null,
          targetDisplayName: displayName,
        });
      } else {
        await unfollowUser({
          targetPubkey: pubkey,
          currentContactList: followData?.contactListEvent || null,
        });
      }
    } catch (error) {
      console.error('Failed to update follow status:', error);
    }
  };

  // Handle safety dialog confirmation
  const handleSafetyConfirm = async () => {
    setSafetyDialogOpen(false);
    if (pendingFollowAction !== null) {
      await executeFollowAction(pendingFollowAction);
      setPendingFollowAction(null);
    }
  };

  // Handle safety dialog cancellation
  const handleSafetyCancel = () => {
    setSafetyDialogOpen(false);
    setPendingFollowAction(null);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile Header */}
        <ProfileHeader
          pubkey={pubkey}
          metadata={metadata}
          stats={stats}
          legacySocials={legacySocials}
          isOwnProfile={isOwnProfile}
          isFollowing={followData?.isFollowing || false}
          onFollowToggle={handleFollowToggle}
          onEditProfile={() => setEditProfileOpen(true)}
          isLoading={statsLoading || followLoading || isFollowing || isUnfollowing}
        />

        {/* Edit Profile Dialog */}
        {isOwnProfile && (
          <EditProfileDialog
            open={editProfileOpen}
            onOpenChange={setEditProfileOpen}
          />
        )}

        {/* Follow List Safety Dialog */}
        <FollowListSafetyDialog
          open={safetyDialogOpen}
          onConfirm={handleSafetyConfirm}
          onCancel={handleSafetyCancel}
          targetUserName={displayName}
        />

        {/* Pinned Videos */}
        <PinnedVideosSection pubkey={pubkey} isOwnProfile={isOwnProfile} />

        {/* Content Section */}
        <div className="space-y-4">
          {/* View Mode Toggle + Sort */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Videos</h2>
              <p className="text-muted-foreground text-sm">
                {videosLoading ? 'Loading...' : `${stats.videosCount} videos`} from {displayName}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Sort Mode */}
              <div className="flex items-center gap-1">
                {PROFILE_SORT_MODES.map(mode => {
                  const ModeIcon = mode.icon;
                  const isSelected = sortMode === mode.value;
                  return (
                    <button
                      key={mode.label}
                      onClick={() => setSortMode(mode.value as SortMode)}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                        ${isSelected
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-brand-light-green dark:bg-brand-dark-green hover:bg-muted text-muted-foreground hover:text-foreground'
                        }
                      `}
                      data-testid={`sort-${mode.label.toLowerCase().replace(' ', '-')}`}
                    >
                      <ModeIcon className="h-3.5 w-3.5" />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* View Mode */}
              <div className="flex items-center gap-1 border-l pl-3">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  data-testid="grid-view-button"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  data-testid="list-view-button"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Videos Display */}
          {videosLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : videosError ? (
            <Card className="border-destructive">
              <CardContent className="py-12 text-center">
                <p className="text-destructive mb-4">Failed to load videos</p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Try again
                </Button>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <InfiniteScroll
              dataLength={videos.length}
              next={fetchNextPage}
              hasMore={hasNextPage ?? false}
              loader={
                <div className="h-16 flex items-center justify-center col-span-full">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Loading more videos...</span>
                  </div>
                </div>
              }
              endMessage={
                videos.length > 10 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground col-span-full">
                    <p>You've seen all {stats.videosCount} videos</p>
                  </div>
                ) : null
              }
            >
              <VideoGrid
                videos={videos || []}
                loading={videosLoading}
                className="min-h-[200px]"
                navigationContext={{
                  source: 'profile',
                  pubkey: pubkey || undefined,
                }}
              />
            </InfiniteScroll>
          ) : (
            <VideoFeed
              feedType="profile"
              sortMode={sortMode}
              pubkey={pubkey}
              data-testid="video-feed-profile"
              data-profile-testid={`feed-profile-${identifier}`}
              className="space-y-6"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
