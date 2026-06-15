import type { ParsedVideoData } from '@/types/video';
import { fetchVideoModerationStatus } from '@/lib/videoVerification';

const moderationAgeGateCache = new Map<string, boolean>();

export async function enrichAgeRestrictedVideos(
  videos: ParsedVideoData[],
  signal?: AbortSignal,
): Promise<ParsedVideoData[]> {
  return Promise.all(videos.map(async (video) => {
    if (video.ageRestricted === true) {
      return video;
    }

    if (!video.sha256) {
      return video;
    }

    const cached = moderationAgeGateCache.get(video.sha256);
    if (cached !== undefined) {
      return cached ? { ...video, ageRestricted: true } : video;
    }

    const status = await fetchVideoModerationStatus(video.sha256, signal);
    if (!status) {
      return video;
    }

    moderationAgeGateCache.set(video.sha256, status.ageRestricted === true);

    return status.ageRestricted === true
      ? { ...video, ageRestricted: true }
      : video;
  }));
}
