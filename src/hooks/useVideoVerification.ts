// ABOUTME: Resolves the mobile-style verification badge for a video
// ABOUTME: Looks up AI labels by event/hash and falls back to the moderation service for Divine-hosted media

import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { NostrFilter } from '@nostrify/nostrify';
import type { ParsedVideoData } from '@/types/video';
import {
  DIVINE_MODERATION_PUBKEY,
  fetchVideoModerationStatus,
  getAIDetectionResultForEventId,
  getAIDetectionResultForHash,
  isOriginalVineVideo,
  isDivineHostedVideo,
  resolveAIDetectionHashKey,
  resolveModerationStatusSha256,
  resolveVideoVerificationBadge,
  shouldAutoFetchAiForBadge,
  type AIDetectionResult,
} from '@/lib/videoVerification';

interface UseVideoVerificationOptions {
  autoFetchAi?: boolean;
}

export function useVideoVerification(
  video: ParsedVideoData,
  options: UseVideoVerificationOptions = {},
) {
  const { nostr } = useNostr();
  const autoFetchAi = options.autoFetchAi ?? shouldAutoFetchAiForBadge(video);
  const aiHashKey = resolveAIDetectionHashKey(video);
  const moderationSha256 = resolveModerationStatusSha256(video);
  const isOriginalVine = isOriginalVineVideo(video);
  const isDivineHosted = isDivineHostedVideo(video.videoUrl);

  const aiQuery = useQuery<AIDetectionResult | null>({
    queryKey: ['video-ai-detection', video.id, aiHashKey ?? '', moderationSha256 ?? ''],
    queryFn: async ({ signal }) => {
      if (!nostr || isOriginalVine) return null;

      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
      const eventIdFilter: NostrFilter = {
        authors: [DIVINE_MODERATION_PUBKEY],
        kinds: [1985],
        '#e': [video.id],
        limit: 20,
      };

      const eventIdPromise = nostr.query([eventIdFilter], { signal: querySignal }).catch(() => []);
      const hashPromise = aiHashKey
        ? nostr.query(
            [{
              authors: [DIVINE_MODERATION_PUBKEY],
              kinds: [1985],
              '#x': [aiHashKey],
              limit: 20,
            }],
            { signal: querySignal },
          ).catch(() => [])
        : Promise.resolve([]);
      const moderationPromise = isDivineHosted && moderationSha256
        ? fetchVideoModerationStatus(moderationSha256, signal)
        : Promise.resolve(null);

      const [eventIdEvents, hashEvents, moderationStatus] = await Promise.all([
        eventIdPromise,
        hashPromise,
        moderationPromise,
      ]);

      const eventIdResult = getAIDetectionResultForEventId(eventIdEvents, video.id);
      if (eventIdResult) {
        return eventIdResult;
      }

      if (aiHashKey) {
        const hashResult = getAIDetectionResultForHash(hashEvents, aiHashKey);
        if (hashResult) {
          return hashResult;
        }
      }

      if (moderationStatus?.aiScore != null) {
        return {
          score: moderationStatus.aiScore,
          source: 'moderation-service',
          isVerified: false,
        };
      }

      return null;
    },
    enabled: autoFetchAi && !!nostr && !isOriginalVine,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const badge = useMemo(
    () => resolveVideoVerificationBadge(video, aiQuery.data),
    [video, aiQuery.data],
  );

  return {
    ...aiQuery,
    aiResult: aiQuery.data ?? null,
    badge,
  };
}
