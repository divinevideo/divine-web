// ABOUTME: Profile header component showing user avatar, bio, stats, and follow button
// ABOUTME: Displays user metadata, social stats, and follow/unfollow functionality

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserPlus, UserCheck, CheckCircle, Pencil, Copy, MoreVertical, Flag, Play, Repeat, Loader2, XCircle } from 'lucide-react';
import { ReportContentDialog } from '@/components/ReportContentDialog';
import { useNip05Validation } from '@/hooks/useNip05Validation';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { toast } from '@/hooks/useToast';
import { nip19 } from 'nostr-tools';
import type { NostrMetadata } from '@nostrify/nostrify';

export interface ProfileStats {
  videosCount: number;
  totalViews: number;       // Total video views/impressions
  totalLoops: number;       // Total loops (watch time / video duration)
  totalReactions: number;   // Total likes/reactions received
  joinedDate: Date | null;
  followersCount: number;
  followingCount: number;
  // Classic Vine stats (original counts from Vine era)
  originalLoopCount?: number;  // Sum of all original Vine loop counts
  isClassicViner?: boolean;    // Whether this user has classic Vine content
}

interface ProfileMetadata extends NostrMetadata {
  _stillLoadingName?: boolean;  // Flag to indicate name is still being fetched
}

interface ProfileHeaderProps {
  pubkey: string;
  metadata?: ProfileMetadata;
  stats?: ProfileStats;
  isOwnProfile: boolean;
  isFollowing: boolean;
  onFollowToggle: (shouldFollow: boolean) => void;
  onEditProfile?: () => void;
  isLoading?: boolean;
  className?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + 'K';
  }
  return num.toString();
}

function formatJoinedDate(date: Date | null, isClassicViner?: boolean): string {
  // Classic Viners show their status unless they've reclaimed their account
  if (isClassicViner && !date) return 'Classic Viner';

  if (!date) return 'Recently joined';

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
  };

  return `Joined ${date.toLocaleDateString('en-US', options)}`;
}

