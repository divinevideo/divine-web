// ABOUTME: Homepage section inviting families in and pointing teens at Divine Greenlight
// ABOUTME: Links out to the /family hub and the 13-15 section of the kids policy

import { ArrowSquareOut, HouseLine, VideoCamera } from "@phosphor-icons/react";

import { SectionHeader } from "@/components/brand/SectionHeader";
import { staticPageLinkCardClass, type LinkCardAccent } from "@/components/static-pages";

interface FamilyLink {
  to: string;
  accent: LinkCardAccent;
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}

const LINKS: FamilyLink[] = [
  {
    to: "/family",
    accent: "green",
    icon: <HouseLine weight="fill" className="h-6 w-6" />,
    title: "Families on Divine",
    body: "Parents and kids make loops together here, and it's genuinely some of our favorite stuff on the app. The family guides cover content settings, starting a conversation that isn't an interrogation, and what to do when something goes wrong.",
  },
  {
    to: "/kids#13-15",
    accent: "violet",
    icon: <VideoCamera weight="fill" className="h-6 w-6" />,
    title: "Divine Greenlight, for teens 13-15",
    // Deliberately hedged: Greenlight depends on local law and on a parent or
    // guardian video. Don't let homepage copy promise more than /kids does.
    body: "Where local rules allow it, a teen can hold their own account with a parent or guardian in it from day one. A short video together, then good habits built alongside someone—instead of figured out alone.",
  },
];

export function FamilyWelcomeSection() {
  return (
    <section
      aria-labelledby="family-welcome"
      className="mt-16 pt-12 border-t border-brand-dark-green/10 dark:border-brand-green/20"
      data-testid="family-welcome"
    >
      <SectionHeader as="h2" id="family-welcome" className="text-xl sm:text-2xl mb-2">
        Bring the whole house
      </SectionHeader>
      <p className="max-w-2xl text-muted-foreground text-pretty">
        In most homes, social media is a thing to argue about—screen time, what they
        saw, who they're talking to. We're building for the opposite: a place the
        whole family can actually enjoy together.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {LINKS.map((link) => (
          <a key={link.to} href={link.to} className={staticPageLinkCardClass(link.accent)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-brand-dark-green dark:text-brand-green mb-2">
                  {link.icon}
                </div>
                <h3 className="font-display font-extrabold tracking-tight text-lg text-brand-dark-green dark:text-brand-off-white">
                  {link.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {link.body}
                </p>
              </div>
              <ArrowSquareOut className="h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green group-hover:translate-x-0.5 transition-transform" />
            </div>
          </a>
        ))}
      </div>

      <p className="mt-5 max-w-2xl text-sm text-muted-foreground">
        No app fixes this on its own. It also doesn't have to make it worse.
      </p>
    </section>
  );
}
