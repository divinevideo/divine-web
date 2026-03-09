import { useSeoMeta } from '@unhead/react';
import { VideoFeed } from '@/components/VideoFeed';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFollowList } from '@/hooks/useFollowList';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DiscoveryPage from './DiscoveryPage';
import { AppPage, AppPageHeader } from '@/components/AppPage';

const Index = () => {
  const { user } = useCurrentUser();
  const { data: followList, isLoading: isLoadingFollows } = useFollowList();
  const navigate = useNavigate();

  useSeoMeta({
    title: 'diVine Web - Short-form Looping Videos on Nostr',
    description: 'Watch and share 6-second looping videos on the decentralized Nostr network.',
  });

  // Show discovery feed for non-logged-in users (no interstitial landing page)
  if (!user) {
    return <DiscoveryPage />;
  }

  // Show message if user has no follows
  if (!isLoadingFollows && followList && followList.length === 0) {
    return (
      <AppPage width="feed">
        <AppPageHeader
          eyebrow="Your network"
          title="Home"
          description="Videos from people you follow"
        />

        <Card className="app-surface border-dashed border-2 border-[hsl(var(--surface-border)/0.9)] bg-transparent">
          <CardContent className="px-8 py-16 text-center">
            <div className="mx-auto max-w-sm space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-light-green dark:bg-brand-dark-green">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium text-foreground">
                  Your home feed is empty
                </p>
                <p className="text-sm text-muted-foreground">
                  Follow creators to see their videos here. Explore trending videos to find people to follow.
                </p>
              </div>
              <Button
                onClick={() => navigate('/discovery')}
                className="mt-4"
              >
                Explore Videos
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppPage>
    );
  }

  // When logged in and has follows, show home feed (videos from people you follow)
  return (
    <AppPage width="feed">
      <AppPageHeader
        eyebrow="Following feed"
        title="Home"
        description={`Videos from ${followList?.length || 0} ${followList?.length === 1 ? 'person' : 'people'} you follow`}
      />

      <VideoFeed
        feedType="home"
        data-testid="video-feed-home"
        className="space-y-6"
      />
    </AppPage>
  );
};

export default Index;