export function ProfileHeader({
  pubkey,
  metadata,
  stats,
  isOwnProfile,
  isFollowing,
  onFollowToggle,
  onEditProfile,
  isLoading: _isLoading = false,
  className,
}: ProfileHeaderProps) {
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Validate NIP-05 - show with visual feedback based on validation state
  const { state: nip05State } = useNip05Validation(
    metadata?.nip05,
    pubkey
  );
  const nip05 = metadata?.nip05;

  // Get npub for fallback display
  const npub = nip19.npubEncode(pubkey);
  const shortNpub = `${npub.slice(0, 8)}...${npub.slice(-4)}`;

  // Check if we're still waiting for name to load
  const stillLoadingName = metadata?._stillLoadingName ?? false;

  // Don't show generated placeholder names - show real data or truncated npub
  // Only use display_name/name if they exist in metadata (not generated)
  const hasRealName = metadata?.display_name || metadata?.name;
  const displayName = hasRealName || shortNpub;
  const userName = metadata?.name;
  const profileImage = getSafeProfileImage(metadata?.picture) || '/user-avatar.png';
  const about = metadata?.about;
  const website = metadata?.website;

  const handleFollowClick = () => {
    onFollowToggle(!isFollowing);
  };

  const handleCopyNpub = async () => {
    try {
      const npub = nip19.npubEncode(pubkey);
      await navigator.clipboard.writeText(npub);
      toast({
        title: "Copied!",
        description: "npub copied to clipboard",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Failed to copy npub to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className={`space-y-4 ${className || ''}`}
      data-testid="profile-header"
    >
      {/* Main Profile Section */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        {/* Avatar */}
        <div className="flex-shrink-0 self-center sm:self-start">
          <Avatar className="h-20 w-20 sm:h-24 sm:w-24" data-testid="profile-avatar">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback className="text-lg">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Profile Info */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="space-y-2">
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                {stillLoadingName ? (
                  <Skeleton className="h-8 w-32 sm:h-9 sm:w-40" data-testid="name-loading-skeleton" />
                ) : (
                  <h1 className="text-2xl sm:text-3xl font-bold truncate">
                    {displayName}
                  </h1>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCopyNpub}
                  title="Copy npub"
                  data-testid="copy-npub-button"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {/* Show NIP-05 with visual feedback based on validation state */}
              {nip05 ? (
                <div className="flex items-center gap-1 justify-center sm:justify-start">
                  {/* Icon based on validation state */}
                  {nip05State === 'loading' && (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  )}
                  {nip05State === 'valid' && (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  )}
                  {nip05State === 'invalid' && (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}

                  {/* NIP-05 text with styling based on state */}
                  <Link
                    to={`/u/${encodeURIComponent(nip05)}`}
                    className={`text-sm font-medium hover:underline ${
                      nip05State === 'valid'
                        ? 'text-primary'
                        : nip05State === 'invalid'
                          ? 'text-muted-foreground line-through'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {/* Format NIP-05 for display: _@domain → @domain, user@domain → @user@domain */}
                    {nip05.startsWith('_@') ? `@${nip05.slice(2)}` : `@${nip05}`}
                  </Link>
                </div>
              ) : userName && userName !== displayName ? (
                <p className="text-muted-foreground text-sm">@{userName}</p>
              ) : null}
            </div>

            {/* Website - hide if it's just a divine.video profile URL */}
            {website && !website.includes('divine.video/profile/') && (
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <Badge variant="outline" className="text-xs">
                  <a href={website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {website}
                  </a>
                </Badge>
              </div>
            )}

            {/* Bio */}
            {about && (
              <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
                {about}
              </p>
            )}
          </div>
        </div>

        {/* Edit Profile / Follow Button */}
        {isOwnProfile ? (
          <div className="flex-shrink-0 self-center sm:self-start">
            <Button
              onClick={onEditProfile}
              variant="outline"
              size="sm"
              className="min-w-[100px]"
              data-testid="edit-profile-button"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          </div>
        ) : (
          <div className="flex-shrink-0 self-center sm:self-start flex gap-2">
            <Button
              onClick={handleFollowClick}
              variant={isFollowing ? "outline" : "default"}
              size="sm"
              className="min-w-[100px]"
              data-testid="follow-button"
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Following
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Follow
                </>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="profile-menu-button">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowReportDialog(true)}>
                  <Flag className="h-4 w-4 mr-2" />
                  Report user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Stats Section */}
      <div
        className="grid grid-cols-2 sm:grid-cols-5 gap-4 py-4 border-t"
        data-testid="profile-stats"
      >
        {/* Videos Count */}
        <div className="text-center">
          {stats ? (
            <>
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {formatNumber(stats.videosCount)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Videos</div>
            </>
          ) : (
            <>
              <Skeleton className="h-6 w-12 mx-auto mb-1" data-testid="stat-skeleton-videos" />
              <div className="text-xs sm:text-sm text-muted-foreground">Videos</div>
            </>
          )}
        </div>

        {/* Followers Count */}
        <div className="text-center">
          {stats ? (
            <>
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {formatNumber(stats.followersCount)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Followers</div>
            </>
          ) : (
            <>
              <Skeleton className="h-6 w-12 mx-auto mb-1" data-testid="stat-skeleton-followers" />
              <div className="text-xs sm:text-sm text-muted-foreground">Followers</div>
            </>
          )}
        </div>

        {/* Following Count */}
        <div className="text-center">
          {stats ? (
            <>
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {formatNumber(stats.followingCount)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Following</div>
            </>
          ) : (
            <>
              <Skeleton className="h-6 w-12 mx-auto mb-1" data-testid="stat-skeleton-following" />
              <div className="text-xs sm:text-sm text-muted-foreground">Following</div>
            </>
          )}
        </div>

        {/* diVine Loops (actual loop count from watch time) */}
        <div className="text-center">
          {stats ? (
            <>
              <div className="text-xl sm:text-2xl font-bold text-primary">
                {formatNumber(stats.totalLoops)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">diVine Loops</div>
            </>
          ) : (
            <>
              <Skeleton className="h-6 w-12 mx-auto mb-1" data-testid="stat-skeleton-loops" />
              <div className="text-xs sm:text-sm text-muted-foreground">diVine Loops</div>
            </>
          )}
        </div>

        {/* Joined Date / Classic Viner Status */}
        <div className="text-center col-span-2 sm:col-span-1">
          {stats ? (
            <>
              <div className="text-xs sm:text-sm text-muted-foreground"
              title={
                stats.joinedDate
                  ? stats.joinedDate.toLocaleString()
                  : undefined
              }>
                {formatJoinedDate(stats.joinedDate, stats.isClassicViner)}
              </div>
            </>
          ) : (
            <>
              <Skeleton className="h-4 w-20 mx-auto" data-testid="stat-skeleton-joined" />
            </>
          )}
        </div>
      </div>

      {/* Classic Viner Stats - Original Vine Metrics */}
      {stats?.isClassicViner && stats.originalLoopCount && stats.originalLoopCount > 0 && (
        <div
          className="bg-muted rounded-lg p-4 border border-brand-light-green"
          data-testid="classic-viner-stats"
        >
          <div className="flex items-center gap-2 mb-3">
            <Repeat className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Classic Vine Stats</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Play className="h-4 w-4 text-muted-foreground" />
                <span className="text-xl sm:text-2xl font-bold text-foreground">
                  {formatNumber(stats.originalLoopCount)}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Original Vine Loops</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {formatNumber(stats.videosCount)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Classic Vines</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Stats from the original Vine platform (2013-2017)
          </p>
        </div>
      )}

      {/* Report User Dialog */}
      {showReportDialog && (
        <ReportContentDialog
          open={showReportDialog}
          onClose={() => setShowReportDialog(false)}
          pubkey={pubkey}
          contentType="user"
        />
      )}
    </div>
  );
}