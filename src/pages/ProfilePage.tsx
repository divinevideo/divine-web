// ABOUTME: Enhanced profile page with header, stats, video grid, and follow functionality
// ABOUTME: Displays user profile with comprehensive social features and responsive video grid

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useSeoMeta } from '@unhead/react';
import { Grid, List, Loader2 } from 'lucide-react';
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
import { useVideoProvider } from '@/hooks/useVideoProvider';
import { useFunnelcakeProfile } from '@/hooks/useFunnelcakeProfile';
import { useFollowRelationship, useFollowUser, useUnfollowUser } from '@/hooks/useFollowRelationship';
import { useFollowListSafetyCheck } from '@/hooks/useFollowListSafetyCheck';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import { debugLog } from '@/lib/debug';

export function ProfilePage() {
  const { npub, nip19: nip19Param } = useParams<{ npub?: string; nip19?: string }>();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [safetyDialogOpen, setSafetyDialogOpen] = useState(false);
  const [pendingFollowAction, setPendingFollowAction] = useState<boolean | null>(null);
  const { user: currentUser } = useCurrentUser();

  // Get the identifier from route params, or from subdomain user if rendered at /
  const subdomainUser = getSubdomainUser();
  const identifier = npub || nip19Param || subdomainUser?.npub;

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
      } else {
        // Assume it's already a hex pubkey
        pubkey = identifier;
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
    pubkey: pubkey || '',
    enabled: !!pubkey,
  });
  const videos = videosData?.pages?.flatMap(p => p.videos) || [];

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

  // Use Funnelcake stats (fast) - don't run expensive Nostr queries
  // Funnelcake already has: video_count, follower_count, following_count, total_reactions, total_loops
  // Calculate classic viner stats from videos (loop counts are in the video data)
  const originalLoopCount = videos?.reduce((sum, v) => sum + (v.loopCount || 0), 0) || 0;
  const isClassicViner = originalLoopCount > 0 || (funnelcakeProfile?.total_loops ? funnelcakeProfile.total_loops > 0 : false);

  const stats = {
    videosCount: funnelcakeProfile?.video_count ?? videos.length,
    followersCount: funnelcakeProfile?.follower_count ?? 0,
    followingCount: funnelcakeProfile?.following_count ?? 0,
    totalViews: funnelcakeProfile?.total_reactions ?? 0,
    totalLoops: funnelcakeProfile?.total_loops ?? 0,
    totalReactions: funnelcakeProfile?.total_reactions ?? 0,
    joinedDate: null, // Could fetch from Nostr later if needed
    isClassicViner,
    originalLoopCount: funnelcakeProfile?.total_loops ?? originalLoopCount,
  };
  const statsLoading = funnelcakeLoading;

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

  // Get displayName for SEO - use real name or truncated npub, never generated placeholders
  const encodedNpub = pubkey ? nip19.npubEncode(pubkey) : null;
  const shortNpub = encodedNpub ? `${encodedNpub.slice(0, 12)}...` : 'User';
  const displayName = metadata?.display_name || metadata?.name || shortNpub;

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

        {/* Content Section */}
        <div className="space-y-4">
          {/* View Mode Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Videos</h2>
              <p className="text-muted-foreground text-sm">
                {videosLoading ? 'Loading...' : `${stats.videosCount} videos`} from {displayName}
              </p>
            </div>

            <div className="flex items-center gap-2">
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