// ABOUTME: Discovery feed page showing all public videos with tabs for Hot, Top, Rising, New, and Hashtags
// ABOUTME: Each tab uses different NIP-50 sort modes for unique content discovery

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { VideoFeed } from '@/components/VideoFeed';
import { VerifiedOnlyToggle } from '@/components/VerifiedOnlyToggle';
import { HashtagExplorer } from '@/components/HashtagExplorer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Clock, Hash, Flame, Zap } from 'lucide-react';
import { AutoScrollToggle } from '@/components/AutoScrollToggle';
import { useAutoScroll } from '@/hooks/useAutoScroll';

export function DiscoveryPage() {
  const navigate = useNavigate();
  const params = useParams<{ tab?: string }>();
  const allowedTabs = useMemo(() => ['top', 'hot', 'rising', 'new', 'hashtags'] as const, []);
  type AllowedTab = typeof allowedTabs[number];
  const routeTab = (params.tab || '').toLowerCase();
  const initialTab: AllowedTab = (allowedTabs.includes(routeTab as AllowedTab) ? routeTab : 'top') as AllowedTab;
  const [activeTab, setActiveTab] = useState<AllowedTab>(initialTab);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  
  const {autoScroll, setAutoScroll} = useAutoScroll();

  // Note: We no longer force relay changes here as it causes navigation delays
  // The default relay (relay.divine.video) is already configured in App.tsx
  // and supports NIP-50 search required for discovery features

  // Sync state when URL param changes
  useEffect(() => {
    if (allowedTabs.includes(routeTab as AllowedTab)) {
      setActiveTab(routeTab as AllowedTab);
    }
  }, [routeTab, allowedTabs]);

  // Redirect bare /discovery to /discovery/top to make tab part of URL
  useEffect(() => {
    if (!params.tab) {
      navigate('/discovery/top', { replace: true });
    }
  }, [params.tab, navigate]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className={activeTab === 'hashtags' ? 'max-w-6xl mx-auto' : 'max-w-2xl mx-auto'}>
        <header className="mb-6 space-y-4">
          <div className="flex flex-col gap-4 items-start justify-between mb-4 sm:flex-row">
            <div>
              <h1 className="text-2xl font-bold">Discover</h1>
              <p className="text-muted-foreground">Explore videos from the network</p>
            </div>
            {activeTab !== 'hashtags' && (
              <div className="flex flex-row gap-10">
                <AutoScrollToggle
                  enabled={autoScroll}
                  onToggle={setAutoScroll}
                />
                <VerifiedOnlyToggle
                  enabled={verifiedOnly}
                  onToggle={setVerifiedOnly}
                />
              </div>
            )}
          </div>
        </header>

        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            if (allowedTabs.includes(val as AllowedTab)) {
              setActiveTab(val as AllowedTab);
              navigate(`/discovery/${val}`);
            }
          }}
          className="space-y-6"
        >
          <TabsList className="w-full grid grid-cols-5 gap-1">
            <TabsTrigger value="top" className="gap-1.5 sm:gap-2">
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Classic</span>
            </TabsTrigger>
            <TabsTrigger value="hot" className="gap-1.5 sm:gap-2">
              <Flame className="h-4 w-4" />
              <span className="hidden sm:inline">Hot</span>
            </TabsTrigger>
            <TabsTrigger value="rising" className="gap-1.5 sm:gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Rising</span>
            </TabsTrigger>
            <TabsTrigger value="new" className="gap-1.5 sm:gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </TabsTrigger>
            <TabsTrigger value="hashtags" className="gap-1.5 sm:gap-2">
              <Hash className="h-4 w-4" />
              <span className="hidden sm:inline">Tags</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="top" className="mt-0 space-y-6">
            <VideoFeed
              feedType="trending"
              sortMode="top"
              verifiedOnly={verifiedOnly}
              data-testid="video-feed-top"
              className="space-y-6"
              key="top"
            />
          </TabsContent>

          <TabsContent value="hot" className="mt-0 space-y-6">
            <VideoFeed
              feedType="trending"
              sortMode="hot"
              verifiedOnly={verifiedOnly}
              data-testid="video-feed-hot"
              className="space-y-6"
              key="hot"
            />
          </TabsContent>

          <TabsContent value="rising" className="mt-0 space-y-6">
            <VideoFeed
              feedType="trending"
              sortMode="rising"
              verifiedOnly={verifiedOnly}
              data-testid="video-feed-rising"
              className="space-y-6"
              key="rising"
            />
          </TabsContent>

          <TabsContent value="new" className="mt-0 space-y-6">
            <VideoFeed
              feedType="recent"
              verifiedOnly={verifiedOnly}
              data-testid="video-feed-new"
              className="space-y-6"
              key="recent"
            />
          </TabsContent>

          <TabsContent value="hashtags" className="mt-0 space-y-6">
            <HashtagExplorer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default DiscoveryPage;
