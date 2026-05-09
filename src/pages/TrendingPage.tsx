// ABOUTME: Trending feed page with sort tabs + Popular time-window selector
// ABOUTME: Sort + period live in URL query params for shareable, refresh-safe views

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Rss } from '@phosphor-icons/react';
import { useHead } from '@unhead/react';
import { VideoFeed } from '@/components/VideoFeed';
import { feedUrls } from '@/lib/feedUrls';
import { useRssFeedAvailable } from '@/hooks/useRssFeedAvailable';
import type { SortMode } from '@/types/nostr';
import type { FunnelcakePeriod } from '@/types/funnelcake';
import { EXTENDED_SORT_MODES, POPULAR_PERIODS } from '@/lib/constants/sortModes';

const VALID_SORTS: ReadonlyArray<string> = ['hot', 'top', 'rising', 'popular', 'classic', 'new'];
const VALID_PERIODS: ReadonlyArray<string> = ['now', 'today', 'week', 'month', 'all'];

// URL encoding rules:
// - Missing sort param → 'hot' (default)
// - 'new' (the New tab; sortMode undefined) → 'new' in URL, undefined in state
// - 'controversial' (legacy) → coerced to 'hot' in state; URL not rewritten (cosmetic only)
// - Unknown values → 'hot'
function parseSort(raw: string | null): SortMode | undefined {
  if (raw === null) return 'hot';
  if (raw === 'new') return undefined;
  if (raw === 'controversial') return 'hot';
  return (VALID_SORTS.includes(raw) ? (raw as SortMode) : 'hot');
}

function parsePeriod(raw: string | null): FunnelcakePeriod {
  if (raw && VALID_PERIODS.includes(raw)) return raw as FunnelcakePeriod;
  return 'today';
}

function sortToUrl(sort: SortMode | undefined): string {
  return sort ?? 'new';
}

export function TrendingPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const sortMode = parseSort(searchParams.get('sort'));
  const period = parsePeriod(searchParams.get('period'));

  const setSort = useCallback((next: SortMode | undefined) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', sortToUrl(next));
    if (next !== 'popular') params.delete('period');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const setPeriod = useCallback((next: FunnelcakePeriod) => {
    const params = new URLSearchParams(searchParams);
    params.set('period', next);
    params.set('sort', 'popular');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const rssFeedAvailable = useRssFeedAvailable();
  useHead({
    link: rssFeedAvailable
      ? [{ rel: 'alternate', type: 'application/rss+xml', title: t('trendingPage.rssTitle'), href: feedUrls.trending() }]
      : [],
  });

  const showPeriodRow = sortMode === 'popular';

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t('trendingPage.heading')}</h1>
              <p className="text-muted-foreground">{t('trendingPage.subheading')}</p>
            </div>
            {rssFeedAvailable && (
              <a
                href={feedUrls.trending()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Rss className="h-3.5 w-3.5" /> {t('trendingPage.rssLink')}
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('trendingPage.heading')}>
            {EXTENDED_SORT_MODES.map(mode => {
              const ModeIcon = mode.icon;
              const isSelected = sortMode === mode.value;
              return (
                <button
                  key={String(mode.value ?? 'new')}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSort(mode.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                    ${isSelected
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-brand-light-green dark:bg-brand-dark-green hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <ModeIcon className="h-4 w-4" />
                  <span>{mode.label}</span>
                  {isSelected && (
                    <span className="text-xs opacity-80 hidden sm:inline">• {mode.description}</span>
                  )}
                </button>
              );
            })}
          </div>

          {showPeriodRow && (
            <div
              role="group"
              aria-label={t('trendingPage.popular.period.label')}
              data-testid="period-row"
              className="flex flex-wrap gap-2 pl-1"
            >
              {POPULAR_PERIODS.map(p => {
                const isSelected = period === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    aria-pressed={isSelected}
                    data-testid={`period-pill-${p.value}`}
                    onClick={() => setPeriod(p.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all min-h-[36px]
                      ${isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-brand-light-green dark:bg-brand-dark-green hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {t(`trendingPage.popular.period.${p.value}`)}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <VideoFeed
          feedType="trending"
          sortMode={sortMode}
          period={showPeriodRow ? period : undefined}
          accent="pink"
          data-testid="video-feed-trending"
          className="space-y-6"
        />
      </div>
    </div>
  );
}

export default TrendingPage;
