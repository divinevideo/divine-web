// ABOUTME: Renders the video grid for a kind-30005 video curation list
// ABOUTME: Accepts a pre-fetched VideoList and handles video fetching + display

import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useRemoveVideoFromList, type PlayOrder } from '@/hooks/useVideoLists';
import { VideoGrid } from '@/components/VideoGrid';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VideoCamera as Video, DotsThreeVertical as MoreVertical, Trash as Trash2 } from '@phosphor-icons/react';
import { useToast } from '@/hooks/useToast';
import type { NostrFilter } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND, VIDEO_KINDS, type ParsedVideoData } from '@/types/video';
import { parseVideoEvent, getVineId, getThumbnailUrl, getOriginalVineTimestamp, getLoopCount, getProofModeData, getOriginalLikeCount, getOriginalRepostCount, getOriginalCommentCount, getOriginPlatform, isVineMigrated } from '@/lib/videoParser';
import type { NostrEvent } from '@nostrify/nostrify';

interface VideoList {
  id: string;
  name: string;
  description?: string;
  image?: string;
  pubkey: string;
  createdAt: number;
  videoCoordinates: string[];
  public: boolean;
  tags?: string[];
  isCollaborative?: boolean;
  allowedCollaborators?: string[];
  thumbnailEventId?: string;
  playOrder?: PlayOrder;
}

async function fetchListVideos(
  nostr: { query: (filters: NostrFilter[], options: { signal: AbortSignal }) => Promise<NostrEvent[]> },
  coordinates: string[],
  signal: AbortSignal
): Promise<ParsedVideoData[]> {
  if (coordinates.length === 0) return [];

  const filters: NostrFilter[] = [];
  const coordinateMap = new Map<string, { pubkey: string; dTag: string }>();

  coordinates.forEach(coord => {
    const [kind, pubkey, dTag] = coord.split(':');
    const kindNum = parseInt(kind, 10);
    if (VIDEO_KINDS.includes(kindNum) && pubkey && dTag) {
      coordinateMap.set(`${pubkey}:${dTag}`, { pubkey, dTag });
    }
  });

  const pubkeyGroups = new Map<string, string[]>();
  coordinateMap.forEach(({ pubkey, dTag }) => {
    if (!pubkeyGroups.has(pubkey)) {
      pubkeyGroups.set(pubkey, []);
    }
    pubkeyGroups.get(pubkey)!.push(dTag);
  });

  pubkeyGroups.forEach((dTags, pubkey) => {
    filters.push({
      kinds: VIDEO_KINDS,
      authors: [pubkey],
      '#d': dTags,
      limit: dTags.length
    });
  });

  if (filters.length === 0) return [];

  const events = await nostr.query(filters, { signal });

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
      reposts: []
    });
  });

  const orderedVideos: ParsedVideoData[] = [];
  coordinates.forEach(coord => {
    const [, pubkey, dTag] = coord.split(':');
    const key = `${pubkey}:${dTag}`;
    const video = videoMap.get(key);
    if (video) {
      orderedVideos.push(video);
    }
  });

  return orderedVideos;
}

interface VideoListContentProps {
  list: VideoList;
  pubkey: string;
  dTag: string;
}

export function VideoListContent({ list, pubkey, dTag }: VideoListContentProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const removeVideo = useRemoveVideoFromList();

  const isOwner = user?.pubkey === pubkey;
  const canEdit = isOwner; // TODO: Add collaborator check

  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ['list-videos', pubkey, dTag, list.videoCoordinates],
    queryFn: async (context) => {
      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(10000)
      ]);

      return fetchListVideos(nostr, list.videoCoordinates, signal);
    },
    enabled: true
  });

  if (videosLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded" />
        ))}
      </div>
    );
  }

  if (videos && videos.length > 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-4">Videos in this list</h2>

        {canEdit ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {videos.map((video) => {
              const videoCoord = `${video.kind}:${video.pubkey}:${video.vineId}`;
              return (
                <div key={video.id} className="relative group">
                  <VideoGrid
                    videos={[video]}
                    navigationContext={{
                      source: 'profile',
                      pubkey: list.pubkey,
                    }}
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              await removeVideo.mutateAsync({
                                listId: list.id,
                                videoCoordinate: videoCoord
                              });
                              toast({
                                title: 'Video removed',
                                description: 'Video removed from list',
                              });
                            } catch {
                              toast({
                                title: 'Error',
                                description: 'Failed to remove video',
                                variant: 'destructive',
                              });
                            }
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove from list
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <VideoGrid
            videos={videos}
            navigationContext={{
              source: 'profile',
              pubkey: list.pubkey,
            }}
          />
        )}
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">
          This list doesn't have any videos yet
        </p>
        {isOwner && (
          <p className="text-sm text-muted-foreground mt-2">
            Browse videos and add them to your list
          </p>
        )}
      </CardContent>
    </Card>
  );
}
