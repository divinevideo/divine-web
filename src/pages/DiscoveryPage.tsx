// ABOUTME: Discovery feed page showing public videos with tabs for Classics, Hot, and Hashtags
// ABOUTME: Each video tab uses a moderated or curated feed source
// ABOUTME: For You tab shows personalized recommendations when user is logged in

import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { VideoFeed } from '@/components/VideoFeed';
import { VerifiedOnlyToggle } from '@/components/VerifiedOnlyToggle';
import { HashtagExplorer } from '@/components/HashtagExplorer';
import { ClassicVinersRow } from '@/components/ClassicVinersRow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Hash, Flame, Sparkle as Sparkles, Confetti } from '@phosphor-icons/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCategories } from '@/hooks/useCategories';
import { useFeaturedTab } from '@/hooks/useFeaturedTab';
import { getTranslatedCategoryLabel } from '@/lib/constants/categories';
import { trackEvent } from '@/lib/analytics';
import type { DiscoveryTabName, ResolvedFeaturedTab } from '@/types/featuredTabs';

// All possible tab values (foryou only shown when logged in)
type AllowedTab = DiscoveryTabName | string;

interface DiscoveryTabItem {
  value: AllowedTab;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  disclosureLabel?: string | null;
  featuredTab?: ResolvedFeaturedTab;
}

function insertFeaturedTab(
  tabs: DiscoveryTabItem[],
  featuredTab: ResolvedFeaturedTab | null
): DiscoveryTabItem[] {
  if (!featuredTab) return tabs;

  const item: DiscoveryTabItem = {
    value: featuredTab.slug,
    label: featuredTab.label,
    // Not Hash: the hashtags tab already owns that glyph, and below `sm` the
    // labels are hidden, so a second Hash would make the editorial tab
    // indistinguishable from it on mobile.
    Icon: Confetti,
    disclosureLabel: featuredTab.disclosureLabel,
    featuredTab,
  };
  const position = featuredTab.position;
  const target = position?.after ?? position?.before;
  const targetIndex = target
    ? tabs.findIndex((tab) => tab.value === target)
    : -1;

  if (targetIndex === -1) {
    return [...tabs, item];
  }

  const insertAt = position?.before ? targetIndex : targetIndex + 1;
  return [
    ...tabs.slice(0, insertAt),
    item,
    ...tabs.slice(insertAt),
  ];
}

export function DiscoveryPage() {
  const navigate = useSubdomainNavigate();
  const { t } = useTranslation();
  const params = useParams<{ tab?: string }>();
  const { user } = useCurrentUser();
  const isLoggedIn = !!user?.pubkey;
  const { data: categories } = useCategories();
  const { tab: featuredTab, isResolved: isFeaturedConfigResolved } = useFeaturedTab();

  const baseTabs = useMemo<DiscoveryTabItem[]>(() => {
    const tabs: DiscoveryTabItem[] = [
      {
        value: 'classics',
        label: t('discovery.classic'),
        Icon: Star,
      },
      {
        value: 'hot',
        label: t('discovery.hot'),
        Icon: Flame,
      },
      {
        value: 'hashtags',
        label: t('discovery.tags'),
        Icon: Hash,
      },
    ];

    return isLoggedIn
      ? [
          {
            value: 'foryou',
            label: t('discovery.forYou'),
            Icon: Sparkles,
          },
          ...tabs,
        ]
      : tabs;
  }, [isLoggedIn, t]);

  const tabItems = useMemo(
    () => insertFeaturedTab(baseTabs, featuredTab),
    [baseTabs, featuredTab]
  );

  const allowedTabs = useMemo(() => {
    return tabItems.map((tab) => tab.value);
  }, [tabItems]);

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

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(defaultTab);
      navigate(`/discovery/${defaultTab}`, { replace: true });
    }
  }, [activeTab, allowedTabs, defaultTab, navigate]);

  // A slug that no configuration claims — expired campaign, shared link, typo —
  // otherwise renders the default tab while the address bar keeps the dead
  // route, so a reload or a re-share carries the phantom slug onward. Wait for
  // the featured config to resolve first: before then, an unknown slug may
  // still turn out to be a valid featured tab.
  useEffect(() => {
    if (!routeTab || !isFeaturedConfigResolved) return;
    if (allowedTabs.includes(normalizedTab as AllowedTab)) return;

    navigate(`/discovery/${defaultTab}`, { replace: true });
  }, [
    routeTab,
    normalizedTab,
    allowedTabs,
    defaultTab,
    isFeaturedConfigResolved,
    navigate,
  ]);

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

  // Keyed on the identifiers rather than the resolved object: the config poll
  // hands back a fresh object every refresh, which would otherwise re-count an
  // impression every few minutes for a viewer who never left the tab.
  const featuredTabId = featuredTab?.id;
  const featuredTabSlug = featuredTab?.slug;
  useEffect(() => {
    if (featuredTabId && activeTab === featuredTabSlug) {
      trackEvent('featured_tab_impression', {
        featured_tab_id: featuredTabId,
      });
    }
  }, [activeTab, featuredTabId, featuredTabSlug]);

  const activeTabItem = tabItems.find((tab) => tab.value === activeTab);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className={activeTab === 'hashtags' ? 'max-w-6xl mx-auto' : 'max-w-2xl mx-auto'}>
        <header className="mb-6 space-y-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{t('discovery.title')}</h1>
              <p className="text-muted-foreground">{t('discovery.subtitle')}</p>
            </div>
            {activeTab !== 'hashtags' && (
              <VerifiedOnlyToggle
                enabled={verifiedOnly}
                onToggle={setVerifiedOnly}
              />
            )}
          </div>
        </header>

        {/* Mobile category pills - visible on small screens only */}
        {categories && categories.length > 0 && (
          <div className="lg:hidden -mx-4 px-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 pb-2">
              {categories.slice(0, 12).map(cat => (
                <button
                  key={cat.name}
                  onClick={() => navigate(`/category/${cat.name}`)}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted hover:border-primary"
                >
                  <span>{cat.config?.emoji || ''}</span>
                  <span>{getTranslatedCategoryLabel(cat.name, t)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            if (allowedTabs.includes(val)) {
              setActiveTab(val);
              navigate(`/discovery/${val}`);
            }
          }}
          className="space-y-6"
        >
          <TabsList
            className="grid w-full gap-1"
            style={{ gridTemplateColumns: `repeat(${tabItems.length}, minmax(0, 1fr))` }}
          >
            {tabItems.map(({ value, label, Icon, disclosureLabel }) => (
              <TabsTrigger key={value} value={value} className="min-w-0 gap-1.5 px-2 sm:gap-2 sm:px-4">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden min-w-0 truncate sm:inline" title={label}>{label}</span>
                {disclosureLabel && (
                  <span className="max-w-12 shrink-0 truncate rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] leading-none text-foreground">
                    {disclosureLabel}
                  </span>
                )}
              </TabsTrigger>
            ))}
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
              accent="violet"
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
              accent="pink"
              data-testid="video-feed-hot"
              className="space-y-6"
              key="hot"
            />
          </TabsContent>

          <TabsContent value="hashtags" className="mt-0 space-y-6">
            <HashtagExplorer />
          </TabsContent>

          {activeTabItem?.featuredTab && (
            <TabsContent value={activeTabItem.featuredTab.slug} className="mt-0 space-y-6">
              <VideoFeed
                feedType="featured"
                featuredTabId={activeTabItem.featuredTab.id}
                verifiedOnly={verifiedOnly}
                data-testid="video-feed-featured"
                className="space-y-6"
                key={activeTabItem.featuredTab.id}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

export default DiscoveryPage;
