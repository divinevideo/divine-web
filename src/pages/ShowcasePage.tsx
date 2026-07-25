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
          Mobile: a single stacked column — hero copy, the taste intro, then the
          phone below (unchanged from before).
          Desktop (lg): two columns — all the copy on the left, the phone pinned
          to the right so it sits above the fold. Top-aligned so the headline and
          the phone both start high, with no dead space above.
        */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
          {/* Left column: all the copy, left-aligned in its half. */}
          <div className="max-w-xl">
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
                Enjoy this hand-crafted set of what's happening on Divine right now, from
                nostalgic classics to fresh, new takes. Want more? Grab the app to join in
                the fun.
              </p>
              {isEmpty && (
                <p className="mt-4 text-muted-foreground" data-testid="showcase-empty">
                  {isUnconfigured
                    ? "The reel isn't set up yet. Grab the app to see what people are making."
                    : 'Nothing picked out right now. Grab the app to see what people are making.'}
                </p>
              )}
            </div>

            <FamilyWelcomeSection />
          </div>

          {/* Right column (desktop) / below the copy (mobile): the phone,
              centered in its half so it sits in the middle of the space it has
              and shifts with the window width. */}
          <div
            className="mt-8 flex justify-center lg:mt-0"
            data-testid="curated-showcase"
          >
            <ShowcasePhone isLoading={isLoading} isEmpty={isEmpty} videos={videos} />
          </div>
        </div>
      </main>
    </MarketingLayout>
  );
}
