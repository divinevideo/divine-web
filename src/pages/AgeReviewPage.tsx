// ABOUTME: External moderation-flow page at /age-review for accounts flagged as possibly under 16
// ABOUTME: Deadline-shaped: 15-day window, 13–15 parent video, 16+ mistake-flag; FAQ-style content lives at /family (see _AgeReviewFAQStaging.tsx)

import { useEffect, useState } from "react";
import {
  Info,
  VideoCamera,
  EnvelopeSimple,
  ShieldCheck,
  Path,
  HouseLine,
  Heart,
  ArrowSquareOut,
  ArrowUp,
  LockKey,
} from "@phosphor-icons/react";

import { MarketingLayout } from "@/components/MarketingLayout";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "support@divine.video";
const REVIEW_WINDOW_DAYS = 15;

interface SectionAnchor {
  id: string;
  title: string;
}

const SECTIONS: SectionAnchor[] = [
  { id: "path-13-15", title: "If you're 13 to 15" },
  { id: "path-mistake", title: "If you're 16 or older" },
  { id: "no-response", title: "If no one responds" },
];

function mailtoLink(subject: string, body?: string): string {
  const params = new URLSearchParams();
  params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${SUPPORT_EMAIL}?${params.toString().replace(/\+/g, "%20")}`;
}

export function AgeReviewPage() {
  return (
    <MarketingLayout>
      <BackToTopButton />

      {/* Hero */}
      <section className="bg-brand-dark-green text-brand-off-white">
        <div className="container mx-auto px-4 py-16 md:py-20 max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-green mb-6">
            <Info weight="fill" className="h-4 w-4" />
            <span>Account review</span>
          </div>
          <h1
            className="font-display font-extrabold tracking-tight text-4xl md:text-5xl leading-[1.05] text-brand-off-white mb-6"
            style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
          >
            Your account is under review
          </h1>
          <p className="text-lg md:text-xl text-brand-light-green max-w-3xl leading-relaxed">
            Divine flagged this account as possibly belonging to someone under
            16. To keep the account open, the steps on this page need to happen
            within{" "}
            <strong className="text-brand-off-white">
              {REVIEW_WINDOW_DAYS} days
            </strong>{" "}
            of the in-app notice.
          </p>
          <p className="text-base md:text-lg text-brand-off-white/80 max-w-3xl leading-relaxed mt-4">
            While the review is open, the account is suspended—you can read
            this page and email Divine, but you can't post or engage publicly.
            After {REVIEW_WINDOW_DAYS} days with no response, support closes
            the account and deletes the personal information Divine holds
            about it.
          </p>

          {/* Anchor nav */}
          <nav
            aria-label="On this page"
            className="mt-10 grid gap-2 sm:grid-cols-3 text-sm"
          >
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-xl border border-brand-green/40 bg-brand-dark-green/40 px-4 py-3 text-brand-light-green hover:bg-brand-green/10 hover:border-brand-green transition-colors"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <div className="container mx-auto px-4 py-14 md:py-16 max-w-4xl space-y-14">
        {/* Honest note for under-13 readers—placed first so a kid
            reading the page lands on this before scrolling through the
            13–15 instructions and assuming a parent video might apply.
            Intentionally not a path-shaped card (no CardHeader, no
            mailto button)—the action paths below don't apply, and
            emailing doesn't pause the clock for under-13. */}
        <Card variant="brand">
          <CardContent className="pt-6 space-y-3 text-base leading-relaxed">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-dark-green dark:text-brand-green">
              <Heart weight="fill" className="h-4 w-4" />
              <span>A note for anyone under 13 reading this</span>
            </div>
            <p>
              We're sorry. Divine has to close under-13 accounts at the
              15-day mark and delete the data Divine holds. Emailing
              won't pause the clock here—the rules around services for
              kids under 13 tie our hands. The same person can come back
              and create a new account when they're 13 or older (with
              parental consent required between ages 13-15).
            </p>
          </CardContent>
        </Card>

        {/* 1. 13-15 path */}
        <Anchor id="path-13-15">
          <SectionHero
            eyebrow="Step-by-step"
            icon={<VideoCamera weight="fill" className="h-7 w-7" />}
            title="If you're 13 to 15"
            lead={`Teens 13 to 15 can use Divine with a parent or guardian who's aware and involved. To keep the account open, a parent or guardian sends a short private video confirming the situation. The email needs to land within ${REVIEW_WINDOW_DAYS} days of the in-app notice.`}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <Card variant="brand" accent="green">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <VideoCamera weight="fill" className="h-5 w-5 text-brand-green" />
                  What the video should show
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-base leading-relaxed">
                <ul className="space-y-2 list-disc pl-5 marker:text-brand-green">
                  <li>The teen, on camera.</li>
                  <li>A parent or guardian, also on camera, speaking.</li>
                  <li>
                    A clear statement that the teen is between 13 and 15.
                  </li>
                  <li>
                    A clear statement that the teen has permission to use
                    Divine.
                  </li>
                  <li>
                    A clear statement that the parent or guardian knows about
                    the account and will supervise its use.
                  </li>
                </ul>
                <p className="text-sm text-muted-foreground pt-1">
                  Phone-camera quality is fine. There's no script—natural
                  is better. Keep it short.
                </p>
              </CardContent>
            </Card>

            <Card variant="brand" accent="blue">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <EnvelopeSimple weight="fill" className="h-5 w-5 text-brand-blue" />
                  How to send it
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-base leading-relaxed">
                <ol className="space-y-3 list-none pl-0">
                  <li className="flex items-start gap-3">
                    <span
                      className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums"
                      aria-hidden="true"
                    >
                      1.
                    </span>
                    <span>
                      Email{" "}
                      <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80 break-all"
                      >
                        {SUPPORT_EMAIL}
                      </a>{" "}
                      from a parent or guardian's email address.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span
                      className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums"
                      aria-hidden="true"
                    >
                      2.
                    </span>
                    <span>Attach the video, or include a private link to it.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span
                      className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums"
                      aria-hidden="true"
                    >
                      3.
                    </span>
                    <span>
                      Include the account's username so the team can match
                      it up.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span
                      className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums"
                      aria-hidden="true"
                    >
                      4.
                    </span>
                    <span>
                      Don't post the video in the app. It stays between
                      the family and Divine support.
                    </span>
                  </li>
                </ol>

                <div className="pt-2">
                  <SupportEmailButton
                    href={mailtoLink(
                      "Account review—13 to 15",
                      "Hi Divine support,\n\nI'm a parent or guardian. I'm attaching a short private video to confirm the account on Divine.\n\nAccount username or link:\n\nTeen's age (13, 14, or 15):\n\nThanks,",
                    )}
                    label={`Email ${SUPPORT_EMAIL}`}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card variant="brand" className="mt-6">
            <CardContent className="pt-6 space-y-3 text-base leading-relaxed">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-dark-green dark:text-brand-green">
                <LockKey weight="fill" className="h-4 w-4" />
                <span>A note on privacy</span>
              </div>
              <p>
                The video is used to confirm the situation and is handled by
                Divine's support and trust &amp; safety team. It isn't
                published anywhere on Divine and isn't shared with other
                users.
              </p>
            </CardContent>
          </Card>
        </Anchor>

        {/* 2. 16+ mistake path */}
        <Anchor id="path-mistake">
          <SectionHero
            eyebrow="For users 16 or older"
            icon={<ShieldCheck weight="fill" className="h-7 w-7" />}
            title="If you're 16 or older and this is a mistake"
            lead={`Reviews can be triggered by signals that don't always land on the right account. If you're 16 or older and the account was flagged in error, send a short email within ${REVIEW_WINDOW_DAYS} days and the team will take another look.`}
          />

          <Card variant="brand" accent="pink">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <EnvelopeSimple weight="fill" className="h-5 w-5 text-brand-pink" />
                What to send Divine support
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-base leading-relaxed">
              <ol className="space-y-3 list-none pl-0">
                <li className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums"
                    aria-hidden="true"
                  >
                    1.
                  </span>
                  <span>
                    Email{" "}
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80 break-all"
                    >
                      {SUPPORT_EMAIL}
                    </a>{" "}
                    with the subject line{" "}
                    <span className="font-medium">
                      "I am 16 or older and think this account was flagged
                      by mistake."
                    </span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums"
                    aria-hidden="true"
                  >
                    2.
                  </span>
                  <span>Say briefly that you are 16 or older.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums"
                    aria-hidden="true"
                  >
                    3.
                  </span>
                  <span>
                    Include the account's username or a link to its
                    profile.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums"
                    aria-hidden="true"
                  >
                    4.
                  </span>
                  <span>
                    Add any context that might be helpful—anything you
                    think the team should know.
                  </span>
                </li>
              </ol>

              <p className="text-muted-foreground">
                Keep it short. The team will review and reply with next steps.
              </p>

              <div className="pt-2">
                <SupportEmailButton
                  href={mailtoLink(
                    "I am 16 or older and think this account was flagged by mistake",
                    "Hi Divine support,\n\nI'm 16 or older and I think this account was flagged by mistake.\n\nAccount username or link:\n\nAny helpful context:\n\nThanks,",
                  )}
                  label={`Email ${SUPPORT_EMAIL}`}
                />
              </div>
            </CardContent>
          </Card>
        </Anchor>

        {/* 3. No-response section—what happens when the clock runs out */}
        <Anchor id="no-response">
          <SectionHero
            eyebrow="If we don't hear from you"
            icon={<Path weight="fill" className="h-7 w-7" />}
            title={`What happens after ${REVIEW_WINDOW_DAYS} days with no response`}
            lead={`After ${REVIEW_WINDOW_DAYS} days with no email to support, the account is closed and the personal information Divine holds about it is deleted. The closed account doesn't come back.`}
          />

          <Card variant="brand" accent="orange">
            <CardContent className="pt-6 space-y-3 text-base leading-relaxed">
              <ul className="space-y-2 list-disc pl-5 marker:text-brand-orange">
                <li>
                  Support closes the account and deletes everything tied to
                  it from Divine's infrastructure—profile, videos,
                  comments, follow lists, and any email or IP-derived data
                  on file.
                </li>
                <li>
                  Divine issues a deletion request across the Nostr network.
                  Copies of videos that propagated to relays Divine doesn't
                  operate may persist outside Divine's reach.
                </li>
                <li>
                  The same person can create a new account later when they
                  meet the age and consent conditions—but the closed
                  account itself doesn't return.
                </li>
              </ul>
              <p className="text-sm text-muted-foreground pt-2">
                Any email to{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80 break-all"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                from the account holder or a parent or guardian stops the
                clock. A "we're working on it" reply counts.
              </p>
            </CardContent>
          </Card>
        </Anchor>

        {/* 4. Link to broader policy at /kids */}
        <Anchor id="more-context">
          <SectionHero
            eyebrow="More context"
            icon={<HouseLine weight="fill" className="h-7 w-7" />}
            title="Want to understand the broader policy?"
            lead="The full picture—how families can use Divine together on a parent-held account, what happens to under-13 accounts, and why Divine works this way—lives on the kids policy page."
          />

          <a
            href="/kids"
            className="group block brand-card brand-offset-shadow-green p-6 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:8px_8px_0_0_hsl(var(--brand-green))] transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-extrabold tracking-tight text-xl text-brand-dark-green dark:text-brand-off-white">
                  Open the kids policy page
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Policy explainer, family-account guidance, and the longer
                  read at{" "}
                  <span className="font-medium text-brand-dark-green dark:text-brand-green">
                    divine.video/kids
                  </span>
                  .
                </p>
              </div>
              <ArrowSquareOut className="h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green group-hover:translate-x-0.5 transition-transform" />
            </div>
          </a>
        </Anchor>

        {/* Closing note */}
        <div className="pt-8 border-t border-brand-dark-green/10 dark:border-brand-green/20">
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you sent an email and haven't heard back, email{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80 break-all"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            again. The team would rather hear from you twice than miss a
            message.
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default AgeReviewPage;

// ——————————————————————————————————————————————————————————————
// Local presentation helpers
// ——————————————————————————————————————————————————————————————

function SupportEmailButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="sticker" size="lg">
      <a href={href} className="inline-flex items-center gap-2">
        <EnvelopeSimple weight="fill" className="h-4 w-4" />
        {label}
      </a>
    </Button>
  );
}

function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={goTop}
      aria-label="Back to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 h-12 w-12 rounded-full bg-brand-green text-brand-dark-green border-2 border-brand-dark-green brand-offset-shadow-sm-dark flex items-center justify-center transition-all duration-200 hover:-translate-x-[2px] hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark-green focus-visible:ring-offset-2 ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-2 pointer-events-none"
      }`}
    >
      <ArrowUp weight="bold" className="h-5 w-5" />
    </button>
  );
}

function Anchor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      {children}
    </section>
  );
}

function SectionHero({
  eyebrow,
  icon,
  title,
  lead,
}: {
  eyebrow: string;
  icon: React.ReactNode;
  title: string;
  lead: string;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-dark-green dark:text-brand-green mb-3">
        {icon}
        <span>{eyebrow}</span>
      </div>
      <SectionHeader as="h2" className="text-3xl md:text-4xl mb-4">
        {title}
      </SectionHeader>
      <p className="text-lg leading-relaxed text-muted-foreground max-w-3xl">
        {lead}
      </p>
    </div>
  );
}
