// ABOUTME: Homepage copy block on healthier social media, linking the kids policy, family hub, and Greenlight
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
        Social media is facing understandable scrutiny around the world. Divine is not
        built for children under 13, and account rules vary by age and location. Where
        permitted, teens ages 13–15 can join through{" "}
        <a href="/kids#13-15" className={LINK_CLASS}>
          Divine Greenlight
        </a>{" "}
        with an involved parent or guardian. Families are welcome to enjoy Divine
        together, and our{" "}
        <a href="/kids" className={LINK_CLASS}>
          tools
        </a>{" "}
        and{" "}
        <a href="/family" className={LINK_CLASS}>
          resources
        </a>{" "}
        are designed to help them make informed choices as we work toward a better
        internet for everyone.
      </p>
    </section>
  );
}
