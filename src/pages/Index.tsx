import { useSeoMeta } from '@unhead/react';
import { useTranslation } from 'react-i18next';
import { VideoFeed } from '@/components/VideoFeed';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFollowList } from '@/hooks/useFollowList';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import DiscoveryPage from './DiscoveryPage';

const Index = () => {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { data: followList, isLoading: isLoadingFollows } = useFollowList();
  const navigate = useNavigate();

  useSeoMeta({
    title: t('indexPage.seoTitle'),
    description: t('indexPage.seoDescription'),
  });

  // Show discovery feed for non-logged-in users (no interstitial landing page)
  if (!user) {
    return <DiscoveryPage />;
  }

  // Show message if user has no follows
  if (!isLoadingFollows && followList && followList.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container py-6">
          <div className="max-w-2xl mx-auto">
            <header className="mb-6">
              <h1 className="text-2xl font-bold">{t('indexPage.heading')}</h1>
              <p className="text-muted-foreground">{t('indexPage.subheadingDefault')}</p>
            </header>

            <Card className="border-dashed border-2">
              <CardContent className="py-16 px-8 text-center">
                <div className="max-w-sm mx-auto space-y-4">
                  <div className="w-16 h-16 rounded-full bg-brand-light-green dark:bg-brand-dark-green flex items-center justify-center mx-auto">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-foreground">
                      {t('indexPage.emptyTitle')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t('indexPage.emptyDescription')}
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate('/discovery')}
                    className="mt-4"
                  >
                    {t('indexPage.exploreVideos')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // When logged in and has follows, show home feed (videos from people you follow)
  return (
    <div className="min-h-screen bg-background">
      <main className="container py-6">
        <div className="max-w-2xl mx-auto">
          <header className="mb-6">
            <h1 className="text-2xl font-bold">{t('indexPage.heading')}</h1>
            <p className="text-muted-foreground">
              {t('indexPage.subheadingCount', { count: followList?.length || 0 })}
            </p>
          </header>

          <VideoFeed
            feedType="home"
            data-testid="video-feed-home"
            className="space-y-6"
          />
        </div>
      </main>
    </div>
  );
};

export default Index;
