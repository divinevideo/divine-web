// ABOUTME: Public guide explaining account portability on Divine in non-technical language
// ABOUTME: Gives users a stable URL for moving accounts without exposing protocol internals

import {
  ArrowSquareOut,
  CheckCircle,
  Compass,
  DownloadSimple,
  Export,
  Key,
  Prohibit,
  ShieldCheck,
} from "@phosphor-icons/react";
import { useHead } from "@unhead/react";
import { Link } from "react-router-dom";

import { SectionHeader } from "@/components/brand/SectionHeader";
import { KeySafetyNotice } from "@/components/exit/KeySafetyNotice";
import { MarketingLayout } from "@/components/MarketingLayout";
import {
  Anchor,
  AnchorNav,
  BackToTopButton,
  SectionHero,
  staticPageLinkCardClass,
  type SectionAnchor,
} from "@/components/static-pages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS: SectionAnchor[] = [
  { id: "what-moving-means", title: "What moving means" },
  { id: "what-comes-with-you", title: "What comes with you" },
  { id: "what-does-not-happen", title: "What does not happen" },
  { id: "how-it-works", title: "How it works" },
  { id: "if-suspended", title: "If your account was suspended" },
  { id: "download", title: "Download your copy" },
];

const MOVE_STEPS = [
  {
    title: "Get your keys",
    body:
      "Your Divine account is tied to keys that prove the account is yours. The migration flow helps you see where they live and save them when your account type allows key export.",
  },
  {
    title: "Choose where things go",
    body:
      "You choose a place for videos and a place for posts. Those services can be Divine services, services run by someone else, or a mix of both.",
  },
  {
    title: "Copy your videos",
    body:
      "When destination copying is ready, your media can be copied byte for byte. Divine will not resize, re-encode, or change the files.",
  },
  {
    title: "Publish and point",
    body:
      "When destination publishing is ready, your posts can be republished there, and your public account records can tell other apps where to look next.",
  },
];

