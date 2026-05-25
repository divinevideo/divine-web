// ABOUTME: Displays user's saved/bookmarked videos in a grid layout

import { useTranslation } from 'react-i18next';
import { BookmarkSimple } from '@phosphor-icons/react';
import { useBookmarkedVideos } from '@/hooks/useBookmarks';
import { VideoGrid } from '@/components/VideoGrid';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { Card, CardContent } from '@/components/ui/card';

interface BookmarkedVideosSectionProps {
  pubkey?: string;
  className?: string;
}

export function BookmarkedVideosSection({ pubkey, className }: BookmarkedVideosSectionProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useBookmarkedVideos(pubkey);
  const videos = data?.videos ?? [];

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-4">
        <BookmarkSimple className="h-4 w-4 text-muted-foreground" />
        <SectionHeader as="h3" className="text-sm text-muted-foreground">
          {t('profilePage.savedVideos')}
        </SectionHeader>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-square relative bg-black/80 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-brand-light-green border-t-brand-green rounded-full animate-spin" />
              </div>
            </Card>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-4">
              <BookmarkSimple className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">
                {t('profilePage.noSavedVideos')}
              </p>
              <p className="text-sm text-muted-foreground/70">
                {t('profilePage.bookmarkHint')}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <VideoGrid
          videos={videos}
          navigationContext={{ source: 'profile', pubkey: pubkey ?? '' }}
        />
      )}
    </div>
  );
}
