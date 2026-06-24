// ABOUTME: External moderation-flow page at /age-review for accounts flagged as possibly under 16
// ABOUTME: Deadline-shaped: 15-day window, Divine Greenlight (13-15) parent video, 16+ mistake-flag; policy context lives at /kids

import {
  Info,
  VideoCamera,
  EnvelopeSimple,
  ShieldCheck,
  Path,
  HouseLine,
  Heart,
  ArrowSquareOut,
  LockKey,
} from "@phosphor-icons/react";

import { MarketingLayout } from "@/components/MarketingLayout";
import {
  Anchor,
  AnchorNav,
  BackToTopButton,
  SectionHero,
  staticPageLinkCardClass,
  SupportEmailButton,
  type SectionAnchor,
} from "@/components/static-pages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMailtoLink } from "@/lib/mailto";

const SUPPORT_EMAIL = "support@divine.video";
const REVIEW_WINDOW_DAYS = 15;

const SECTIONS: SectionAnchor[] = [
  { id: "path-13-15", title: "Divine Greenlight (13-15)" },
  { id: "path-mistake", title: "If you're 16 or older" },
  { id: "no-response", title: "If we don't hear from you" },
];

// Mirrors the Divine Greenlight (13-15) parent-consent email in divine-mobile
// (minorAccountReviewParentConsentEmailSubject / ...Body) so the in-app flow
// and this page open the same prefilled message. NOTE: divine-mobile must be
// updated to match this Divine Greenlight subject/body or the two will diverge.
const TEEN_REVIEW_EMAIL_SUBJECT = "Divine Greenlight review help (ages 13-15)";
const TEEN_REVIEW_EMAIL_BODY =
  "Hi Divine support,\n\nI am contacting Divine about Divine Greenlight for a teen who is 13-15.\n\nI have attached a short private video that shows:\n- the teen\n- a parent or guardian speaking on camera\n- that the teen has permission to use Divine\n- that the parent or guardian knows about the account and will supervise its use\n\nCountry/ies of residence:\n\nHelpful context:\n\nThanks.";
const TEEN_REVIEW_MAILTO = buildMailtoLink(
  SUPPORT_EMAIL,
  TEEN_REVIEW_EMAIL_SUBJECT,
  TEEN_REVIEW_EMAIL_BODY,
);

// 16-or-older "flagged by mistake" path. Shared so the inline link and the
// button below it open the same prefilled message.
const MISTAKE_REVIEW_EMAIL_SUBJECT =
  "I am 16 or older and think this account was flagged by mistake";
const MISTAKE_REVIEW_EMAIL_BODY =
  "Hi Divine support,\n\nI'm 16 or older and I think this account was flagged by mistake.\n\nAccount username or link:\n\nAny helpful context:\n\nThanks,";
const MISTAKE_REVIEW_MAILTO = buildMailtoLink(
  SUPPORT_EMAIL,
  MISTAKE_REVIEW_EMAIL_SUBJECT,
  MISTAKE_REVIEW_EMAIL_BODY,
);

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
          <h1 className="font-display font-extrabold tracking-tight text-4xl md:text-5xl leading-[1.05] text-brand-off-white mb-6">
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

          <AnchorNav sections={SECTIONS} />
        </div>
      </section>

      <div className="container mx-auto px-4 py-14 md:py-16 max-w-4xl space-y-14">
        {/* Note for under-13 readers—placed first so a kid
            reading the page lands on this before scrolling through the
            13-15 instructions and assuming a parent video might apply.
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
              We're sorry. Divine must close an under-13 account and delete the data it holds once it confirms or has actual knowledge that the account holder is under 13, and in all cases no later than the 15-day mark. Emailing
              won't pause the clock here—the rules around services for
              kids under 13 tie our hands. Where the rules allow, the same
              person can come back and create a new account when they're 13
              or older (with parental consent required between ages 13-15).
            </p>
          </CardContent>
        </Card>

        {/* 1. 13-15 path */}
        <Anchor id="path-13-15">
          <SectionHero
            eyebrow="If you're 13-15"
            icon={<VideoCamera weight="fill" className="h-7 w-7" />}
            title="Divine Greenlight: a guided start"
            lead={`Where local rules allow it, teens 13-15 can use Divine through Divine Greenlight, with a parent or guardian who's aware and involved. To keep the account open, a parent or guardian sends a short private video confirming the situation. The email needs to land within ${REVIEW_WINDOW_DAYS} days of the in-app notice.`}
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
                        href={TEEN_REVIEW_MAILTO}
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
                    <span>Attach the video, or include a private link to it that is not posted publicly and does not require the teen to share a password or account login with Divine.</span>
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
                      the family and Divine support. Please don't include government IDs, payment-card numbers, school records, medical information, passwords, Social Security numbers, or other sensitive documents. Divine only needs the short video and the account username for this review.
                    </span>
                  </li>
                </ol>

                <div className="pt-2">
                  <SupportEmailButton
                    href={TEEN_REVIEW_MAILTO}
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
                Divine's Support and Trust &amp; Safety teams. Divine uses the video only for account review, safety, legal, and compliance purposes, and keeps it only as long as reasonably necessary for those purposes unless a longer retention period is required or permitted by law. It isn't
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
                      href={MISTAKE_REVIEW_MAILTO}
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
                    think the team should know. Please don't include government IDs, payment-card numbers, school records, medical information, passwords, Social Security numbers, or other sensitive documents.
                  </span>
                </li>
              </ol>

              <p className="text-muted-foreground">
                Keep it short. The team will review and reply with next steps.
              </p>

              <div className="pt-2">
                <SupportEmailButton
                  href={MISTAKE_REVIEW_MAILTO}
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
            lead={`After ${REVIEW_WINDOW_DAYS} days with no email to Support, the account is closed and the personal information Divine holds about it is deleted. The closed account doesn't come back.`}
          />

          <Card variant="brand" accent="orange">
            <CardContent className="pt-6 space-y-3 text-base leading-relaxed">
              <ul className="space-y-2 list-disc pl-5 marker:text-brand-orange">
                <li>
                  Support closes the account and deletes everything tied to
                  it from Divine's infrastructure—profile, videos,
                  comments, follow lists, and any email or IP-derived data
                  on file, except information Divine is required or permitted to keep for legal, safety, security, fraud-prevention, dispute-resolution, or compliance purposes.
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
                For Divine Greenlight (13-15) accounts, an email to{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80 break-all"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                from a parent or guardian within the 15-day window stops the
                clock while Divine reviews the submission. For accounts flagged in error as belonging to someone under 16, an email from the account holder stating that they are 16 or older stops the clock while Divine reviews the submission. A "we're working on it" reply counts. An email does not pause closure of an account once Divine confirms or has actual knowledge that the account holder is under 13.
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
            className={staticPageLinkCardClass("green")}
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
            message. If your first email was sent within the 15-day window, include the date and address you sent it so Divine can confirm the timing.
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default AgeReviewPage;
