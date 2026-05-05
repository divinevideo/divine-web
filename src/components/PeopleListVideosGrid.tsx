// ABOUTME: Displays an aggregated video grid for all members of a NIP-51 people list
// ABOUTME: Filters muted authors via useContentModeration before rendering VideoGrid

import { useMemo } from 'react';
import { usePeopleListMemberVideos } from '@/hooks/usePeopleListMemberVideos';
import { useContentModeration } from '@/hooks/useModeration';
import { VideoGrid } from '@/components/VideoGrid';
import { Card, CardContent } from '@/components/ui/card';
import { parseVideoEvents } from '@/lib/videoParser';

interface Props {
  pubkey: string;
  dTag: string;
}

export function PeopleListVideosGrid({ pubkey, dTag }: Props) {
  const { data, isLoading } = usePeopleListMemberVideos(pubkey, dTag);
  const { isMuted } = useContentModeration();

  const videos = useMemo(() => {
    if (!data) return [];

    // Flatten all pages into a single NostrEvent array then parse
    const allEvents = data.pages.flat();
    const parsed = parseVideoEvents(allEvents);

    // Filter out videos whose author the viewer has muted
    return parsed.filter((v) => !isMuted(v.pubkey));
  }, [data, isMuted]);

  if (!isLoading && videos.length === 0) {
    return (
      <div data-testid="people-list-videos-empty">
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <p className="text-muted-foreground">
              No loops yet from these creators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <VideoGrid
      videos={videos}
      loading={isLoading}
    />
  );
}
