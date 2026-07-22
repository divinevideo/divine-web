// ABOUTME: Hub-only sections moved verbatim from FamilyPage: hero, framing band, kids cross-link, closing note
// ABOUTME: The hero accepts children so the hub can slot in navigation below the intro copy

import { Compass, HouseLine, Lightbulb, Pause, ArrowSquareOut } from "@phosphor-icons/react";

import { staticPageLinkCardClass } from "@/components/static-pages";

import { FrameStep } from "./shared";

export function FamilyHero({ children }: { children?: React.ReactNode }) {
  return (
    <section className="bg-brand-dark-green text-brand-off-white">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-green mb-6">
          <HouseLine weight="fill" className="h-4 w-4" />
          <span>For families on Divine</span>
        </div>
        <h1 className="font-display font-extrabold tracking-tight text-4xl md:text-6xl leading-[1.05] text-brand-off-white mb-6">
          Safer social media use starts with conversation.
        </h1>
        <p className="text-lg md:text-xl text-brand-light-green max-w-3xl leading-relaxed">
          Divine can help families reduce some risks and build healthier
          habits around social media use, but no app can replace
          conversation, supervision, and thoughtful boundaries at home.
        </p>
        <p className="text-base md:text-lg text-brand-off-white/80 max-w-3xl leading-relaxed mt-4">
          This page is a starting point for parents, guardians, and
          teens—not a contract, not a control panel, and not a replacement
          for Divine's{" "}
          <a
            href="/terms"
            className="text-brand-green underline underline-offset-2 hover:text-brand-light-green"
          >
            Terms
          </a>
          ,{" "}
          <a
            href="/privacy"
            className="text-brand-green underline underline-offset-2 hover:text-brand-light-green"
          >
            Privacy Policy
          </a>
          ,{" "}
          <a
            href="/safety"
            className="text-brand-green underline underline-offset-2 hover:text-brand-light-green"
          >
            Safety Standards
          </a>
          ,{" "}
          <a
            href="/kids"
            className="text-brand-green underline underline-offset-2 hover:text-brand-light-green"
          >
            Kids Policy
          </a>
          , or reporting tools. It's the stuff we wish more apps said out
          loud.
        </p>

        {children}
      </div>
    </section>
  );
}

export function FramingBand() {
  return (
    <section id="framing" className="scroll-mt-24 bg-brand-light-green/30 dark:bg-brand-dark-green/40 border-y border-brand-dark-green/10 dark:border-brand-green/20">
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <p className="text-xs font-semibold tracking-wide text-brand-dark-green dark:text-brand-green mb-4">
          A simple framing
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          <FrameStep
            icon={<Pause weight="fill" className="h-6 w-6" />}
            label="Pause"
            body="Notice what's happening before you react. For teens, that's catching the urge to scroll. For parents, that's catching the urge to confiscate."
          />
          <FrameStep
            icon={<Lightbulb weight="fill" className="h-6 w-6" />}
            label="Reflect"
            body="Ask, don't assume. What did you see? How did it land? Is something here worth paying attention to?"
          />
          <FrameStep
            icon={<Compass weight="fill" className="h-6 w-6" />}
            label="Redirect"
            body="Pick the next step together—a setting to try, a person to mute, a break to take, a thing to do off the app."
          />
        </div>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground/80">
          This framing is drawn from{" "}
          <a
            href="https://doi.org/10.3390/socsci14050302"
            className="underline underline-offset-2 hover:text-brand-dark-green dark:hover:text-brand-green"
          >
            peer-reviewed research on youth online safety
          </a>
          .
        </p>
      </div>
    </section>
  );
}

export function KidsCrossLink() {
  return (
    <div className="pt-12 border-t border-brand-dark-green/10 dark:border-brand-green/20">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-dark-green dark:text-brand-green mb-4">
        <HouseLine weight="fill" className="h-4 w-4" />
        <span>More from Divine</span>
      </div>
      <a
        href="/kids"
        className={staticPageLinkCardClass("violet")}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display font-extrabold tracking-tight text-xl text-brand-dark-green dark:text-brand-off-white">
              Looking for the account rules for kids and teens?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The policy page covers how accounts work for under-16s,
              the family-account carve-out, and what happens to
              under-13 accounts at{" "}
              <span className="font-medium text-brand-dark-green dark:text-brand-green">
                divine.video/kids
              </span>
              .
            </p>
          </div>
          <ArrowSquareOut className="h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green group-hover:translate-x-0.5 transition-transform" />
        </div>
      </a>
    </div>
  );
}

export function ClosingNote() {
  return (
    <div className="pt-8 border-t border-brand-dark-green/10 dark:border-brand-green/20">
      <p className="text-sm text-muted-foreground leading-relaxed">
        This page is part of Divine's commitment to being honest about
        what apps can and can't do for families. It's not legal
        advice, clinical advice, or a substitute for talking to the people
        in your home. If you have feedback or want to suggest a resource,
        reach out through{" "}
        <a
          href="/support"
          className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80"
        >
          Divine support
        </a>
        .
      </p>
    </div>
  );
}
