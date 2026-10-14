// ABOUTME: Displays a user's pinned videos on their profile page
// ABOUTME: Resolves video coordinates from pin list into compact video cards

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { PushPin as Pin, PushPinSlash as PinOff } from '@phosphor-icons/react';
import { usePinnedVideos, useUnpinVideo } from '@/hooks/usePinnedVideos';
import { VideoGrid } from '@/components/VideoGrid';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { buildPinnedVideoFilters, resolvePinnedVideosFromEvents } from '@/lib/pinnedVideoResolution';
import { parseVideoCoordinate } from '@/lib/videoCoordinates';
import { VIDEO_KINDS, type ParsedVideoData } from '@/types/video';

interface PinnedVideosSectionProps {
  pubkey: string;
  isOwnProfile: boolean;
}

export function PinnedVideosSection({ pubkey, isOwnProfile }: PinnedVideosSectionProps) {
  const { t } = useTranslation();
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

      const filters = buildPinnedVideoFilters(coordinates);
      if (filters.length === 0) return [];

      const events = await nostr.query(filters, { signal });
      return resolvePinnedVideosFromEvents(coordinates, events);
    },
    enabled: coordinates.length > 0,
    staleTime: 60000,
    gcTime: 300000,
  });

  // Memoize the coordinate lookup for unpin
  const coordinateForVideo = useMemo(() => {
    const map = new Map<string, string>();
    coordinates.forEach(coord => {
      const coordinate = parseVideoCoordinate(coord, VIDEO_KINDS);
      if (coordinate) map.set(coordinate.dTag, coord);
    });
    return map;
  }, [coordinates]);

  const handleUnpin = async (video: ParsedVideoData) => {
    const coord = video.vineId ? coordinateForVideo.get(video.vineId) : null;
    if (!coord) return;

    try {
      await unpinVideo({ coordinate: coord });
      toast({ title: t('pinnedVideosSection.unpinnedTitle'), description: t('pinnedVideosSection.unpinnedDescription', { title: video.title || t('pinnedVideosSection.fallbackVideoTitle') }) });
    } catch {
      toast({ title: t('pinnedVideosSection.unpinErrorTitle'), description: t('pinnedVideosSection.unpinErrorDescription'), variant: 'destructive' });
    }
  };

  // Don't render anything if no pins (or still loading and no cached data)
  if (coordinates.length === 0 && !coordsLoading) return null;
  if (coordsLoading && coordinates.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Pin className="h-4 w-4 text-muted-foreground" />
        <SectionHeader as="h3" className="text-sm text-muted-foreground">{t('pinnedVideosSection.heading')}</SectionHeader>
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
                  {t('pinnedVideosSection.unpin')}
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
