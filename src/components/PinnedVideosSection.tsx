// ABOUTME: Displays a user's pinned videos on their profile page
// ABOUTME: Resolves video coordinates from pin list into compact video cards

import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { Pin, PinOff } from 'lucide-react';
import { usePinnedVideos, useUnpinVideo } from '@/hooks/usePinnedVideos';
import { VideoGrid } from '@/components/VideoGrid';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { parseVideoEvent, getVineId, getThumbnailUrl, getOriginalVineTimestamp, getLoopCount, getProofModeData, getOriginPlatform, isVineMigrated, getOriginalLikeCount, getOriginalRepostCount, getOriginalCommentCount } from '@/lib/videoParser';
import { SHORT_VIDEO_KIND, VIDEO_KINDS } from '@/types/video';
import type { ParsedVideoData } from '@/types/video';
import type { NostrFilter } from '@nostrify/nostrify';

interface PinnedVideosSectionProps {
  pubkey: string;
  isOwnProfile: boolean;
}

export function PinnedVideosSection({ pubkey, isOwnProfile }: PinnedVideosSectionProps) {
  const { nostr } = useNostr();
  const { data: coordinates = [], isLoading: coordsLoading } = usePinnedVideos(pubkey);
  const { mutateAsync: unpinVideo } = useUnpinVideo();
  const { toast } = useToast();

  // Resolve coordinates to video events via Nostr query
  const { data: pinnedVideos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['pinned-video-data', coordinates],
    queryFn: async (context) => {
      if (coordinates.length === 0) return [];

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(8000),
      ]);

      // Parse coordinates into pubkey + d-tag groups
      const pubkeyGroups = new Map<string, string[]>();
      coordinates.forEach(coord => {
        const [kind, pk, dTag] = coord.split(':');
        const kindNum = parseInt(kind, 10);
        if (VIDEO_KINDS.includes(kindNum) && pk && dTag) {
          if (!pubkeyGroups.has(pk)) pubkeyGroups.set(pk, []);
          pubkeyGroups.get(pk)!.push(dTag);
        }
      });

      // Build filters grouped by pubkey
      const filters: NostrFilter[] = [];
      pubkeyGroups.forEach((dTags, pk) => {
        filters.push({
          kinds: VIDEO_KINDS,
          authors: [pk],
          '#d': dTags,
          limit: dTags.length,
        });
      });

      if (filters.length === 0) return [];

      const events = await nostr.query(filters, { signal });

      // Parse events into a map keyed by pubkey:d-tag
      const videoMap = new Map<string, ParsedVideoData>();
      events.forEach(event => {
        const vineId = getVineId(event);
        if (!vineId) return;

        const videoEvent = parseVideoEvent(event);
        if (!videoEvent?.videoMetadata?.url) return;

        const key = `${event.pubkey}:${vineId}`;
        videoMap.set(key, {
          id: event.id,
          pubkey: event.pubkey,
          kind: SHORT_VIDEO_KIND,
          createdAt: event.created_at,
          originalVineTimestamp: getOriginalVineTimestamp(event),
          content: event.content,
          videoUrl: videoEvent.videoMetadata.url,
          fallbackVideoUrls: videoEvent.videoMetadata?.fallbackUrls,
          hlsUrl: videoEvent.videoMetadata?.hlsUrl,
          thumbnailUrl: getThumbnailUrl(videoEvent),
          title: videoEvent.title,
          duration: videoEvent.videoMetadata?.duration,
          hashtags: videoEvent.hashtags || [],
          vineId,
          loopCount: getLoopCount(event),
          likeCount: getOriginalLikeCount(event),
          repostCount: getOriginalRepostCount(event),
          commentCount: getOriginalCommentCount(event),
          proofMode: getProofModeData(event),
          origin: getOriginPlatform(event),
          isVineMigrated: isVineMigrated(event),
          reposts: [],
        });
      });

      // Return in pin-list order, skipping unresolvable coordinates
      const ordered: ParsedVideoData[] = [];
      coordinates.forEach(coord => {
        const parts = coord.split(':');
        const key = `${parts[1]}:${parts[2]}`;
        const video = videoMap.get(key);
        if (video) ordered.push(video);
      });

      return ordered;
    },
    enabled: coordinates.length > 0,
    staleTime: 60000,
    gcTime: 300000,
  });

  // Memoize the coordinate lookup for unpin
  const coordinateForVideo = useMemo(() => {
    const map = new Map<string, string>();
    coordinates.forEach(coord => {
      const parts = coord.split(':');
      // Map vineId (d-tag) to full coordinate for unpin
      map.set(parts[2], coord);
    });
    return map;
  }, [coordinates]);

  const handleUnpin = async (video: ParsedVideoData) => {
    const coord = video.vineId ? coordinateForVideo.get(video.vineId) : null;
    if (!coord) return;

    try {
      await unpinVideo({ coordinate: coord });
      toast({ title: 'Unpinned', description: `"${video.title || 'Video'}" removed from pinned` });
    } catch {
      toast({ title: 'Error', description: 'Failed to unpin video', variant: 'destructive' });
    }
  };

  // Don't render anything if no pins (or still loading and no cached data)
  if (coordinates.length === 0 && !coordsLoading) return null;
  if (coordsLoading && coordinates.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Pin className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pinned</h3>
      </div>

      {videosLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {coordinates.map((_, i) => (
            <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : pinnedVideos.length > 0 ? (
        <div className="relative">
          <VideoGrid
            videos={pinnedVideos}
            navigationContext={{ source: 'profile', pubkey }}
          />
          {/* Unpin overlay buttons for own profile */}
          {isOwnProfile && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
              {pinnedVideos.map(video => (
                <Button
                  key={video.id}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => handleUnpin(video)}
                >
                  <PinOff className="h-3 w-3 mr-1" />
                  Unpin
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