export function PortabilityPage() {
  useHead({
    title: "Account Portability on Divine",
    link: [{ rel: "canonical", href: "https://divine.video/exit" }],
    meta: [
      {
        name: "description",
        content:
          "A plain-language guide to moving your Divine account and content to infrastructure you choose.",
      },
    ],
  });

  return (
    <MarketingLayout>
      <BackToTopButton />

      <section className="bg-brand-dark-green text-brand-off-white">
        <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-green mb-6">
            <Export weight="fill" className="h-4 w-4" />
            <span>Account portability</span>
          </div>
          <h1 className="font-display font-extrabold tracking-tight text-4xl md:text-6xl leading-[1.05] text-brand-off-white mb-6">
            Move your Divine account
          </h1>
          <p className="text-lg md:text-xl text-brand-light-green max-w-3xl leading-relaxed">
            Divine accounts are built so you can take your identity and content
            to infrastructure you choose. Moving creates copies of your account
            and videos in the places you choose. Compatible apps can use those
            copies when they find them. It does not delete anything from Divine.
          </p>
          <p className="text-base md:text-lg text-brand-off-white/80 max-w-3xl leading-relaxed mt-4">
            This guide explains the moving flow without assuming you know how
            relays, media servers, or Nostr work.
          </p>
          <p className="text-base md:text-lg text-brand-off-white/80 max-w-3xl leading-relaxed mt-3">
            Moving is not all-or-nothing. You can keep using Divine servers and
            also use other relays or media servers, including Blossom servers,
            at the same time.
          </p>
          <p className="text-base md:text-lg text-brand-off-white/80 max-w-3xl leading-relaxed mt-3">
            If you&apos;re looking for information about deleting your Divine
            account, you can find it{" "}
            <Link
              to="/delete-account"
              className="font-semibold text-brand-green underline decoration-brand-green/60 underline-offset-4 hover:text-brand-light-green"
            >
              here
            </Link>
            .
          </p>

          <AnchorNav
            sections={SECTIONS}
            className="sm:grid-cols-2 lg:grid-cols-3"
          />
        </div>
      </section>

      <div className="container mx-auto px-4 py-14 md:py-16 max-w-4xl space-y-16">
        <Anchor id="what-moving-means">
          <SectionHero
            eyebrow="What moving means"
            icon={<Key weight="fill" className="h-7 w-7" />}
            title="Your account is yours"
            lead="Your Divine identity is not a username that Divine can keep from you. It is an account key that proves you are you across apps that understand the same protocol."
          />

          <Card variant="brand" accent="green">
            <CardContent className="pt-6 space-y-3 text-base leading-relaxed text-muted-foreground">
              <p>
                When you move, you are choosing new places for your posts and
                videos to live. Other compatible apps can read those places and
                show your account there.
              </p>
              <p>
                You do not have to choose between Divine and the rest of the
                network. A mixed setup is fine: some posts can stay on
                Divine-operated relays, videos can stay on Divine-operated
                media servers, and you can also add relays or Blossom servers
                run by other people.
              </p>
              <p>
                You can move because Divine is built on open account and media
                records, not because Divine grants special permission for each
                move.
              </p>
            </CardContent>
          </Card>
        </Anchor>

        <Anchor id="what-comes-with-you">
          <SectionHero
            eyebrow="What comes with you"
            icon={<CheckCircle weight="fill" className="h-7 w-7" />}
            title="The flow is built around your account and content"
            lead="The portability flow is intended to help you carry the parts of your Divine presence that other compatible services can use."
          />

          <div className="grid gap-5 md:grid-cols-2">
            {[
              "Your account keys, when your account type allows key export.",
              "Your profile information and account records.",
              "Your posts and video records.",
              "Your media files, copied without changing the bytes.",
              "Your follow and server lists where the moving flow can publish them.",
              "A downloadable archive for your own records.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle weight="fill" className="mt-1 h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green" />
                <p className="text-base leading-relaxed text-muted-foreground">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </Anchor>

        <Anchor id="what-does-not-happen">
          <SectionHero
            eyebrow="What does not happen"
            icon={<Prohibit weight="fill" className="h-7 w-7" />}
            title="Moving is not deletion"
            lead="Moving your account does not remove Divine-hosted content, close your Divine account, or erase records that already exist elsewhere."
          />

          <Card variant="brand" accent="violet">
            <CardHeader>
              <CardTitle>Deletion is separate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-base leading-relaxed text-muted-foreground">
              <p>
                If you want to delete content from Divine-operated services,
                use the deletion tools for that purpose. Moving and deleting are
                different actions. See{" "}
                <a
                  href="/delete-account"
                  className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80"
                >
                  how account deletion works
                </a>
                .
              </p>
              <p>
                Content that has already been copied by independent services may
                remain available outside Divine. Divine does not control those
                services. Those copies can still point at Divine-hosted media, so
                apps that use them may keep loading your videos from Divine.
              </p>
            </CardContent>
          </Card>
        </Anchor>

        <Anchor id="how-it-works">
          <SectionHero
            eyebrow="How it works"
            icon={<Compass weight="fill" className="h-7 w-7" />}
            title="Four plain steps"
            lead="The moving flow keeps the protocol details in the background. Today you can download your archive; choosing a destination and copying your media there is still being built."
          />

          <div className="grid gap-5 md:grid-cols-2">
            {MOVE_STEPS.map((step, index) => (
              <Card key={step.title} variant="brand" accent={index % 2 === 0 ? "green" : "blue"}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <span className="font-display text-2xl text-brand-dark-green dark:text-brand-green">
                      {index + 1}
                    </span>
                    {step.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8">
            <Link to="/exit/start" className={staticPageLinkCardClass("orange")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-extrabold tracking-tight text-xl text-brand-dark-green dark:text-brand-off-white">
                    Download your archive now
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Sign in and take a copy of your posts, video records, and media
                    list today. Choosing a destination and copying your media there
                    is still being built.
                  </p>
                </div>
                <ArrowSquareOut className="h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          </div>

          <div className="mt-5">
            <KeySafetyNotice />
          </div>
        </Anchor>

        <Anchor id="if-suspended">
          <SectionHero
            eyebrow="If your account was suspended"
            icon={<ShieldCheck weight="fill" className="h-7 w-7" />}
            title="A suspension applies to Divine's servers"
            lead="If Divine suspends posting access on Divine-operated services, that does not remove your already-signed records. Whether you can sign new events elsewhere depends on where your account key lives."
          />

          <Card variant="brand" accent="pink">
            <CardContent className="pt-6 space-y-3 text-base leading-relaxed text-muted-foreground">
              <p>
                Other servers have their own rules. They may accept content
                Divine does not host, or they may decline the same content under
                their own policies.
              </p>
              <p>
                If Divine&apos;s signer holds your key, a suspension currently also
                prevents it from signing an archive request. Appeal first if you need
                to export from that kind of account. An account whose key is stored in
                your own browser can still use that key with other services.
              </p>
              <p>
                If you believe Divine made a mistake, appeal information is in
                the{" "}
                <a
                  href="/safety#appeals"
                  className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80"
                >
                  Safety Standards
                </a>
                . Moving your account does not change the appeals process.
              </p>
            </CardContent>
          </Card>
        </Anchor>

        <Anchor id="download">
          <SectionHero
            eyebrow="Download your copy"
            icon={<DownloadSimple weight="fill" className="h-7 w-7" />}
            title="You can keep an archive"
            lead="The moving flow is designed to offer a downloadable archive whether or not every server-to-server copy succeeds."
          />

          <Card variant="brand" accent="yellow">
            <CardContent className="pt-6 space-y-3 text-base leading-relaxed text-muted-foreground">
              <p>
                A partial move is safe to run again. Media files are identified
                by their contents, so copying the same file again points to the
                same file.
              </p>
              <p>
                The archive is for you. It is not an appeal, not a deletion
                request, and not a promise that every other service will host
                the same material.
              </p>
            </CardContent>
          </Card>
        </Anchor>

        <div className="pt-8 border-t border-brand-dark-green/10 dark:border-brand-green/20">
          <SectionHeader as="h2" className="text-2xl md:text-3xl mb-4">
            Related Divine docs
          </SectionHeader>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { href: "/safety", title: "Safety Standards" },
              { href: "/privacy", title: "Privacy Policy" },
              { href: "/kids", title: "Kids Policy" },
            ].map((link) => (
              <a key={link.href} href={link.href} className={staticPageLinkCardClass("green")}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display font-extrabold tracking-tight text-lg text-brand-dark-green dark:text-brand-off-white">
                    {link.title}
                  </span>
                  <ArrowSquareOut className="h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green group-hover:translate-x-0.5 transition-transform" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default PortabilityPage;
