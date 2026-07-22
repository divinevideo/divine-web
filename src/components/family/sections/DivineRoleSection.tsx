// ABOUTME: "What Divine can and can't do" section, moved verbatim from FamilyPage
// ABOUTME: Shown on the hub and on /family/safety-tools; the honesty here is the point—do not soften

import { Eye, ShieldCheck } from "@phosphor-icons/react";

import { Anchor, SectionHero } from "@/components/static-pages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DivineRoleSection() {
  return (
    <Anchor id="limits">
      <SectionHero
        eyebrow="Divine’s role"
        icon={<ShieldCheck weight="fill" className="h-7 w-7" />}
        title="What Divine can and can't do"
        lead="We'd rather be useful than impressive. Here's the real picture of what the app side can help with—and where conversation, supervision, and human judgment still have to do the work."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card variant="brand" accent="green">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck weight="fill" className="h-5 w-5 text-brand-green" />
              What Divine offers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-base leading-relaxed">
            <ul className="space-y-2 list-disc pl-5 marker:text-brand-green">
              <li>
                Moderation tools that remove clearly prohibited content
                from Divine-controlled surfaces.
              </li>
              <li>
                Reporting tools inside the app so anyone can flag content
                or accounts for review.
              </li>
              <li>
                Content settings that gate adult and sensitive content for
                accounts that haven't opted in.
              </li>
              <li>
                Blocking, muting, and filtering controls so users can shape
                their own experience.
              </li>
              <li>
                A support path for families and a published{" "}
                <a
                  href="/safety"
                  className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80"
                >
                  safety standards
                </a>{" "}
                page that documents what we will and won't do.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card variant="brand" accent="orange">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Eye weight="fill" className="h-5 w-5 text-brand-orange" />
              What Divine can't promise
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-base leading-relaxed">
            <ul className="space-y-2 list-disc pl-5 marker:text-brand-orange">
              <li>
                No app—including Divine—can guarantee a teen will
                never see adult, upsetting, or harmful content.
              </li>
              <li>
                Automated systems and human review both miss things. We
                don't claim to catch every violation.
              </li>
              <li>
                Bad language and conflict happen in human communities. We
                don't promise a filter that removes all of it.
              </li>
              <li>
                Divine is built on an open protocol (Nostr). Content
                removed from Divine-controlled surfaces can still exist
                elsewhere on the network.
              </li>
              <li>
                Settings and tools work best as part of a household
                conversation—not as a substitute for one.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-base text-muted-foreground leading-relaxed">
        For the full policy view, see our{" "}
        <a
          href="/safety"
          className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80"
        >
          Safety Standards
        </a>
        .
      </p>
    </Anchor>
  );
}
