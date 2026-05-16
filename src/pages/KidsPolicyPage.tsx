// ABOUTME: Policy page at /kids explaining how Divine handles accounts for under-16s
// ABOUTME: Long-form FAQ-style page—paired with the deadline-shaped action page at /age-review

import { useEffect, useState } from "react";
import {
  Info,
  UsersThree,
  VideoCamera,
  ShieldCheck,
  ChatsCircle,
  HouseLine,
  EnvelopeSimple,
  ArrowSquareOut,
  ArrowUp,
} from "@phosphor-icons/react";

import { MarketingLayout } from "@/components/MarketingLayout";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "support@divine.video";

interface SectionAnchor {
  id: string;
  title: string;
}

const SECTIONS: SectionAnchor[] = [
  { id: "tiers", title: "At a glance" },
  { id: "why", title: "Why we work this way" },
  { id: "under-13", title: "Under-13 accounts" },
  { id: "13-15", title: "13 to 15 accounts" },
  { id: "family-account", title: "Families on Divine" },
  { id: "family-guidance", title: "More family guidance" },
];

function mailtoLink(subject: string, body?: string): string {
  const params = new URLSearchParams();
  params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${SUPPORT_EMAIL}?${params.toString().replace(/\+/g, "%20")}`;
}

export function KidsPolicyPage() {
  return (
    <MarketingLayout>
      <BackToTopButton />

      {/* Hero */}
      <section className="bg-brand-dark-green text-brand-off-white">
        <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-green mb-6">
            <UsersThree weight="fill" className="h-4 w-4" />
            <span>Kids on Divine</span>
          </div>
          <h1
            className="font-display font-extrabold tracking-tight text-4xl md:text-6xl leading-[1.05] text-brand-off-white mb-6"
            style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
          >
            How accounts work for kids on Divine
          </h1>
          <p className="text-lg md:text-xl text-brand-light-green max-w-3xl leading-relaxed">
            Here's how Divine handles accounts for people under 16—the
            rules, the reasoning, and what families can do together
            regardless of age.
          </p>
          <p className="text-base md:text-lg text-brand-off-white/80 max-w-3xl leading-relaxed mt-4">
            This is the policy page, not a moderation page. If your account
            was just flagged and you have steps to take within a deadline,
            the action page is at{" "}
            <a
              href="/age-review"
              className="underline underline-offset-2 text-brand-light-green hover:text-brand-off-white"
            >
              divine.video/age-review
            </a>
            .
          </p>

          {/* Anchor nav */}
          <nav
            aria-label="On this page"
            className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm"
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

      <div className="container mx-auto px-4 py-14 md:py-16 max-w-4xl space-y-16">
        {/* 1. At a glance—three tier cards */}
        <Anchor id="tiers">
          <SectionHero
            eyebrow="At a glance"
            icon={<Info weight="fill" className="h-7 w-7" />}
            title="Three age tiers, three different paths"
            lead="Divine handles accounts differently depending on who's holding them. The short version:"
          />

          <div className="grid gap-6 md:grid-cols-3">
            <Card variant="brand" accent="violet">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <UsersThree weight="fill" className="h-5 w-5 text-brand-violet" />
                  Under 13
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-base leading-relaxed">
                <p>
                  Parent-held family accounts.
                </p>
                <p className="text-muted-foreground text-sm">
                  A parent or guardian can hold the account and do all the
                  posting; kids of any age can appear in videos with them.
                  If Divine learns of a solo under-13 account, it's closed
                  and the data is deleted.
                </p>
              </CardContent>
            </Card>

            <Card variant="brand" accent="green">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <VideoCamera weight="fill" className="h-5 w-5 text-brand-green" />
                  13 to 15
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-base leading-relaxed">
                <p>
                  Teen-held accounts are allowed, with a short video from a
                  parent or guardian.
                </p>
                <p className="text-muted-foreground text-sm">
                  The video confirms the teen's age, that they have
                  permission, and that the parent or guardian knows about
                  the account and will supervise its use.
                </p>
              </CardContent>
            </Card>

            <Card variant="brand" accent="blue">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck weight="fill" className="h-5 w-5 text-brand-blue" />
                  16 or older
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-base leading-relaxed">
                <p>
                  Standard adult account. No parent step.
                </p>
                <p className="text-muted-foreground text-sm">
                  Same path as anyone else on Divine. The rest of this page
                  is mostly relevant if a 16+ account is flagged in
                  error—the mistake-flag path lives on the action page.
                </p>
              </CardContent>
            </Card>
          </div>
        </Anchor>

        {/* 2. Why we work this way */}
        <Anchor id="why">
          <SectionHero
            eyebrow="Honest framing"
            icon={<Info weight="fill" className="h-7 w-7" />}
            title="Why we work this way"
            lead="The age rules Divine follows weren't all our idea. Some of them are operational choices about what kind of app we want to be."
          />

          <Card variant="brand">
            <CardContent className="pt-6 space-y-3 text-base leading-relaxed">
              <p>
                The rules for online services for children under 13 require
                apps to verify parents through credit-card checks,
                government-ID uploads, and similar intrusive steps. Those
                rules were written with little grasp of how the open
                internet actually works. In practice they push every
                app toward collecting <em>more</em> personal data, not
                less, and they're realistically only operable by the
                biggest tech companies.
              </p>
              <p>
                Divine isn't going to build that machinery. We'd rather
                close an account cleanly than ask a parent to hand a credit
                card and a government ID to a video app to prove who they
                are.
              </p>
              <p>
                The 13-to-15 path is a different shape: a short private
                video with a parent or guardian on camera. It's a real
                human check, but it doesn't require Divine to operate an
                ID-and-payment verification pipeline, and it doesn't
                require the family to hand over more data than the video
                itself. Imperfect, but more honest than the alternative.
              </p>
            </CardContent>
          </Card>
        </Anchor>

        {/* 3. Under-13 accounts */}
        <Anchor id="under-13">
          <SectionHero
            eyebrow="The under-13 policy"
            icon={<UsersThree weight="fill" className="h-7 w-7" />}
            title="Under-13 accounts close and the data is deleted"
            lead="Divine isn't built for people under 13. When Divine learns an account is held by someone under 13, the team closes the account and promptly deletes everything tied to it from Divine's infrastructure—even when a parent or guardian is okay with the account staying open. The account doesn't come back."
          />

          {/* Parent-discovery action card */}
          <Card variant="brand" accent="green">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ChatsCircle weight="fill" className="h-5 w-5 text-brand-green" />
                If you've discovered an under-13 account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-base leading-relaxed">
              <p>
                This is for a parent or guardian who has found out a child
                in their care is using a Divine account. Email support and
                the team will close the account and remove the data.
              </p>
              <ol className="space-y-3 list-none pl-0">
                <li className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums"
                    aria-hidden="true"
                  >
                    1.
                  </span>
                  <span>
                    Email Divine support at{" "}
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80 break-all"
                    >
                      {SUPPORT_EMAIL}
                    </a>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums"
                    aria-hidden="true"
                  >
                    2.
                  </span>
                  <span>
                    Say you've discovered a Divine account belonging to a
                    child in your care who is under 13.
                  </span>
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
                    profile, if you have it handy.
                  </span>
                </li>
              </ol>

              <p className="text-muted-foreground">
                The team will review what you send, close the account,
                promptly delete everything tied to it from Divine's
                infrastructure, and reply confirming what was done. There's
                no form to fill out—the email is enough.
              </p>

              <div className="pt-2">
                <SupportEmailButton
                  href={mailtoLink(
                    "Account review—under 13",
                    "Hi Divine support,\n\nI'm a parent or guardian. I've discovered a Divine account belonging to a child in my care who is under 13.\n\nAccount username or link:\n\nAnything else that might help:\n\nThanks,",
                  )}
                  label={`Email ${SUPPORT_EMAIL}`}
                />
              </div>
            </CardContent>
          </Card>

          {/* Nostr-relay caveat */}
          <Card variant="brand" className="mt-6">
            <CardContent className="pt-6 space-y-3 text-base leading-relaxed">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-dark-green dark:text-brand-green">
                <Info weight="fill" className="h-4 w-4" />
                <span>A note about copies on other relays</span>
              </div>
              <p>
                Any videos already posted from the account may have been
                copied to other Nostr relays that Divine doesn't operate.
                When Divine deletes an account's content, it issues a
                deletion request across the network, but we can't
                guarantee every copy disappears. Deletion is only complete
                on Divine itself.
              </p>
            </CardContent>
          </Card>

          <p className="mt-6 text-sm text-muted-foreground leading-relaxed">
            When they're 13 or older, the same person can create a new
            account from scratch. The closed account itself doesn't
            return.
          </p>
        </Anchor>

        {/* 4. 13-15 accounts */}
        <Anchor id="13-15">
          <SectionHero
            eyebrow="The 13-to-15 policy"
            icon={<VideoCamera weight="fill" className="h-7 w-7" />}
            title="Teen-held accounts need a parent or guardian video"
            lead="Teens 13 to 15 can use Divine with a parent or guardian who's aware and involved. The video is how Divine knows that consent and supervision are real, without running an intrusive verification system."
          />

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
                <li>A clear statement that the teen is between 13 and 15.</li>
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
                is better. Keep it short. The video is handled by Divine's
                support and trust &amp; safety team and isn't published or
                shared with other users.
              </p>
            </CardContent>
          </Card>

          {/* Link out to the action page */}
          <a
            href="/age-review"
            className="mt-6 group block brand-card brand-offset-shadow-green p-6 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:8px_8px_0_0_hsl(var(--brand-green))] transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-extrabold tracking-tight text-xl text-brand-dark-green dark:text-brand-off-white">
                  If your account was just flagged
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The action page with the 15-day window, mailto buttons,
                  and what happens if no one responds lives at{" "}
                  <span className="font-medium text-brand-dark-green dark:text-brand-green">
                    divine.video/age-review
                  </span>
                  .
                </p>
              </div>
              <ArrowSquareOut className="h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green group-hover:translate-x-0.5 transition-transform" />
            </div>
          </a>
        </Anchor>

        {/* 5. Family-account carve-out */}
        <Anchor id="family-account">
          <SectionHero
            eyebrow="Families together"
            icon={<HouseLine weight="fill" className="h-7 w-7" />}
            title="Families absolutely belong on Divine"
            lead="None of the rules above are about pushing your family off Divine. Families enjoying social media together is a good thing, and welcome here. The piece that matters is who holds the account."
          />

          <Card variant="brand" accent="pink">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <HouseLine weight="fill" className="h-5 w-5 text-brand-pink" />
                A family-account setup looks like this
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-base leading-relaxed">
              <ul className="space-y-2 list-disc pl-5 marker:text-brand-pink">
                <li>
                  The account is created by, and held in the name of, the
                  parent or guardian.
                </li>
                <li>
                  The parent or guardian does the posting and the
                  moderating, every time.
                </li>
                <li>
                  Kids of any age can appear in videos with their parent or
                  guardian's involvement.
                </li>
              </ul>
              <p>
                What Divine won't host is a solo account in a child's
                hands. Under 13, the account has to be the parent or
                guardian's. From 13 to 15, the account can be the teen's
                with the video step above. Pick whichever path fits your
                family.
              </p>
              <p className="text-muted-foreground">
                Most family-channel use of Divine is just adults sharing
                videos that include their kids. That's exactly the case
                this carve-out is for, and the app side of it is the
                same as any other adult account.
              </p>
            </CardContent>
          </Card>
        </Anchor>

        {/* 6. More family guidance */}
        <Anchor id="family-guidance">
          <SectionHero
            eyebrow="The broader conversation"
            icon={<HouseLine weight="fill" className="h-7 w-7" />}
            title="Looking for the wider family resources?"
            lead="This page covers the account-policy side. The wider conversation—how to talk with your teen, content settings, healthy feed habits, trusted outside resources—lives separately."
          />

          <a
            href="/family"
            className="group block brand-card brand-offset-shadow-green p-6 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:8px_8px_0_0_hsl(var(--brand-green))] transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-extrabold tracking-tight text-xl text-brand-dark-green dark:text-brand-off-white">
                  Open family resources
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Conversation starters, content settings, healthy feed
                  habits, and trusted outside resources at{" "}
                  <span className="font-medium text-brand-dark-green dark:text-brand-green">
                    divine.video/family
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
            Questions, edge cases, or anything else you'd want a real
            person to read? Email{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80 break-all"
            >
              {SUPPORT_EMAIL}
            </a>
            . The support and trust &amp; safety team reads these.
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default KidsPolicyPage;

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
