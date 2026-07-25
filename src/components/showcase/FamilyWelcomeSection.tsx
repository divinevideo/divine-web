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
        No app has all the answers, and we don’t pretend to. We’re parents and social
        media users, too, trying to make the internet more thoughtful, creative, and
        human. That means helping families have productive conversations about screens,
        decide what works for them, and build healthier online habits together. Our
        research-backed{" "}
        <a href="/family" className={LINK_CLASS}>
          family guides
        </a>{" "}
        and{" "}
        <a href="/kids#13-15" className={LINK_CLASS}>
          Divine Greenlight
        </a>{" "}
        are here to help.
      </p>
    </section>
  );
}
