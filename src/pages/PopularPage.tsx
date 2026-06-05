// ABOUTME: Dedicated popular feed page with source and period controls
// ABOUTME: Uses Funnelcake v2 popular period feeds through the shared VideoFeed stack

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, FilmSlate, Flame, Sparkle, TrendUp, type Icon } from '@phosphor-icons/react';
import { VideoFeed } from '@/components/VideoFeed';
import { cn } from '@/lib/utils';
import type { PopularPeriod, PopularSource } from '@/hooks/useInfiniteVideosFunnelcake';

interface PopularOption<TValue extends string> {
  value: TValue;
  labelKey: string;
  icon: Icon;
}

const SOURCE_OPTIONS: Array<PopularOption<PopularSource>> = [
  { value: 'new', labelKey: 'popularPage.sources.new', icon: Sparkle },
  { value: 'classic', labelKey: 'popularPage.sources.classic', icon: FilmSlate },
  { value: 'all', labelKey: 'popularPage.sources.all', icon: TrendUp },
];

const PERIOD_OPTIONS: Array<PopularOption<PopularPeriod>> = [
  { value: 'now', labelKey: 'popularPage.periods.now', icon: Flame },
  { value: 'today', labelKey: 'popularPage.periods.today', icon: Clock },
  { value: 'week', labelKey: 'popularPage.periods.week', icon: Clock },
  { value: 'month', labelKey: 'popularPage.periods.month', icon: Clock },
  { value: 'all', labelKey: 'popularPage.periods.all', icon: TrendUp },
];

const SOURCE_VALUES = new Set<PopularSource>(SOURCE_OPTIONS.map(option => option.value));
const PERIOD_VALUES = new Set<PopularPeriod>(PERIOD_OPTIONS.map(option => option.value));

function parseSource(value: string | null): PopularSource {
  return value && SOURCE_VALUES.has(value as PopularSource) ? (value as PopularSource) : 'new';
}

function parsePeriod(value: string | null): PopularPeriod {
  return value && PERIOD_VALUES.has(value as PopularPeriod) ? (value as PopularPeriod) : 'now';
}

function buildCanonicalParams(source: PopularSource, period: PopularPeriod): URLSearchParams {
  const params = new URLSearchParams();
  if (source !== 'new') params.set('source', source);
  if (period !== 'now') params.set('period', period);
  return params;
}

export function PopularPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const source = parseSource(searchParams.get('source'));
  const period = parsePeriod(searchParams.get('period'));

  const canonicalParams = useMemo(
    () => buildCanonicalParams(source, period),
    [source, period]
  );
  const canonicalSearch = canonicalParams.toString();

  useEffect(() => {
    const currentSearch = searchParams.toString();
    if (currentSearch !== canonicalSearch) {
      setSearchParams(canonicalParams, { replace: true });
    }
  }, [canonicalParams, canonicalSearch, searchParams, setSearchParams]);

  const updateSource = (nextSource: PopularSource) => {
    setSearchParams(buildCanonicalParams(nextSource, period));
  };

  const updatePeriod = (nextPeriod: PopularPeriod) => {
    setSearchParams(buildCanonicalParams(source, nextPeriod));
  };

  const subheadingKey = `popularPage.subheadings.${source}.${period}`;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{t('popularPage.heading')}</h1>
            <p className="text-muted-foreground">{t(subheadingKey)}</p>
          </div>

          <div className="space-y-3" aria-label={t('popularPage.controlsLabel')}>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('popularPage.sourceLabel')}>
              {SOURCE_OPTIONS.map(option => {
                const OptionIcon = option.icon;
                const selected = source === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updateSource(option.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-all',
                      selected
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-brand-light-green text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-brand-dark-green'
                    )}
                  >
                    <OptionIcon className="h-4 w-4" />
                    <span>{t(option.labelKey)}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label={t('popularPage.periodLabel')}>
              {PERIOD_OPTIONS.map(option => {
                const OptionIcon = option.icon;
                const selected = period === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updatePeriod(option.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all sm:px-4 sm:py-2',
                      selected
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-background text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <OptionIcon className="h-3.5 w-3.5" />
                    <span>{t(option.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <VideoFeed
          feedType="popular"
          popularSource={source}
          popularPeriod={period}
          accent="pink"
          data-testid="video-feed-popular"
          className="space-y-6"
        />
      </div>
    </div>
  );
}

export default PopularPage;
