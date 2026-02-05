import { useSeoMeta } from '@unhead/react';
import { VideoFeed } from '@/components/VideoFeed';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFollowList } from '@/hooks/useFollowList';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DiscoveryPage from './DiscoveryPage';

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
      <div className="min-h-screen bg-background">
        <main className="container py-6">
          <div className="max-w-2xl mx-auto">
            <header className="mb-6">
              <h1 className="text-2xl font-bold">Home</h1>
              <p className="text-muted-foreground">Videos from people you follow</p>
            </header>

            <Card className="border-dashed border-2">
              <CardContent className="py-16 px-8 text-center">
                <div className="max-w-sm mx-auto space-y-4">
                  <div className="w-16 h-16 rounded-full bg-brand-light-green dark:bg-brand-dark-green flex items-center justify-center mx-auto">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-foreground">
                      Your home feed is empty
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Follow creators to see their videos here. Explore trending videos to find people to follow!
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
            <h1 className="text-2xl font-bold">Home</h1>
            <p className="text-muted-foreground">
              Videos from {followList?.length || 0} {followList?.length === 1 ? 'person' : 'people'} you follow
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
