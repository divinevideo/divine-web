// ABOUTME: Popular hashtags card component showing trending hashtags from recent videos

import { Hash } from 'lucide-react';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchHashtags } from '@/hooks/useSearchHashtags';
import { Button } from '@/components/ui/button';

export function PopularHashtagsCard() {
  const navigate = useSubdomainNavigate();
  const { data: popularHashtags = [], isLoading } = useSearchHashtags({
    query: '',
    limit: 12,
  });

  const handleHashtagClick = (hashtag: string) => {
    navigate(`/hashtag/${hashtag}`);
  };

  return (
    <Card className="lg:sticky lg:top-6 w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Hash className="h-5 w-5" />
          Popular Hashtags
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : popularHashtags.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">No hashtags found</p>
            <p className="text-xs text-muted-foreground mt-1">Check back later for trending tags</p>
          </div>
        ) : (
          <div className="space-y-2">
            {popularHashtags.map((hashtag) => (
              <Button
                key={hashtag.hashtag}
                variant="ghost"
                className="w-full justify-start h-auto py-2 px-3 hover:bg-secondary"
                onClick={() => handleHashtagClick(hashtag.hashtag)}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">#{hashtag.hashtag}</span>
                  <span className="text-xs text-muted-foreground">
                    {hashtag.video_count} {hashtag.video_count === 1 ? 'video' : 'videos'}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PopularHashtagsCard;

