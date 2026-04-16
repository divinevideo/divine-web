import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CompilationPlayerSurface } from '@/components/CompilationPlayerSurface';
import { useCompilationSource } from '@/hooks/useCompilationSource';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import type { ParsedVideoData } from '@/types/video';
import {
  getCompilationFallbackPath,
  getCompilationTitle,
  parseCompilationPlaybackParams,
} from '@/lib/compilationPlayback';

export function WatchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useSubdomainNavigate();
  const descriptor = useMemo(
    () => parseCompilationPlaybackParams(searchParams),
    [searchParams]
  );
  const source = useCompilationSource(descriptor);
  const title = getCompilationTitle(descriptor);
  const initialIndex = useMemo(() => {
    if (source.videos.length === 0) {
      return 0;
    }

    if (descriptor.videoId) {
      const matchedIndex = source.videos.findIndex(video => video.id === descriptor.videoId);
      if (matchedIndex >= 0) {
        return matchedIndex;
      }
    }

    return descriptor.start ?? 0;
  }, [descriptor.start, descriptor.videoId, source.videos]);
  const [activeVideo, setActiveVideo] = useState<ParsedVideoData | null>(
    source.videos[initialIndex] ?? source.videos[0] ?? null
  );

  useEffect(() => {
    setActiveVideo(source.videos[initialIndex] ?? source.videos[0] ?? null);
  }, [initialIndex, source.videos]);

  useSeoMeta({
    title: `${title} - Divine`,
    description: `Compilation playback for ${title}`,
  });

  const handleBack = () => {
    navigate(descriptor.returnTo ?? getCompilationFallbackPath(descriptor));
  };

  const replaceVideoQueryParam = (videoId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('video', videoId);
    nextParams.delete('start');
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="container py-6">
      <Card data-testid="compilation-player">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-4">
            <Button type="button" variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <span className="text-sm text-muted-foreground">
              {source.videos.length} loaded
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              Compilation playback route
            </p>
          </div>
          {source.videos.length > 0 ? (
            <>
              <CompilationPlayerSurface
                videos={source.videos}
                initialIndex={initialIndex}
                hasNextPage={source.hasNextPage}
                fetchNextPage={source.fetchNextPage}
                onVideoChange={setActiveVideo}
                replaceVideoQueryParam={replaceVideoQueryParam}
              />
              {activeVideo && (
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">{activeVideo.title ?? 'Untitled video'}</h2>
                  <p className="text-sm text-muted-foreground">
                    {activeVideo.authorName ?? activeVideo.pubkey}
                  </p>
                  {activeVideo.content && (
                    <p className="text-sm">{activeVideo.content}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No videos loaded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default WatchPage;
