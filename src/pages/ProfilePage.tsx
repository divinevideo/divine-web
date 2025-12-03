// ABOUTME: Enhanced profile page with header, stats, video grid, and follow functionality
// ABOUTME: Displays user profile with comprehensive social features and responsive video grid

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useSeoMeta } from '@unhead/react';
import { Grid, List, Loader2 } from 'lucide-react';
import { ProfileHeader } from '@/components/ProfileHeader';
import { VideoGrid } from '@/components/VideoGrid';
import { VideoFeed } from '@/components/VideoFeed';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EditProfileDialog } from '@/components/EditProfileDialog';
import { FollowListSafetyDialog } from '@/components/FollowListSafetyDialog';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useVideoEvents } from '@/hooks/useVideoEvents';
import { useProfileStats } from '@/hooks/useProfileStats';
import { useFollowRelationship, useFollowUser, useUnfollowUser } from '@/hooks/useFollowRelationship';
import { useFollowListSafetyCheck } from '@/hooks/useFollowListSafetyCheck';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import { genUserName } from '@/lib/genUserName';
import { enhanceAuthorData } from '@/lib/generateProfile';
import { debugLog } from '@/lib/debug';

export function ProfilePage() {
  const { npub, nip19: nip19Param } = useParams<{ npub?: string; nip19?: string }>();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [safetyDialogOpen, setSafetyDialogOpen] = useState(false);
  const [pendingFollowAction, setPendingFollowAction] = useState<boolean | null>(null);
  const { user: currentUser } = useCurrentUser();

  // Get the identifier from either route param
  const identifier = npub || nip19Param;

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

  // Fetch profile data
  const { data: authorData } = useAuthor(pubkey || '');
  const author = pubkey ? enhanceAuthorData(authorData, pubkey) : null;
  const metadata = author?.metadata;

  // Fetch ALL videos for profile (no limit)
  const { data: videos, isLoading: videosLoading, error: videosError } = useVideoEvents({
    feedType: 'profile',
    pubkey: pubkey || '',
  });

  // Fetch profile statistics - pass videos to calculate totalViews
  const { data: stats, isLoading: statsLoading } = useProfileStats(pubkey || '', videos);

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

  // Get displayName for SEO
  const displayName = metadata?.display_name || metadata?.name || (pubkey ? genUserName(pubkey) : 'User');

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
                {videosLoading ? 'Loading...' : `${videos?.length || 0} videos`} from {displayName}
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
            <VideoGrid
              videos={videos || []}
              loading={videosLoading}
              className="min-h-[200px]"
              navigationContext={{
                source: 'profile',
                pubkey: pubkey || undefined,
              }}
            />
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