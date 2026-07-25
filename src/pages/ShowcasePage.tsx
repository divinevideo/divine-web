// ABOUTME: Public homepage in showcase mode — what Divine is, where to get it, a curated taste
// ABOUTME: No login, no open feeds; every content route it links to is a document

import { useHead, useSeoMeta } from "@unhead/react";

import { MarketingLayout } from "@/components/MarketingLayout";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { GetAppButton } from "@/components/GetAppButton";
import { ShowcasePhone } from "@/components/showcase/ShowcasePhone";
import { FamilyWelcomeSection } from "@/components/showcase/FamilyWelcomeSection";
import { useCuratedShowcase } from "@/hooks/useCuratedShowcase";

export default function ShowcasePage() {
  const { videos, isLoading, isUnconfigured } = useCuratedShowcase();
  const isEmpty = !isLoading && videos.length === 0;

  useSeoMeta({
    title: "Divine — short video on an open protocol",
    description:
      "Six-second loops, no algorithm feeding you slop. Get Divine on iOS, Android, Zapstore, or build it yourself.",
  });

  useHead({
    link: [{ rel: "canonical", href: "https://divine.video/" }],
  });

  return (
    <MarketingLayout>
      <main className="container mx-auto px-4 py-8 sm:py-10">
        {/*
          Mobile: one stacked column in DOM order — hero copy and the taste
          intro, then the phone, then the family block. The reel has to come
          before the family copy so the thing being described is on screen
          first.
          Desktop (lg): two columns. The copy stacks in column one across two
          rows and the phone spans both rows in column two, which keeps the
          family block tucked under the copy instead of dropping below the
          phone. Row gap is zero because each block carries its own mt-8.
        */}
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-0 lg:items-start">
          {/* Column one, row one: hero copy and the reel intro. */}
          <div className="max-w-xl lg:col-start-1 lg:row-start-1">
            <h1 className="font-extrabold tracking-tight text-3xl sm:text-4xl md:text-5xl text-balance text-brand-dark-green dark:text-brand-off-white">
              Authentic moments. Human creativity.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground text-pretty">
              In a world of AI slop, Divine is putting creativity back in
              human hands. Create, share, and discover old gems and new favorites. This is
              social media for humans, by humans. 6 seconds at a time.
            </p>
            <div className="mt-6">
              <GetAppButton campaign="homepage" medium="homepage_hero" size="lg" />
            </div>

            <div className="mt-8">
              <SectionHeader as="h2" className="text-xl sm:text-2xl mb-2">
                Your joyscrolling era starts now
              </SectionHeader>
              <p className="max-w-xl text-muted-foreground text-pretty">
                Explore a handpicked mix of what’s happening on Divine right now, from
                nostalgic classics to fresh new takes. Ready for more? Download the app
                and join the fun.
              </p>
              {isEmpty && (
                <p className="mt-4 text-muted-foreground" data-testid="showcase-empty">
                  {isUnconfigured
                    ? "The reel isn't set up yet. Grab the app to see what people are making."
                    : 'Nothing picked out right now. Grab the app to see what people are making.'}
                </p>
              )}
            </div>

          </div>

          {/* Column two on desktop, second on mobile: the phone, centered in
              its half so it shifts with the window width. Spans both rows so
              the family block below can sit beside it, not under it. */}
          <div
            className="mt-8 flex justify-center lg:mt-0 lg:col-start-2 lg:row-start-1 lg:row-span-2"
            data-testid="curated-showcase"
          >
            <ShowcasePhone isLoading={isLoading} isEmpty={isEmpty} videos={videos} />
          </div>

          {/* Column one, row two: reads after the reel on both layouts. */}
          <FamilyWelcomeSection className="max-w-xl lg:col-start-1 lg:row-start-2" />
        </div>
      </main>
    </MarketingLayout>
  );
}
