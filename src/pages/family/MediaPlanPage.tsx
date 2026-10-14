// ABOUTME: /family/media-plan: creating a family media plan plus healthier feed habits
// ABOUTME: Copy moved verbatim from the original /family plan and habits sections

import { UsersThree } from "@phosphor-icons/react";

import { MarketingLayout } from "@/components/MarketingLayout";
import { Anchor, BackToTopButton } from "@/components/static-pages";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { ZendeskWidget } from "@/components/ZendeskWidget";
import { FamilyPageHero } from "@/components/family/FamilyPageHero";
import { FamilyResources } from "@/components/family/FamilyResources";
import { FamilySectionNav } from "@/components/family/FamilySectionNav";
import { FamilySeoHead } from "@/components/family/FamilySeoHead";
import { StoreBadgesCta } from "@/components/family/StoreBadgesCta";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/family/JsonLd";
import { FeedHabitsSection } from "@/components/family/sections/FeedHabitsSection";
import {
  MEDIA_PLAN_LEAD,
  MediaPlanContent,
} from "@/components/family/sections/MediaPlanContent";
import { getFamilySeo } from "@/seo/marketingSeo";

export function MediaPlanPage() {
  const seo = getFamilySeo("/family/media-plan");

  return (
    <MarketingLayout>
      {seo && <FamilySeoHead seo={seo} />}
      {seo && <ArticleJsonLd seo={seo} />}
      {seo && <BreadcrumbJsonLd seo={seo} />}
      <ZendeskWidget />
      <BackToTopButton />

      <FamilyPageHero
        icon={<UsersThree weight="fill" className="h-4 w-4" />}
        title="Creating a family media plan"
        lead={MEDIA_PLAN_LEAD}
      />

      <div className="container mx-auto px-4 py-16 max-w-4xl space-y-16">
        <Anchor id="plan">
          <SectionHeader as="h2" className="text-3xl md:text-4xl mb-8">
            Building a plan for how your family uses media—not just Divine
          </SectionHeader>
          <MediaPlanContent />
        </Anchor>

        <FeedHabitsSection />

        <FamilyResources include={["plans", "guidance"]} />

        <div className="pt-12 border-t border-brand-dark-green/10 dark:border-brand-green/20">
          <StoreBadgesCta campaign="media-plan" withSignup />
        </div>

        <FamilySectionNav />
      </div>
    </MarketingLayout>
  );
}

export default MediaPlanPage;
