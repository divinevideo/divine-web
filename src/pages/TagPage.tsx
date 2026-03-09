import { useParams } from 'react-router-dom';
import { VideoFeed } from '@/components/VideoFeed';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const normalizedTag = (tag || '').toLowerCase();

  if (!normalizedTag) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Tag not found</h1>
          <p className="text-muted-foreground mt-2">
            The requested tag could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.history.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        
        <div className="flex-1">
          <h1 className="text-2xl font-bold">#{tag}</h1>
          <p className="text-muted-foreground">
            Browse videos tagged with #{normalizedTag}
          </p>
        </div>
      </div>

      {/* Video Feed */}
      <VideoFeed
        feedType="hashtag"
        hashtag={normalizedTag}
        data-testid="video-feed-hashtag"
      />
    </div>
  );
}
