// ABOUTME: "When something goes wrong" four-step content, moved verbatim from FamilyPage
// ABOUTME: HARD CONSTRAINT: the CSAM escalation guidance wording must never be altered

import { ChatsCircle, Flag, Heart, Pause } from "@phosphor-icons/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const UPSET_LEAD =
  "Most kids will see something they wish they hadn't at some point—on any app. What helps most isn't a perfect filter. It's a parent who reacts in a way that makes the next conversation possible.";

export function UpsetContent() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card variant="brand" accent="green">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Pause weight="fill" className="h-5 w-5 text-brand-green" />
            1. Pause first
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-base leading-relaxed">
          <p>
            Take a breath before reacting. Your first response sets
            whether your teen tells you the next time something happens.
          </p>
        </CardContent>
      </Card>

      <Card variant="brand" accent="pink">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ChatsCircle weight="fill" className="h-5 w-5 text-brand-pink" />
            2. Talk before punishing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-base leading-relaxed">
          <p>
            Ask what they saw, how they came across it, and how it felt.
            Try to listen for longer than you talk. Punishment can come
            later if it's actually warranted—disclosure has to come
            first.
          </p>
        </CardContent>
      </Card>

      <Card variant="brand" accent="violet">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Flag weight="fill" className="h-5 w-5 text-brand-violet" />
            3. Use the in-app tools
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-base leading-relaxed">
          <p>
            Report the content or account in the app. Mute or block the
            source. Walk through the steps together so your teen knows
            how to do it next time without you. For serious reports, write down the username, approximate time, and what happened, but don't repost, forward, or save harmful content just to document it.
          </p>
        </CardContent>
      </Card>

      <Card variant="brand" accent="orange">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Heart weight="fill" className="h-5 w-5 text-brand-orange" />
            4. Know when to escalate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-base leading-relaxed">
          <p>
            If something looks illegal, involves a minor, or feels like
            it's escalating offline, contact Divine support and, when
            appropriate, local authorities. Do <b>not</b> download, save, repost, forward, or share suspected child sexual abuse material (CSAM). Use the in-app report flow or Divine support so Divine can review and, where required, report apparent child sexual exploitation to the appropriate reporting channel or authority. Trust your gut on this one.
          </p>
          <p className="text-sm text-muted-foreground">
            For serious or time-sensitive reports, use the report flow
            in the app and reach out via{" "}
            <a
              href="/support"
              className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80"
            >
              Divine support
            </a>
            , and call local emergency services if someone is in immediate danger.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
