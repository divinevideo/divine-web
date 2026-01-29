// ABOUTME: Horizontal scrollable row of classic Vine creators
// ABOUTME: Shows popular Viners with avatars, names, and links to their profiles

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Star } from 'lucide-react';
import { fetchClassicViners } from '@/lib/funnelcakeClient';
import { DEFAULT_FUNNELCAKE_URL } from '@/config/relays';
import { useInfiniteVideosFunnelcake } from '@/hooks/useInfiniteVideosFunnelcake';
import { useBatchedAuthors } from '@/hooks/useBatchedAuthors';
import { genUserName } from '@/lib/genUserName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { debugLog } from '@/lib/debug';
import { nip19 } from 'nostr-tools';
import type { FunnelcakeViner } from '@/types/funnelcake';
import type { NostrMetadata } from '@nostrify/nostrify';

interface VinerProfile {
  pubkey: string;
  name?: string;
  picture?: string;
  totalLoops: number;
  videoCount: number;
}

/**
 * Hook to fetch classic viners from Funnelcake API
 * Falls back to extracting unique authors from classic videos
 */
function useClassicViners() {

  // Primary: Try to fetch from dedicated viners endpoint
  const vinersQuery = useQuery({
    queryKey: ['classic-viners'],
    queryFn: async ({ signal }) => {
      try {
        const viners = await fetchClassicViners(DEFAULT_FUNNELCAKE_URL, 20, signal);
        debugLog('[ClassicVinersRow] Fetched viners from API:', viners.length);
        return viners;
      } catch (err) {
        debugLog('[ClassicVinersRow] Viners endpoint not available, will use fallback');
        throw err;
      }
    },
    staleTime: 300000, // 5 minutes
    gcTime: 1800000,   // 30 minutes
    retry: 1,
  });

  // Fallback: Extract unique authors from classic videos
  const videosQuery = useInfiniteVideosFunnelcake({
    feedType: 'classics',
    pageSize: 100,  // Fetch more to get diverse authors
    enabled: vinersQuery.isError, // Only fetch if viners endpoint failed
  });

  // Derive viners from videos when viners endpoint fails
  const derivedViners = useMemo(() => {
    if (!vinersQuery.isError || !videosQuery.data) return null;

    const videos = videosQuery.data.pages.flatMap(p => p.videos);
    const vinerMap = new Map<string, VinerProfile>();

    videos.forEach(video => {
      const existing = vinerMap.get(video.pubkey);
      if (existing) {
        existing.totalLoops += video.loopCount || 0;
        existing.videoCount += 1;
        // Update name/picture if we have it and existing doesn't
        if (!existing.name && video.authorName) existing.name = video.authorName;
        if (!existing.picture && video.authorAvatar) existing.picture = video.authorAvatar;
      } else {
        vinerMap.set(video.pubkey, {
          pubkey: video.pubkey,
          name: video.authorName,
          picture: video.authorAvatar,
          totalLoops: video.loopCount || 0,
          videoCount: 1,
        });
      }
    });

    // Sort by total loops and take top 20
    const viners = Array.from(vinerMap.values())
      .sort((a, b) => b.totalLoops - a.totalLoops)
      .slice(0, 20);

    debugLog('[ClassicVinersRow] Derived viners from videos:', viners.length);
    return viners;
  }, [vinersQuery.isError, videosQuery.data]);

  // Combine results
  const viners: VinerProfile[] | null = vinersQuery.data
    ? vinersQuery.data.map((v: FunnelcakeViner) => ({
        pubkey: v.pubkey,
        name: v.name,
        picture: v.picture,
        totalLoops: v.total_loops,
        videoCount: v.video_count,
      }))
    : derivedViners;

  return {
    viners,
    isLoading: vinersQuery.isLoading || (vinersQuery.isError && videosQuery.isLoading),
    isError: vinersQuery.isError && videosQuery.isError,
  };
}

/**
 * Single viner avatar item
 */
function VinerItem({
  viner,
  metadata,
}: {
  viner: VinerProfile;
  metadata?: NostrMetadata;
}) {
  const displayName = metadata?.display_name || metadata?.name || viner.name || genUserName(viner.pubkey);
  const picture = getSafeProfileImage(metadata?.picture || viner.picture) || '/user-avatar.png';

  // Use npub for URL
  let profilePath = `/profile/${viner.pubkey}`;
  try {
    const npub = nip19.npubEncode(viner.pubkey);
    profilePath = `/profile/${npub}`;
  } catch {
    // Fall back to hex pubkey
  }

  return (
    <Link
      to={profilePath}
      className="flex flex-col items-center gap-1.5 min-w-[72px] group"
    >
      <Avatar className="h-14 w-14 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all">
        <AvatarImage src={picture} alt={displayName} />
        <AvatarFallback className="text-xs">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground truncate max-w-[70px] group-hover:text-foreground transition-colors">
        {displayName}
      </span>
    </Link>
  );
}

/**
 * Loading skeleton for viner items
 */
function VinerSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
      <Skeleton className="h-14 w-14 rounded-full" />
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

/**
 * ClassicVinersRow - Horizontal scrollable row of popular Vine creators
 *
 * Displays avatars of classic Viners that users can click to visit their profiles.
 * Data comes from Funnelcake API's viners endpoint, with fallback to extracting
 * unique authors from classic videos.
 */
export function ClassicVinersRow() {
  const { viners, isLoading, isError } = useClassicViners();

  // Fetch author metadata for all viners
  const pubkeys = useMemo(() => viners?.map(v => v.pubkey) || [], [viners]);
  const { data: authorsMap } = useBatchedAuthors(pubkeys);

  // Don't render if error or no viners
  if (isError) {
    return null;
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Star className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Classic Viners</h3>
      </div>

      {/* Scrollable row */}
      <div className="relative group">
        {/* Scroll hint gradients */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Scrollable container */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
          {isLoading ? (
            // Loading skeletons
            <>
              {[...Array(8)].map((_, i) => (
                <VinerSkeleton key={i} />
              ))}
            </>
          ) : viners && viners.length > 0 ? (
            // Viner items
            viners.map((viner) => (
              <VinerItem
                key={viner.pubkey}
                viner={viner}
                metadata={authorsMap?.[viner.pubkey]?.metadata}
              />
            ))
          ) : (
            // Empty state
            <div className="flex items-center justify-center w-full py-4 text-sm text-muted-foreground">
              No classic Viners found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClassicVinersRow;
