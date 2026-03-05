// ABOUTME: Category index page showing all available content categories in a browseable grid
// ABOUTME: Displays category emoji, name, and video count with links to individual category pages

import { SmartLink } from '@/components/SmartLink';
import { useSeoMeta } from '@unhead/react';
import { useCategories } from '@/hooks/useCategories';
import { Skeleton } from '@/components/ui/skeleton';

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
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Categories</h1>
          <p className="text-muted-foreground mt-1">
            Browse videos by topic
          </p>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : categories && categories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categories.map(cat => (
              <SmartLink
                key={cat.name}
                to={`/category/${cat.name}`}
                className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted hover:border-primary"
              >
                <span className="text-3xl">{cat.config?.emoji || ''}</span>
                <span className="font-medium text-sm text-center">
                  {cat.config?.label || cat.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {cat.video_count.toLocaleString()} {cat.video_count === 1 ? 'video' : 'videos'}
                </span>
              </SmartLink>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-12">
            No categories available right now.
          </p>
        )}
      </div>
    </div>
  );
}

export default CategoriesIndexPage;
