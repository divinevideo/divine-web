import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCompilationSource } from '@/hooks/useCompilationSource';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import {
  getCompilationFallbackPath,
  getCompilationTitle,
  parseCompilationPlaybackParams,
} from '@/lib/compilationPlayback';

export function WatchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useSubdomainNavigate();
  const descriptor = useMemo(
    () => parseCompilationPlaybackParams(searchParams),
    [searchParams]
  );
  const source = useCompilationSource(descriptor);
  const title = getCompilationTitle(descriptor);

  useSeoMeta({
    title: `${title} - Divine`,
    description: `Compilation playback for ${title}`,
  });

  const handleBack = () => {
    navigate(descriptor.returnTo ?? getCompilationFallbackPath(descriptor));
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
        </CardContent>
      </Card>
    </div>
  );
}

export default WatchPage;
