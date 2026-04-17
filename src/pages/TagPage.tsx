import { useParams } from 'react-router-dom';
import { VideoFeed } from '@/components/VideoFeed';
import { ArrowLeft } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const normalizedTag = (tag || '').toLowerCase();
  const { t } = useTranslation();

  if (!normalizedTag) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">{t('tagPage.notFoundTitle')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('tagPage.notFoundDescription')}
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
          {t('tagPage.back')}
        </Button>
        
        <div className="flex-1">
          <h1 className="text-2xl font-bold">#{tag}</h1>
          <p className="text-muted-foreground">
            {t('tagPage.subtitle', { tag: normalizedTag })}
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
