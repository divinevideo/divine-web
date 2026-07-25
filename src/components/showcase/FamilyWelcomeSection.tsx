// ABOUTME: Homepage copy block on healthier social media, linking the kids policy, family hub, and Greenlight
// ABOUTME: Styled to match the joyscrolling block above it — heading plus one muted paragraph

import { SectionHeader } from "@/components/brand/SectionHeader";
import { cn } from "@/lib/utils";

// Inline link treatment for body copy on a light surface, same as the static pages.
const LINK_CLASS =
  "text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80";

export function FamilyWelcomeSection({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="family-welcome"
      className={cn("mt-8", className)}
      data-testid="family-welcome"
    >
      <SectionHeader as="h2" id="family-welcome" className="text-xl sm:text-2xl mb-2">
        Building a healthier social media experience
      </SectionHeader>
      <p className="max-w-xl text-muted-foreground text-pretty">
        We believe the challenges of an increasingly digital world call for better
        solutions than blanket bans or mass surveillance. As part of our commitment to a
        more
        human-centered internet, we’ve created research-backed tools to help families
        build healthy online habits together. Visit our{" "}
        <a href="/family" className={LINK_CLASS}>
          family resources page
        </a>{" "}
        to learn more.
      </p>
    </section>
  );
}
