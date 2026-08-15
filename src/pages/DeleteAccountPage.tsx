// ABOUTME: Public guide for deleting a Divine account from Divine-controlled services
// ABOUTME: Explains mobile and web request paths plus the open-network deletion limits

import {
  ArrowSquareOut,
  DeviceMobile,
  Globe,
  Info,
  Prohibit,
  Trash,
} from "@phosphor-icons/react";
import { useHead } from "@unhead/react";

import { SectionHeader } from "@/components/brand/SectionHeader";
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

const SUPPORT_REQUEST_URL =
  "https://help.divine.video/hc/en-gb/requests/new?ticket_form_id=14332938774671";

const SECTIONS: SectionAnchor[] = [
  { id: "before-you-delete", title: "Before you delete" },
  { id: "mobile", title: "Mobile app" },
  { id: "web", title: "Web app" },
  { id: "what-divine-can-delete", title: "What Divine can delete" },
  { id: "what-may-remain", title: "What may remain" },
];

export function DeleteAccountPage() {
  useHead({
    title: "Delete Your Divine Account",
    link: [{ rel: "canonical", href: "https://divine.video/delete-account" }],
    meta: [
      {
        name: "description",
        content:
          "How to request deletion of your Divine account and what deletion can and cannot remove on an open network.",
      },
    ],
  });

  return (
    <MarketingLayout>
      <BackToTopButton />

      <section className="bg-brand-dark-green text-brand-off-white">
        <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-green mb-6">
            <Trash weight="fill" className="h-4 w-4" />
            <span>Delete account</span>
          </div>
          <h1 className="font-display font-extrabold tracking-tight text-4xl md:text-6xl leading-[1.05] text-brand-off-white mb-6">
            Delete your Divine account
          </h1>
          <p className="text-lg md:text-xl text-brand-light-green max-w-3xl leading-relaxed">
            Deleting your Divine account asks Divine to remove your account and
            content from servers Divine controls. Divine is part of an open
            network, so copies may still exist on servers, apps, archives,
            caches, or search indexes that Divine does not control.
          </p>

          <AnchorNav
            sections={SECTIONS}
            className="sm:grid-cols-2 lg:grid-cols-3"
          />
        </div>
      </section>

      <div className="container mx-auto px-4 py-14 md:py-16 max-w-4xl space-y-16">
        <Anchor id="before-you-delete">
          <SectionHero
            eyebrow="Before you delete"
            icon={<Info weight="fill" className="h-7 w-7" />}
            title="Deletion is different from moving"
            lead="Moving your account helps you keep using your identity somewhere else. Deleting asks Divine to remove what it can from Divine-operated services."
          />

          <Card variant="brand" accent="yellow">
            <CardContent className="pt-6 space-y-3 text-base leading-relaxed text-muted-foreground">
              <p>
                If you want to keep your account and content, use the account
                portability flow instead. If you want Divine to remove your
                account and content from Divine-controlled infrastructure, use
                the deletion path below.
              </p>
              <p>
                Deletion is not instant everywhere. Some steps depend on
                servers accepting and processing deletion requests.
              </p>
            </CardContent>
          </Card>
        </Anchor>

        <Anchor id="mobile">
          <SectionHero
            eyebrow="Mobile app"
            icon={<DeviceMobile weight="fill" className="h-7 w-7" />}
            title="Delete from the Divine mobile app"
            lead="The mobile app has an in-app deletion flow for signed-in users."
          />

          <Card variant="brand" accent="green">
            <CardHeader>
              <CardTitle>Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-base leading-relaxed text-muted-foreground">
              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums">
                    1.
                  </span>
                  <span>Open the Divine mobile app and sign in.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums">
                    2.
                  </span>
                  <span>Open Settings.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums">
                    3.
                  </span>
                  <span>Open Nostr settings, then tap Delete Account and Data.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums">
                    4.
                  </span>
                  <span>
                    Read the warning, type the requested confirmation, and tap
                    the delete button only if you are sure.
                  </span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </Anchor>

        <Anchor id="web">
          <SectionHero
            eyebrow="Web app"
            icon={<Globe weight="fill" className="h-7 w-7" />}
            title="Request deletion from the web app"
            lead="Divine Web does not currently have the same one-tap account deletion flow as mobile. Use Support from the web app to request deletion."
          />

          <Card variant="brand" accent="blue">
            <CardHeader>
              <CardTitle>Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-base leading-relaxed text-muted-foreground">
              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums">
                    1.
                  </span>
                  <span>Open Divine Web and sign in to the account you want deleted.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums">
                    2.
                  </span>
                  <span>Go to Support and create a request.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums">
                    3.
                  </span>
                  <span>
                    Say that you want to delete your Divine account. Include
                    your profile link, username, or npub if you have it.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 font-extrabold text-brand-dark-green dark:text-brand-green w-6 leading-7 tabular-nums">
                    4.
                  </span>
                  <span>
                    Watch for a reply from Support. The team may need to confirm
                    account ownership before deleting anything.
                  </span>
                </li>
              </ol>

              <a href={SUPPORT_REQUEST_URL} className={staticPageLinkCardClass("green")}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display font-extrabold tracking-tight text-lg text-brand-dark-green dark:text-brand-off-white">
                    Open a Support request
                  </span>
                  <ArrowSquareOut className="h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green group-hover:translate-x-0.5 transition-transform" />
                </div>
              </a>
            </CardContent>
          </Card>
        </Anchor>

        <Anchor id="what-divine-can-delete">
          <SectionHero
            eyebrow="What Divine can delete"
            icon={<Trash weight="fill" className="h-7 w-7" />}
            title="Divine can delete from Divine-controlled services"
            lead="Divine can act on servers and systems Divine operates. That includes Divine-controlled account services, relay data, media storage, caches, and search or display systems."
          />

          <Card variant="brand" accent="violet">
            <CardContent className="pt-6 space-y-3 text-base leading-relaxed text-muted-foreground">
              <p>
                When Divine processes account deletion, Divine removes or
                disables what it controls and sends deletion requests where the
                protocol supports them.
              </p>
              <p>
                Divine may keep limited records when required for legal, safety,
                security, fraud-prevention, dispute-resolution, or compliance
                reasons.
              </p>
            </CardContent>
          </Card>
        </Anchor>

        <Anchor id="what-may-remain">
          <SectionHero
            eyebrow="What may remain"
            icon={<Prohibit weight="fill" className="h-7 w-7" />}
            title="Open networks can have copies"
            lead="Divine cannot delete data from servers, apps, archives, screenshots, downloads, caches, search indexes, or backups run by other people."
          />

          <Card variant="brand" accent="pink">
            <CardContent className="pt-6 space-y-3 text-base leading-relaxed text-muted-foreground">
              <p>
                Divine is built on Nostr, an open network. Other relays and
                clients may have received your posts or profile data before you
                asked Divine to delete them.
              </p>
              <p>
                Many servers honor deletion requests. Some may not receive the
                request, may process it later, or may choose to keep copies
                under their own rules.
              </p>
              <p>
                This is the tradeoff of an open network: your account is not
                locked inside Divine, but Divine also cannot control every copy
                outside Divine.
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
              { href: "/exit", title: "Move Your Account" },
              { href: "/privacy", title: "Privacy Policy" },
              { href: "/support", title: "Support" },
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
          <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
            Questions? Email{" "}
            <a
              href="mailto:support@divine.video"
              className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80"
            >
              support@divine.video
            </a>
            .
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default DeleteAccountPage;
