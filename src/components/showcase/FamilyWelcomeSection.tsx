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
        Screen time is a fight in a lot of homes. It doesn't have to be. Parents and
        kids make loops together here, and some of our favorite videos are theirs. Our{" "}
        <a href="/family" className={LINK_CLASS}>
          family guides
        </a>{" "}
        cover the conversations that help, and{" "}
        <a href="/kids#13-15" className={LINK_CLASS}>
          Divine Greenlight
        </a>{" "}
        gives teens 13-15 a guided start with a parent or guardian alongside them, where
        local rules allow it.
      </p>
    </section>
  );
}
