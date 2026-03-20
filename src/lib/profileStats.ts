import type { FunnelcakeProfile } from '@/lib/funnelcakeClient';
import type { ParsedVideoData } from '@/types/video';

export interface ProfileStats {
  videosCount: number;
  totalViews: number;
  totalLoops: number;
  totalReactions: number;
  joinedDate: Date | null;
  joinedDateLoading?: boolean;
  followersCount: number;
  followingCount: number;
  originalLoopCount?: number;
  isClassicViner?: boolean;
  classicVineCount?: number;
}

interface ArchiveStats {
  classicVineCount: number;
  originalLoopCount: number;
}

export interface BuildProfileStatsInput {
  funnelcakeProfile?: FunnelcakeProfile | null;
  loadedVideos: ParsedVideoData[];
  archiveStats?: ArchiveStats | null;
  joinedDate: Date | null;
  joinedDateLoading?: boolean;
  hasNextPage?: boolean;
}

export function buildProfileStats(input: BuildProfileStatsInput): ProfileStats {
  const loadedClassicVideos = input.loadedVideos.filter((video) => video.isVineMigrated);
  const fallbackClassicVineCount = loadedClassicVideos.length;
  const fallbackOriginalLoopCount = loadedClassicVideos.reduce(
    (sum, video) => sum + (video.loopCount ?? 0),
    0
  );

  const classicVineCount = input.archiveStats?.classicVineCount ?? fallbackClassicVineCount;
  const originalLoopCount = input.archiveStats?.originalLoopCount ?? fallbackOriginalLoopCount;
  const isClassicViner = classicVineCount > 0;
  const allLoaded = !input.hasNextPage && input.loadedVideos.length > 0;

  return {
    videosCount: allLoaded
      ? input.loadedVideos.length
      : (input.funnelcakeProfile?.video_count ?? input.loadedVideos.length),
    followersCount: input.funnelcakeProfile?.follower_count ?? 0,
    followingCount: input.funnelcakeProfile?.following_count ?? 0,
    totalViews: input.funnelcakeProfile?.total_views ?? 0,
    totalLoops: Math.floor(input.funnelcakeProfile?.total_loops ?? 0),
    totalReactions: input.funnelcakeProfile?.total_reactions ?? 0,
    joinedDate: input.joinedDate,
    joinedDateLoading: input.joinedDateLoading,
    isClassicViner,
    classicVineCount,
    originalLoopCount,
  };
}
