// ABOUTME: Family hub page at /family: intro, framing, Divine's role, experts, guide links, resources
// ABOUTME: Long-form guidance lives on the four child pages; this page links out to them

import {
  ArrowSquareOut,
  ChatsCircle,
  Lifebuoy,
  ListChecks,
  UsersThree,
} from "@phosphor-icons/react";

import { MarketingLayout } from "@/components/MarketingLayout";
import { BackToTopButton, staticPageLinkCardClass } from "@/components/static-pages";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { ZendeskWidget } from "@/components/ZendeskWidget";
import { FamilySectionNav } from "@/components/family/FamilySectionNav";
import { FamilyResources } from "@/components/family/FamilyResources";
import { FamilySeoHead } from "@/components/family/FamilySeoHead";
import { StoreBadgesCta } from "@/components/family/StoreBadgesCta";
import { ArticleJsonLd } from "@/components/family/JsonLd";
import {
  ClosingNote,
  FamilyHero,
  FramingBand,
  KidsCrossLink,
} from "@/components/family/sections/HubSections";
import { DivineRoleSection } from "@/components/family/sections/DivineRoleSection";
import { ExpertsSection } from "@/components/family/sections/ExpertsSection";
import { getFamilySeo } from "@/seo/marketingSeo";

const GUIDES = [
  {
    to: "/family/talking-to-your-teen",
    // Legacy in-page anchor ids preserved so old /family#talking links still land here
    ids: ["talking"],
    icon: <ChatsCircle weight="fill" className="h-6 w-6" />,
    title: "Talking with your teen",
    description:
      "How to keep the conversation open—plus starters that work better than interrogations.",
  },
  {
    to: "/family/media-plan",
    ids: ["plan", "habits"],
    icon: <UsersThree weight="fill" className="h-6 w-6" />,
    title: "Creating a family media plan",
    description:
      "Build a plan together for where, when, and how your household uses media—and revisit it as kids grow.",
  },
  {
    to: "/family/when-something-goes-wrong",
    ids: ["upset"],
    icon: <Lifebuoy weight="fill" className="h-6 w-6" />,
    title: "When something goes wrong",
    description:
      "Four steps for the moment your child sees something upsetting—and when to escalate.",
  },
  {
    to: "/family/safety-tools",
    ids: ["settings"],
    icon: <ListChecks weight="fill" className="h-6 w-6" />,
    title: "Understanding content settings",
    description:
      "How adult-content gating, filters, blocking, muting, and reporting work on Divine—and their limits.",
  },
];

export function FamilyHubPage() {
  const seo = getFamilySeo("/family");

  return (
    <MarketingLayout>
      {seo && <FamilySeoHead seo={seo} />}
      {seo && <ArticleJsonLd seo={seo} citeStirLab />}
      <ZendeskWidget />
      <BackToTopButton />

      <FamilyHero>
        <FamilySectionNav className="mt-10 [&_a]:border-brand-green/40 [&_a]:text-brand-light-green" />
      </FamilyHero>

      <FramingBand />

      <div className="container mx-auto px-4 py-16 max-w-4xl space-y-16">
        {/* Guide links out to the four child pages */}
        <section aria-label="Family guides">
          <SectionHeader as="h2" className="text-3xl md:text-4xl mb-6">
            The guides
          </SectionHeader>
          <div className="grid gap-5 md:grid-cols-2">
            {GUIDES.map((guide) => (
              <a
                key={guide.to}
                href={guide.to}
                id={guide.ids[0]}
                className={staticPageLinkCardClass("green")}
              >
                {guide.ids.slice(1).map((id) => (
                  <span key={id} id={id} />
                ))}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-brand-dark-green dark:text-brand-green mb-2">
                      {guide.icon}
                    </div>
                    <h3 className="font-display font-extrabold tracking-tight text-xl text-brand-dark-green dark:text-brand-off-white">
                      {guide.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {guide.description}
                    </p>
                  </div>
                  <ArrowSquareOut className="h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green group-hover:translate-x-0.5 transition-transform" />
                </div>
              </a>
            ))}
          </div>
        </section>

        <DivineRoleSection />

        {/* Highest-trust moment on the page: right after the honest can/can't section */}
        <StoreBadgesCta campaign="family" />

        <ExpertsSection />

        <FamilyResources />

        <KidsCrossLink />

        <div className="pt-12 border-t border-brand-dark-green/10 dark:border-brand-green/20">
          <StoreBadgesCta campaign="family" withSignup />
        </div>

        <ClosingNote />
      </div>
    </MarketingLayout>
  );
}

export default FamilyHubPage;
