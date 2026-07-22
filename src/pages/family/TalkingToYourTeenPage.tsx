// ABOUTME: /family/talking-to-your-teen: how to talk with your teen about social media
// ABOUTME: Copy moved verbatim from the original /family "Talking with your teen" section

import { ChatsCircle } from "@phosphor-icons/react";

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
  CONVERSATION_STARTERS,
  TalkingContent,
} from "@/components/family/sections/TalkingContent";
import { getFamilySeo } from "@/seo/marketingSeo";

export const TALKING_LEAD =
  "The goal isn't to win the conversation. It's to keep having one. Teens who feel heard stay open. Teens who feel surveilled go quiet.";

// FAQ answers are verbatim page copy; the question phrasings are new framing for markup only.
const FAQ_ENTRIES = [
  {
    question: "How do I talk with my teen about social media?",
    answer: TALKING_LEAD,
  },
  {
    question: "Should I monitor my teen's social media?",
    answer:
      "Sit next to them on the app sometimes. Ask who they follow. Ask what's funny right now. You'll learn more in five minutes of scrolling together than in a month of monitoring software. Surveillance shifts the dynamic. Curiosity keeps it open.",
  },
  {
    question: "What should I do if I find something concerning?",
    answer:
      'If you find something concerning, lead with a question. "Tell me what was happening when you saw this" gets you more than "you\'re grounded." Big consequences for the first disclosure usually buy you silence on the second one.',
  },
  {
    question: "What are good conversation starters about social media?",
    answer: `${CONVERSATION_STARTERS.join(" ")} Use these as warm-up questions, not interrogations. One good question per car ride is plenty.`,
  },
];

export function TalkingToYourTeenPage() {
  const seo = getFamilySeo("/family/talking-to-your-teen");

  return (
    <MarketingLayout>
      {seo && <FamilySeoHead seo={seo} />}
      {seo && <ArticleJsonLd seo={seo} citeStirLab />}
      {seo && <BreadcrumbJsonLd seo={seo} />}
      <FaqJsonLd entries={FAQ_ENTRIES} />
      <ZendeskWidget />
      <BackToTopButton />

      <FamilyPageHero
        icon={<ChatsCircle weight="fill" className="h-4 w-4" />}
        title="How to talk with your teen about social media"
        lead={TALKING_LEAD}
      />

      <div className="container mx-auto px-4 py-16 max-w-4xl space-y-16">
        <Anchor id="talking">
          <TalkingContent />
        </Anchor>

        <FamilyResources include={["guidance", "help"]} />

        <div className="pt-12 border-t border-brand-dark-green/10 dark:border-brand-green/20">
          <StoreBadgesCta campaign="talking-to-your-teen" withSignup />
        </div>

        <FamilySectionNav />
      </div>
    </MarketingLayout>
  );
}

export default TalkingToYourTeenPage;
