// ABOUTME: /family/when-something-goes-wrong: what to do if your child saw something upsetting
// ABOUTME: Copy moved verbatim; the CSAM escalation guidance wording must never be altered

import { Lifebuoy } from "@phosphor-icons/react";

import { MarketingLayout } from "@/components/MarketingLayout";
import { Anchor, BackToTopButton } from "@/components/static-pages";
import { ZendeskWidget } from "@/components/ZendeskWidget";
import { FamilyPageHero } from "@/components/family/FamilyPageHero";
import { FamilyResources } from "@/components/family/FamilyResources";
import { FamilySectionNav } from "@/components/family/FamilySectionNav";
import { FamilySeoHead } from "@/components/family/FamilySeoHead";
import { StoreBadgesCta } from "@/components/family/StoreBadgesCta";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from "@/components/family/JsonLd";
import {
  UPSET_LEAD,
  UpsetContent,
} from "@/components/family/sections/UpsetContent";
import { getFamilySeo } from "@/seo/marketingSeo";

// FAQ answers are verbatim page copy (plain-text rendering of the step cards);
// the question phrasings are new framing for markup only.
const FAQ_ENTRIES = [
  {
    question: "What should I do if my child saw something upsetting online?",
    answer:
      "1. Pause first: take a breath before reacting. Your first response sets whether your teen tells you the next time something happens. 2. Talk before punishing: ask what they saw, how they came across it, and how it felt. Try to listen for longer than you talk. Punishment can come later if it's actually warranted—disclosure has to come first. 3. Use the in-app tools: report the content or account in the app. Mute or block the source. Walk through the steps together so your teen knows how to do it next time without you. For serious reports, write down the username, approximate time, and what happened, but don't repost, forward, or save harmful content just to document it. 4. Know when to escalate: if something looks illegal, involves a minor, or feels like it's escalating offline, contact Divine support and, when appropriate, local authorities.",
  },
  {
    question: "When should I escalate to Divine support or the authorities?",
    answer:
      "If something looks illegal, involves a minor, or feels like it's escalating offline, contact Divine support and, when appropriate, local authorities. Do not download, save, repost, forward, or share suspected child sexual abuse material (CSAM). Use the in-app report flow or Divine support so Divine can review and, where required, report apparent child sexual exploitation to the appropriate reporting channel or authority. Trust your gut on this one.",
  },
];

export function WhenSomethingGoesWrongPage() {
  const seo = getFamilySeo("/family/when-something-goes-wrong");

  return (
    <MarketingLayout>
      {seo && <FamilySeoHead seo={seo} />}
      {seo && <ArticleJsonLd seo={seo} />}
      {seo && <BreadcrumbJsonLd seo={seo} />}
      <FaqJsonLd entries={FAQ_ENTRIES} />
      <ZendeskWidget />
      <BackToTopButton />

      <FamilyPageHero
        icon={<Lifebuoy weight="fill" className="h-4 w-4" />}
        title="What to do if your child saw something upsetting"
        lead={UPSET_LEAD}
      />

      <div className="container mx-auto px-4 py-16 max-w-4xl space-y-16">
        <Anchor id="upset">
          <UpsetContent />
        </Anchor>

        <FamilyResources include={["help", "guidance"]} />

        <div className="pt-12 border-t border-brand-dark-green/10 dark:border-brand-green/20">
          <StoreBadgesCta campaign="when-something-goes-wrong" withSignup />
        </div>

        <FamilySectionNav />
      </div>
    </MarketingLayout>
  );
}

export default WhenSomethingGoesWrongPage;
