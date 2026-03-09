// ABOUTME: Category index page showing all available content categories in a browseable grid
// ABOUTME: Displays category emoji, name, and video count with links to individual category pages

import { SmartLink } from '@/components/SmartLink';
import { useSeoMeta } from '@unhead/react';
import { useCategories } from '@/hooks/useCategories';
import { Skeleton } from '@/components/ui/skeleton';
import { AppPage, AppPageHeader } from '@/components/AppPage';
import { DiscoverySectionNav } from '@/components/DiscoverySectionNav';

export function CategoriesIndexPage() {
  const { data: categories, isLoading } = useCategories();

  useSeoMeta({
    title: 'Browse Categories - diVine',
    description: 'Explore video categories on diVine — comedy, music, dance, animals, sports, food, and more.',
    ogTitle: 'Browse Categories - diVine',
    ogDescription: 'Explore video categories on diVine — comedy, music, dance, animals, sports, food, and more.',
    ogImage: '/og.avif',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: 'Browse Categories - diVine',
    twitterDescription: 'Explore video categories on diVine — comedy, music, dance, animals, sports, food, and more.',
    twitterImage: '/og.avif',
  });

  return (
    <AppPage width="wide">
      <AppPageHeader
        eyebrow="Topic browsing"
        title="Categories"
        description="Browse the network by topic and jump into tighter video feeds."
      >
        <DiscoverySectionNav active="categories" />
      </AppPageHeader>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[28px]" />
          ))}
        </div>
      ) : categories && categories.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map(cat => (
            <SmartLink
              key={cat.name}
              to={`/category/${cat.name}`}
              className="app-surface group flex min-h-32 flex-col items-center justify-center gap-2 px-4 py-5 text-center transition-transform duration-200 hover:-translate-y-0.5"
            >
              <span className="text-4xl">{cat.config?.emoji || ''}</span>
              <span className="text-sm font-semibold">
                {cat.config?.label || cat.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {cat.video_count.toLocaleString()} {cat.video_count === 1 ? 'video' : 'videos'}
              </span>
            </SmartLink>
          ))}
        </div>
      ) : (
        <div className="app-surface py-16 text-center text-muted-foreground">
          No categories available right now.
        </div>
      )}
    </AppPage>
  );
}

export default CategoriesIndexPage;
