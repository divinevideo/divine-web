// ABOUTME: "Talking with your teen" section content, moved verbatim from FamilyPage
// ABOUTME: Two guidance cards plus the conversation-starters card

import { ChatsCircle, HandHeart, Pause } from "@phosphor-icons/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const CONVERSATION_STARTERS = [
  "What's the funniest thing you've seen on your feed this week?",
  "Who are the three creators you actually look forward to?",
  "Has anything online ever made you feel weird or stuck with you afterwards?",
  "If you saw a friend getting piled on in comments, what would you do?",
  "What's something you wish your feed had less of?",
  'If we built a "phones-away" hour together, when would it make most sense?',
];

export function TalkingContent() {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <Card variant="brand" accent="green">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <HandHeart weight="fill" className="h-5 w-5 text-brand-green" />
              Co-navigate, don't surveil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-base leading-relaxed">
            <p>
              Sit next to them on the app sometimes. Ask who they follow.
              Ask what's funny right now. You'll learn more in five minutes
              of scrolling together than in a month of monitoring software.
            </p>
            <p className="text-muted-foreground">
              Surveillance shifts the dynamic. Curiosity keeps it open.
            </p>
          </CardContent>
        </Card>

        <Card variant="brand" accent="violet">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Pause weight="fill" className="h-5 w-5 text-brand-violet" />
              Respond, don't punish first
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-base leading-relaxed">
            <p>
              If you find something concerning, lead with a question. "Tell
              me what was happening when you saw this" gets you more than
              "you're grounded."
            </p>
            <p className="text-muted-foreground">
              Big consequences for the first disclosure usually buy you
              silence on the second one.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card variant="brand" accent="pink">
          <CardHeader>
            <CardTitle className="text-xl">Conversation starters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-base leading-relaxed">
            <ul className="space-y-2 list-disc pl-5 marker:text-brand-pink">
              {CONVERSATION_STARTERS.map((starter) => (
                <li key={starter}>{starter}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground pt-2">
              Use these as warm-up questions, not interrogations. One good
              question per car ride is plenty.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export const TALKING_ICON = ChatsCircle;
