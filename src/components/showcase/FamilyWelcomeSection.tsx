// ABOUTME: Homepage copy block inviting families in and pointing teens at Divine Greenlight
// ABOUTME: Styled to match the joyscrolling block above it — heading plus one muted paragraph

import { SectionHeader } from "@/components/brand/SectionHeader";

// Inline link treatment for body copy on a light surface, same as the static pages.
const LINK_CLASS =
  "text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80";

export function FamilyWelcomeSection() {
  return (
    <section aria-labelledby="family-welcome" className="mt-8" data-testid="family-welcome">
      <SectionHeader as="h2" id="family-welcome" className="text-xl sm:text-2xl mb-2">
        Bring the whole house
      </SectionHeader>
      <p className="max-w-xl text-muted-foreground text-pretty">
        In most homes, social media is a thing to argue about—screen time, what they
        saw, who they're talking to. We're building for the opposite. Parents and kids
        make loops together here, and our{" "}
        <a href="/family" className={LINK_CLASS}>
          family guides
        </a>{" "}
        cover the rest. Where local rules allow it, teens 13-15 can start with a parent
        or guardian alongside them through{" "}
        <a href="/kids#13-15" className={LINK_CLASS}>
          Divine Greenlight
        </a>
        .
      </p>
    </section>
  );
}
