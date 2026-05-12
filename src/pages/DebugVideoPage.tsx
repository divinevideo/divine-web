// ABOUTME: Debug page to verify video URL extraction from Nostr events
// ABOUTME: Shows raw event data and extracted video URLs for troubleshooting

import { useVideoEvents } from '@/hooks/useVideoEvents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VideoPlayer } from '@/components/VideoPlayer';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function DebugVideoPage() {
  const { t } = useTranslation();
  const { data: videos, isLoading, error } = useVideoEvents({ limit: 5 });
  const [testingUrl, setTestingUrl] = useState<string | null>(null);

  if (isLoading) {
    return <div className="container mx-auto py-8">{t('debugVideoPage.loading')}</div>;
  }

  if (error) {
    return <div className="container mx-auto py-8">{t('debugVideoPage.errorLoading', { message: error.message })}</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">{t('debugVideoPage.heading')}</h1>

      {videos && videos.length > 0 ? (
        <div className="space-y-6">
          {videos.map((video) => (
            <Card key={video.id}>
              <CardHeader>
                <CardTitle className="text-sm font-mono">{t('debugVideoPage.eventLabel', { id: video.id })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="font-semibold">{t('debugVideoPage.videoUrl')}</p>
                  <code className="block p-2 bg-muted rounded text-xs break-all">
                    {video.videoUrl}
                  </code>

                  <p className="text-sm text-muted-foreground">
                    {t('debugVideoPage.urlTypeLabel', {
                      type: video.videoUrl.includes('.m3u8')
                        ? t('debugVideoPage.urlTypeHls')
                        : video.videoUrl.includes('.mp4')
                        ? t('debugVideoPage.urlTypeMp4')
                        : t('debugVideoPage.urlTypeUnknown'),
                    })}
                  </p>

                  {video.thumbnailUrl && (
                    <>
                      <p className="font-semibold">{t('debugVideoPage.thumbnailUrl')}</p>
                      <code className="block p-2 bg-muted rounded text-xs break-all">
                        {video.thumbnailUrl}
                      </code>
                    </>
                  )}

                  <button
                    onClick={() => setTestingUrl(testingUrl === video.videoUrl ? null : video.videoUrl)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:brightness-110"
                  >
                    {testingUrl === video.videoUrl ? t('debugVideoPage.hidePlayer') : t('debugVideoPage.testThisUrl')}
                  </button>

                  {testingUrl === video.videoUrl && (
                    <div className="aspect-square max-w-md bg-black">
                      <VideoPlayer
                        videoId={`test-${video.id}`}
                        src={video.videoUrl}
                        className="w-full h-full"
                        onLoadStart={() => console.log(`[Debug] Testing URL: ${video.videoUrl}`)}
                        onLoadedData={() => console.log(`[Debug] Successfully loaded: ${video.videoUrl}`)}
                        onError={() => console.log(`[Debug] Failed to load: ${video.videoUrl}`)}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t('debugVideoPage.noVideos')}</p>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h2 className="font-semibold mb-2">{t('debugVideoPage.debugInfo')}</h2>
        <p>{t('debugVideoPage.totalFound', { count: videos?.length || 0 })}</p>
        <p>{t('debugVideoPage.checkConsole')}</p>
      </div>
    </div>
  );
}