// ABOUTME: "Building healthier feed habits" section, moved verbatim from FamilyPage
// ABOUTME: Rendered as a secondary section on /family/media-plan

import { Path } from "@phosphor-icons/react";

import { Anchor, SectionHero } from "@/components/static-pages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FeedHabitsSection() {
  return (
    <Anchor id="habits">
      <SectionHero
        eyebrow="Building healthier feed habits"
        icon={<Path weight="fill" className="h-7 w-7" />}
        title="Feed habits and healthy stopping points"
        lead="Most short-form feeds are designed to keep going. The healthier skill isn't blocking the feed—it's noticing when you've had enough and choosing to stop. That's a skill adults are still learning too."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card variant="brand" accent="blue">
          <CardHeader>
            <CardTitle className="text-xl">Practice intentional stopping points</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-base leading-relaxed">
            <p>
              Pick a natural stop together—end of a video, end of a song,
              end of a meal. The point isn't a hard timer. It's noticing
              the moment to put the phone down and meaning it.
            </p>
            <p className="text-muted-foreground">
              Modeling matters. If adults in the house never stop scrolling,
              the lesson lands differently.
            </p>
          </CardContent>
        </Card>

        <Card variant="brand" accent="yellow">
          <CardHeader>
            <CardTitle className="text-xl">Build redirect routines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-base leading-relaxed">
            <p>
              After a long session, redirect attention on purpose: a walk,
              music, food, a stretch, a friend, anything offline. The
              redirect matters as much as the pause.
            </p>
            <p className="text-muted-foreground">
              This isn't about declaring social media bad. It's about
              making sure it's not the only thing on the menu.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card variant="brand" accent="dark" className="mt-6 bg-brand-dark-green/95 text-brand-off-white">
        <CardContent className="pt-6 text-base leading-relaxed">
          <p className="text-brand-light-green text-sm font-semibold mb-2">
            Talking points for the next car ride
          </p>
          <ul className="space-y-2 list-disc pl-5 marker:text-brand-green">
            <li>What does "enough scrolling for now" feel like in your body?</li>
            <li>What's the first thing you'd rather do when you put the phone down?</li>
            <li>Is there a creator or topic that always leaves you feeling worse? What would it take to mute it?</li>
          </ul>
        </CardContent>
      </Card>
    </Anchor>
  );
}
