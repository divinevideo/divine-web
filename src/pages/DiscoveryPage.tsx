// ABOUTME: Discovery feed page showing all public videos with tabs for Classics, Hot, Rising, New, and Hashtags
// ABOUTME: Each tab uses different sort modes; Classics uses Funnelcake REST API for pre-computed metrics
// ABOUTME: For You tab shows personalized recommendations when user is logged in

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { VideoFeed } from '@/components/VideoFeed';
import { VerifiedOnlyToggle } from '@/components/VerifiedOnlyToggle';
import { HashtagExplorer } from '@/components/HashtagExplorer';
import { ClassicVinersRow } from '@/components/ClassicVinersRow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Clock, Hash, Flame, Sparkles } from 'lucide-react';
// Zap temporarily unused - will be needed when Rising tab is re-enabled
import { useCurrentUser } from '@/hooks/useCurrentUser';

// All possible tab values (foryou only shown when logged in)
type AllowedTab = 'foryou' | 'classics' | 'hot' | 'new' | 'hashtags';
const ALL_TABS: AllowedTab[] = ['foryou', 'classics', 'hot', 'new', 'hashtags'];
const BASE_TABS: AllowedTab[] = ['classics', 'hot', 'new', 'hashtags'];

export function DiscoveryPage() {
  const navigate = useNavigate();
  const params = useParams<{ tab?: string }>();
  const { user } = useCurrentUser();
  const isLoggedIn = !!user?.pubkey;

  // Tabs include 'foryou' only when logged in
  // Note: 'rising' temporarily removed
  const allowedTabs = useMemo(() => {
    return isLoggedIn ? ALL_TABS : BASE_TABS;
  }, [isLoggedIn]);

  const routeTab = (params.tab || '').toLowerCase();
  // Support legacy 'top' route by mapping to 'classics'
  const normalizedTab = routeTab === 'top' ? 'classics' : routeTab;
  // Default to 'foryou' for logged-in users, 'classics' for anonymous
  const defaultTab: AllowedTab = isLoggedIn ? 'foryou' : 'classics';
  const initialTab: AllowedTab = allowedTabs.includes(normalizedTab as AllowedTab) ? (normalizedTab as AllowedTab) : defaultTab;
  const [activeTab, setActiveTab] = useState<AllowedTab>(initialTab);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Note: We no longer force relay changes here as it causes navigation delays
  // The default relay (relay.divine.video) is already configured in App.tsx
  // and supports NIP-50 search required for discovery features

  // Sync state when URL param changes
  useEffect(() => {
    // Handle legacy 'top' route by redirecting to 'classics'
    if (routeTab === 'top') {
      navigate('/discovery/classics', { replace: true });
      return;
    }
    if (allowedTabs.includes(normalizedTab as AllowedTab)) {
      setActiveTab(normalizedTab as AllowedTab);
    }
  }, [routeTab, normalizedTab, allowedTabs, navigate]);

  // Handle edge case: user logs out while on 'foryou' tab
  useEffect(() => {
    if (!isLoggedIn && activeTab === 'foryou') {
      setActiveTab('classics');
      navigate('/discovery/classics', { replace: true });
    }
  }, [isLoggedIn, activeTab, navigate]);

  // Redirect bare /discovery to default tab (foryou for logged in, classics for anonymous)
  useEffect(() => {
    if (!params.tab) {
      navigate(`/discovery/${defaultTab}`, { replace: true });
    }
  }, [params.tab, navigate, defaultTab]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className={activeTab === 'hashtags' ? 'max-w-6xl mx-auto' : 'max-w-2xl mx-auto'}>
        <header className="mb-6 space-y-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Discover</h1>
              <p className="text-muted-foreground">Explore videos from the network</p>
            </div>
            {activeTab !== 'hashtags' && (
              <VerifiedOnlyToggle
                enabled={verifiedOnly}
                onToggle={setVerifiedOnly}
              />
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
          <TabsList className={`w-full grid gap-1 ${isLoggedIn ? 'grid-cols-5' : 'grid-cols-4'}`}>
            {isLoggedIn && (
              <TabsTrigger value="foryou" className="gap-1.5 sm:gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">For You</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="classics" className="gap-1.5 sm:gap-2">
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Classic</span>
            </TabsTrigger>
            <TabsTrigger value="hot" className="gap-1.5 sm:gap-2">
              <Flame className="h-4 w-4" />
              <span className="hidden sm:inline">Hot</span>
            </TabsTrigger>
            {/* Rising tab temporarily disabled
            <TabsTrigger value="rising" className="gap-1.5 sm:gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Rising</span>
            </TabsTrigger>
            */}
            <TabsTrigger value="new" className="gap-1.5 sm:gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </TabsTrigger>
            <TabsTrigger value="hashtags" className="gap-1.5 sm:gap-2">
              <Hash className="h-4 w-4" />
              <span className="hidden sm:inline">Tags</span>
            </TabsTrigger>
          </TabsList>

          {isLoggedIn && (
            <TabsContent value="foryou" className="mt-0 space-y-6">
              <VideoFeed
                feedType="foryou"
                verifiedOnly={verifiedOnly}
                data-testid="video-feed-foryou"
                className="space-y-6"
                key="foryou"
              />
            </TabsContent>
          )}

          <TabsContent value="classics" className="mt-0 space-y-6">
            {/* Classic Viners horizontal row */}
            <ClassicVinersRow />

            {/* Classic Vines feed - uses Funnelcake API */}
            <VideoFeed
              feedType="classics"
              verifiedOnly={verifiedOnly}
              data-testid="video-feed-classics"
              className="space-y-6"
              key="classics"
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

          {/* Rising tab temporarily disabled
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
          */}

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
