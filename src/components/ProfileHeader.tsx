// ABOUTME: Profile header component showing user avatar, bio, stats, and follow button
// ABOUTME: Displays user metadata, social stats, and follow/unfollow functionality

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getDivineNip05Info } from '@/lib/nip05Utils';
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
import { UserPlus, UserCheck, CheckCircle, Pencil, Copy, MoreVertical, Flag, Play, Repeat, Loader2, XCircle, Link2, Code, Rss } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { feedUrls } from '@/lib/feedUrls';
import { useRssFeedAvailable } from '@/hooks/useRssFeedAvailable';
import { ReportContentDialog } from '@/components/ReportContentDialog';
import { UserListDialog } from '@/components/UserListDialog';
import { LinkedAccounts } from '@/components/LinkedAccounts';
import { useNip05Validation } from '@/hooks/useNip05Validation';
import { useFollowers, getAllFollowerPubkeys } from '@/hooks/useFollowers';
import { useFollowing } from '@/hooks/useFollowing';
import { useBadges } from '@/hooks/useBadges';
import { useDmCapability } from '@/hooks/useDirectMessages';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { ProfileBadges } from '@/components/ProfileBadges';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { genUserName } from '@/lib/genUserName';
import { toast } from '@/hooks/useToast';
import { nip19 } from 'nostr-tools';
import type { NostrMetadata } from '@nostrify/nostrify';
import { getDmConversationPath } from '@/lib/dm';

