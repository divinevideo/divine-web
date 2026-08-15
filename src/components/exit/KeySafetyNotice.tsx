// ABOUTME: Standing anti-phishing notice shown on the account portability pages
// ABOUTME: One source of truth so the guide and the export tool state it identically

import { ShieldWarning } from "@phosphor-icons/react";

import { Card, CardContent } from "@/components/ui/card";

export function KeySafetyNotice() {
  return (
    <Card variant="brand" accent="violet">
      <CardContent className="pt-6 flex items-start gap-3">
        <ShieldWarning
          weight="fill"
          className="mt-1 h-6 w-6 flex-shrink-0 text-brand-dark-green dark:text-brand-green"
        />
        <div className="space-y-3">
          <h3 className="font-display font-extrabold tracking-tight text-xl text-brand-dark-green dark:text-brand-off-white">
            Never share your secret key
          </h3>
          <p className="text-base leading-relaxed text-muted-foreground">
            No Divine message, email, or support agent will ever ask for your secret key
            (nsec). Only enter it when you deliberately choose the secret-key option on
            Divine&apos;s sign-in screen, and check that you are on divine.video first.
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            You never need a link to reach this page. If you get a message saying your
            account was actioned, you do not have to trust it to act on it &mdash; open
            divine.video yourself, then use the account menu to reach this guide.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default KeySafetyNotice;
