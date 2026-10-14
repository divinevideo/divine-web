// ABOUTME: /family/safety-tools: how content settings work on Divine plus what Divine can and can't do
// ABOUTME: Copy moved verbatim; the "can't promise" statements are the point—do not soften

import { ListChecks } from "@phosphor-icons/react";

import { MarketingLayout } from "@/components/MarketingLayout";
import { Anchor, BackToTopButton } from "@/components/static-pages";
import { ZendeskWidget } from "@/components/ZendeskWidget";
import { FamilyPageHero } from "@/components/family/FamilyPageHero";
import { FamilyResources } from "@/components/family/FamilyResources";
import { FamilySectionNav } from "@/components/family/FamilySectionNav";
import { FamilySeoHead } from "@/components/family/FamilySeoHead";
import { StoreBadgesCta } from "@/components/family/StoreBadgesCta";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/family/JsonLd";
import {
  ContentSettingsContent,
  SETTINGS_LEAD,
} from "@/components/family/sections/ContentSettingsContent";
import { DivineRoleSection } from "@/components/family/sections/DivineRoleSection";
import { getFamilySeo } from "@/seo/marketingSeo";

export function SafetyToolsPage() {
  const seo = getFamilySeo("/family/safety-tools");

  return (
    <MarketingLayout>
      {seo && <FamilySeoHead seo={seo} />}
      {seo && <ArticleJsonLd seo={seo} />}
      {seo && <BreadcrumbJsonLd seo={seo} />}
      <ZendeskWidget />
      <BackToTopButton />

      <FamilyPageHero
        icon={<ListChecks weight="fill" className="h-4 w-4" />}
        title="How content settings work on Divine"
        lead={SETTINGS_LEAD}
      />

      <div className="container mx-auto px-4 py-16 max-w-4xl space-y-16">
        <Anchor id="settings">
          <ContentSettingsContent />
        </Anchor>

        <DivineRoleSection />

        {/* Highest-trust moment: right after the honest can/can't section */}
        <StoreBadgesCta campaign="safety-tools" />

        <FamilyResources include={["help"]} />

        <div className="pt-12 border-t border-brand-dark-green/10 dark:border-brand-green/20">
          <StoreBadgesCta campaign="safety-tools" withSignup />
        </div>

        <FamilySectionNav />
      </div>
    </MarketingLayout>
  );
}

export default SafetyToolsPage;