/** Linkify URLs and domain-like words in text */
function linkifyText(text: string): React.ReactNode[] {
  // Match URLs (https?://...) and bare domain names (word.tld patterns)
  const urlRegex = /(https?:\/\/[^\s]+)|(\b[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s]*)?)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const matchedText = match[0];
    const href = matchedText.startsWith('http') ? matchedText : `https://${matchedText}`;

    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {matchedText}
      </a>
    );

    lastIndex = match.index + matchedText.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export interface ProfileStats {
  videosCount: number;
  totalViews: number;       // Total video views/impressions
  totalLoops: number;       // Total loops (watch time / video duration)
  totalReactions: number;   // Total likes/reactions received
  joinedDate: Date | null;
  joinedDateLoading?: boolean;
  followersCount: number;
  followingCount: number;
  // Classic Vine stats (original counts from Vine era)
  originalLoopCount?: number;  // Sum of all original Vine loop counts
  isClassicViner?: boolean;    // Whether this user has classic Vine content
  classicVineCount?: number;   // Number of Vine-migrated videos
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
  const navigate = useNavigate();
  const subdomainNavigate = useSubdomainNavigate();
  const rssFeedAvailable = useRssFeedAvailable();
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [userListDialog, setUserListDialog] = useState<'followers' | 'following' | null>(null);
  const { canUseDirectMessages } = useDmCapability();

  // Fetch followers/following when dialog is open
  const followersQuery = useFollowers(userListDialog === 'followers' ? pubkey : '');
  const followingQuery = useFollowing(userListDialog === 'following' ? pubkey : '');
  const followerPubkeys = getAllFollowerPubkeys(followersQuery.data);
  const followingPubkeys = followingQuery.data?.pubkeys ?? [];

  // Fetch NIP-58 badges
  const badgesQuery = useBadges(pubkey);

  // Validate NIP-05 - show with visual feedback based on validation state
  const { state: nip05State } = useNip05Validation(
    metadata?.nip05,
    pubkey
  );
  const nip05 = metadata?.nip05;

  // Check if we're still waiting for name to load
  const stillLoadingName = metadata?._stillLoadingName ?? false;

  const hasRealName = metadata?.display_name || metadata?.name;
  const displayName = hasRealName || genUserName(pubkey);
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
      className={`app-surface space-y-5 px-4 py-5 sm:px-6 sm:py-6 ${className || ''}`}
      data-testid="profile-header"
    >
      {/* Main Profile Section */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Avatar */}
        <div className="flex-shrink-0 self-center lg:self-start">
          <Avatar size="2xl" className="h-24 w-24 rounded-[30px] sm:h-28 sm:w-28 sm:rounded-[34px]" data-testid="profile-avatar">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback className="text-lg">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Profile Info */}
        <div className="min-w-0 flex-1 text-center lg:text-left">
          <div className="lg:flex lg:gap-6">
            {/* Left: Name, NIP-05, Website, Bio */}
            <div className="space-y-3 lg:min-w-0 lg:flex-1">
              <div>
                <div className="flex items-center justify-center gap-2 lg:justify-start">
                  {stillLoadingName ? (
                    <Skeleton className="h-8 w-32 sm:h-9 sm:w-40" data-testid="name-loading-skeleton" />
                  ) : (
                    <h1 className="truncate text-[1.9rem] font-semibold tracking-[-0.03em] sm:text-[2.3rem]">
                      {displayName}
                    </h1>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full"
                    onClick={handleCopyNpub}
                    title="Copy npub"
                    data-testid="copy-npub-button"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {/* Show NIP-05 with visual feedback based on validation state */}
                {nip05 ? (
                  <div className="flex items-center justify-center gap-1 lg:justify-start">
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
                    {(() => {
                      const divineInfo = getDivineNip05Info(nip05);
                      const className = `text-sm font-medium hover:underline ${
                        nip05State === 'valid'
                          ? 'text-primary'
                          : nip05State === 'invalid'
                            ? 'text-muted-foreground line-through'
                            : 'text-muted-foreground'
                      }`;
                      const displayText = divineInfo
                        ? divineInfo.displayName
                        : nip05.startsWith('_@') ? `@${nip05.slice(2)}` : `@${nip05}`;

                      return divineInfo ? (
                        <a
                          href={divineInfo.href}
                          className={className}
                        >
                          {displayText}
                        </a>
                      ) : (
                        <Link
                          to={`/u/${encodeURIComponent(nip05)}`}
                          className={className}
                        >
                          {displayText}
                        </Link>
                      );
                    })()}
                  </div>
                ) : userName && userName !== displayName ? (
                  <p className="text-muted-foreground text-sm">@{userName}</p>
                ) : null}
              </div>

              {/* Website - hide if it's just a divine.video profile URL */}
              {website && !website.includes('divine.video/profile/') && (
                <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
                  <Badge variant="outline" className="rounded-full border-white/50 bg-[hsl(var(--surface-1)/0.86)] px-3 py-1 text-xs dark:border-white/10">
                    <a href={website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {website}
                    </a>
                  </Badge>
                </div>
              )}

              {/* Bio */}
              {about && (
                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {linkifyText(about)}
                </p>
              )}
            </div>

          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <LinkedAccounts pubkey={pubkey} />
            <ProfileBadges badges={badgesQuery.data ?? []} />
          </div>
        </div>

        {/* Edit Profile / Follow Button */}
        {isOwnProfile ? (
          <div className="flex w-full flex-shrink-0 flex-wrap justify-center gap-2 lg:w-auto lg:justify-end">
            <Button
              onClick={onEditProfile}
              variant="outline"
              size="sm"
              className="min-w-[120px] rounded-full"
              data-testid="edit-profile-button"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
            <Link to="/settings/linked-accounts">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                data-testid="linked-accounts-button"
              >
                <Link2 className="w-4 h-4 mr-2" />
                Linked Accounts
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full" data-testid="own-profile-menu-button">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/get-embed?npub=${nip19.npubEncode(pubkey)}`)}>
                  <Code className="h-4 w-4 mr-2" />
                  Get embed code
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex w-full flex-shrink-0 flex-wrap justify-center gap-2 lg:w-auto lg:justify-end">
            <Button
              onClick={handleFollowClick}
              variant={isFollowing ? "outline" : "default"}
              size="sm"
              className="min-w-[120px] rounded-full"
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
            {canUseDirectMessages && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => subdomainNavigate(getDmConversationPath([pubkey]))}
              >
                Message
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full" data-testid="profile-menu-button">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/get-embed?npub=${nip19.npubEncode(pubkey)}`)}>
                  <Code className="h-4 w-4 mr-2" />
                  Get embed code
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowReportDialog(true)}>
                  <Flag className="h-4 w-4 mr-2" />
                  Report user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {rssFeedAvailable && (
              <a
                href={feedUrls.userVideos(nip19.npubEncode(pubkey))}
                target="_blank"
                rel="noopener noreferrer"
                title="Subscribe to RSS feed"
                className="inline-flex items-center justify-center rounded-full border border-white/45 bg-[hsl(var(--surface-1)/0.86)] p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent dark:border-white/10"
              >
                <Rss className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Stats Section */}
      <div
        className="grid grid-cols-2 gap-3 border-t border-border/70 pt-4 sm:grid-cols-5"
        data-testid="profile-stats"
      >
      {/* Videos Count */}
        <div className="rounded-[22px] border border-[hsl(var(--surface-border)/0.8)] bg-[hsl(var(--surface-2)/0.75)] px-3 py-4 text-center">
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
        <div className="rounded-[22px] border border-[hsl(var(--surface-border)/0.8)] bg-[hsl(var(--surface-2)/0.75)] px-3 py-4 text-center">
          {stats ? (
            <button
              className="w-full transition-opacity hover:opacity-70"
              onClick={() => setUserListDialog('followers')}
              data-testid="followers-button"
            >
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {formatNumber(stats.followersCount)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Followers</div>
            </button>
          ) : (
            <>
              <Skeleton className="h-6 w-12 mx-auto mb-1" data-testid="stat-skeleton-followers" />
              <div className="text-xs sm:text-sm text-muted-foreground">Followers</div>
            </>
          )}
        </div>

        {/* Following Count */}
        <div className="rounded-[22px] border border-[hsl(var(--surface-border)/0.8)] bg-[hsl(var(--surface-2)/0.75)] px-3 py-4 text-center">
          {stats ? (
            <button
              className="w-full transition-opacity hover:opacity-70"
              onClick={() => setUserListDialog('following')}
              data-testid="following-button"
            >
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {formatNumber(stats.followingCount)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Following</div>
            </button>
          ) : (
            <>
              <Skeleton className="h-6 w-12 mx-auto mb-1" data-testid="stat-skeleton-following" />
              <div className="text-xs sm:text-sm text-muted-foreground">Following</div>
            </>
          )}
        </div>

        {/* diVine Loops (actual loop count from watch time) */}
        <div className="rounded-[22px] border border-[hsl(var(--surface-border)/0.8)] bg-[hsl(var(--surface-2)/0.75)] px-3 py-4 text-center">
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
        <div className="col-span-2 rounded-[22px] border border-[hsl(var(--surface-border)/0.8)] bg-[hsl(var(--surface-2)/0.75)] px-3 py-4 text-center sm:col-span-1">
          {stats ? (
            stats.joinedDateLoading ? (
              <Skeleton className="h-4 w-20 mx-auto" data-testid="stat-skeleton-joined" />
            ) : (
              <div className="text-xs sm:text-sm text-muted-foreground"
              title={
                stats.joinedDate
                  ? stats.joinedDate.toLocaleString()
                  : undefined
              }>
                {formatJoinedDate(stats.joinedDate, stats.isClassicViner)}
              </div>
            )
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
          className="app-surface-muted border border-brand-light-green p-4"
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
                {formatNumber(stats.classicVineCount ?? stats.videosCount)}
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

      {/* Followers / Following Dialog */}
      <UserListDialog
        open={userListDialog === 'followers'}
        onOpenChange={(open) => !open && setUserListDialog(null)}
        title="Followers"
        pubkeys={followerPubkeys}
        isLoading={followersQuery.isLoading || followersQuery.isFetchingNextPage}
        hasMore={followersQuery.hasNextPage ?? false}
        onLoadMore={() => followersQuery.fetchNextPage()}
      />
      <UserListDialog
        open={userListDialog === 'following'}
        onOpenChange={(open) => !open && setUserListDialog(null)}
        title="Following"
        pubkeys={followingPubkeys}
        isLoading={followingQuery.isLoading}
      />
    </div>
  );
}
