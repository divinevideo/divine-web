// ABOUTME: Policy page at /kids explaining how Divine handles accounts for under-16s
// ABOUTME: Long-form FAQ-style page—paired with the deadline-shaped action page at /age-review

import {
  Info,
  UsersThree,
  VideoCamera,
  ShieldCheck,
  ChatsCircle,
  HouseLine,
  ArrowSquareOut,
} from "@phosphor-icons/react";

import { MarketingLayout } from "@/components/MarketingLayout";
import {
  Anchor,
  BackToTopButton,
  SectionHero,
  staticPageLinkCardClass,
  SupportEmailButton,
} from "@/components/static-pages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMailtoLink } from "@/lib/mailto";

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

// Parent-discovery email for an under-13 account. Shared so the inline link
// and the button below it open the same prefilled message.
const UNDER13_DISCOVERY_MAILTO = buildMailtoLink(
  SUPPORT_EMAIL,
  "Account review—under 13",
  "Hi Divine support,\n\nI'm a parent or guardian. I've discovered a Divine account belonging to a child in my care who is under 13.\n\nAccount username or link:\n\nAnything else that might help:\n\nThanks,",
);

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
          <h1 className="font-display font-extrabold tracking-tight text-4xl md:text-6xl leading-[1.05] text-brand-off-white mb-6">
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
            lead="Divine handles accounts differently depending on who's holding them and where they live. The short version:"
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
                  Where local rules allow it, Divine offers a parent-supported path for teens 13 to 15.
                </p>
                <p className="text-muted-foreground text-sm">
                  This path requires a short private video from the teen and a parent or guardian confirming the teen’s age, permission to use Divine, and parent or guardian awareness and supervision. In some places, including countries with under-16 social media restrictions or stricter age-assurance rules, this path may not be available or may require additional steps.
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
                  Standard 16+ account. No teen-specific parent step, unless required by applicable law, Divine's policies, or the user's location.
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
            eyebrow="Why we work this way"
            icon={<Info weight="fill" className="h-7 w-7" />}
            title="Our operating philosophy"
            lead="The age rules Divine follows weren't all our idea. Some of them are operational choices about what kind of app we want to be."
          />

          <Card variant="brand">
            <CardContent className="pt-6 space-y-3 text-base leading-relaxed">
              <p>
                The rules for online services for children under 13 can require online services to give parents direct notice and obtain verifiable parental consent before collecting, using, or disclosing personal information from children under 13; available consent methods can include credit-card checks, government-ID checks, and other methods permitted by law. Those
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
                Where the rules allow, Divine offers a different path for teens 13 to 15: a short private
                video with a parent or guardian on camera. It's a real
                human check, but it doesn't require Divine to operate an
                ID-and-payment verification pipeline, and it doesn't
                require the family to hand over more data than the video
                itself. It’s not perfect, but it is more aligned with the kind of internet we want to build.
              </p>
            </CardContent>
          </Card>
        </Anchor>

        {/* 3. Under-13 accounts */}
        <Anchor id="under-13">
          <SectionHero
            eyebrow="Under-13 accounts"
            icon={<UsersThree weight="fill" className="h-7 w-7" />}
            title="Under-13 accounts close and the data is deleted"
            lead="Divine isn't built for people under 13. When Divine learns an account is held by someone under 13, the team closes the account and promptly deletes everything tied to it from Divine's infrastructure, except information Divine is required or permitted to keep for legal, safety, security, fraud-prevention, dispute-resolution, or compliance purposes—even when a parent or guardian is okay with the account staying open. The account doesn't come back."
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
                      href={UNDER13_DISCOVERY_MAILTO}
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
                  href={UNDER13_DISCOVERY_MAILTO}
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
            When they're 13 or older, and local law permits, the same
            person can create a new account from scratch. The closed account
            itself doesn't return.
          </p>
        </Anchor>

        {/* 4. 13-15 accounts */}
        <Anchor id="13-15">
          <SectionHero
            eyebrow="13-15 accounts"
            icon={<VideoCamera weight="fill" className="h-7 w-7" />}
            title="Teen-held accounts need a parent or guardian video"
            lead="Where permitted by law, teens 13 to 15 can use Divine with a parent or guardian who's aware and involved. The video is how Divine knows that consent and supervision are real, without running an intrusive verification system. Depending on where the teen lives, Divine may require additional or different age-assurance, parental-consent, privacy, or account-safety steps before the account can stay open."
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
                Phone-camera quality is fine. There's no script—natural is better. Keep it short. Please don't include more information than Divine asks for here; the review is meant to confirm age, permission, and parent or guardian awareness, not to collect extra documents or background details. The video is handled by Divine's Support and Trust & Safety teams, used only for account review, safety, legal, and compliance purposes, kept only as long as reasonably necessary for those purposes unless a longer retention period is required or permitted by law, and isn't published or shared with other users.
              </p>
            </CardContent>
          </Card>

          {/* Link out to the action page */}
          <a
            href="/age-review"
            className={staticPageLinkCardClass("green", "mt-6")}
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
                  . If Divine needs more information to finish the review, support will ask for it through the support email thread rather than asking the teen to post anything publicly.
                </p>
              </div>
              <ArrowSquareOut className="h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green group-hover:translate-x-0.5 transition-transform" />
            </div>
          </a>
        </Anchor>

        {/* 5. Family-account carve-out */}
        <Anchor id="family-account">
          <SectionHero
            eyebrow="Families on Divine"
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
                  guardian's involvement, as long as the parent or guardian has the rights and permissions needed to share the video and the video complies with Divine's policies and applicable law. The parent or guardian should not share the account password or hand off control of the account to a child under 13.
                </li>
              </ul>
              <p>
                What Divine won't host is a solo account in a child's
                hands. Under 13, the account has to be the parent or
                guardian's. From 13 to 15, the account can be the teen's
                with the video step above, subject to any additional requirements that apply based on the teen's location. Pick whichever path fits your
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
            eyebrow="More family guidance"
            icon={<HouseLine weight="fill" className="h-7 w-7" />}
            title="Looking for the wider family resources?"
            lead="This page covers the account-policy side. The wider conversation—how to talk with your teen, content settings, healthy feed habits, trusted outside resources—lives separately."
          />

          <a
            href="/family"
            className={staticPageLinkCardClass("green")}
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
            . The Support and Trust &amp; Safety teams read these.
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default KidsPolicyPage;
