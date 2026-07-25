// ABOUTME: Homepage copy block on healthier social media, linking the family guides and Divine Greenlight
// ABOUTME: Styled to match the joyscrolling block above it — heading plus one muted paragraph

import { SectionHeader } from "@/components/brand/SectionHeader";

// Inline link treatment for body copy on a light surface, same as the static pages.
const LINK_CLASS =
  "text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80";

export function FamilyWelcomeSection() {
  return (
    <section aria-labelledby="family-welcome" className="mt-8" data-testid="family-welcome">
      <SectionHeader as="h2" id="family-welcome" className="text-xl sm:text-2xl mb-2">
        Building a healthier social media experience
      </SectionHeader>
      <p className="max-w-xl text-muted-foreground text-pretty">
        Screen time is a battle in many homes. It does not have to be. Some of our
        favorite videos are made by parents and kids together, and our{" "}
        <a href="/family" className={LINK_CLASS}>
          family guides
        </a>{" "}
        help start the conversations that matter.
      </p>
      {/*
        Second paragraph tracks /kids and the Terms: 16+ without parental
        involvement, parent-held accounts under 13, Greenlight for 13-15 where
        local law allows. Keep these three claims in sync with those pages.
      */}
      <p className="mt-3 max-w-xl text-muted-foreground text-pretty">
        Divine is designed for ages 16 and up, but we know younger people may still want
        to participate. Children under 13 cannot hold their own accounts; a parent or
        guardian must manage the account, though kids can appear in videos. Where local
        rules permit,{" "}
        <a href="/kids#13-15" className={LINK_CLASS}>
          Divine Greenlight
        </a>{" "}
        gives teens ages 13–15 a guided start alongside a parent or guardian.
      </p>
    </section>
  );
}
