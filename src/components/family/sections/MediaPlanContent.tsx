// ABOUTME: "Creating a family media plan" section content, moved verbatim from FamilyPage
// ABOUTME: Four plan columns plus the pointer to the outside-resources templates

import { PlanColumn } from "./shared";

export const MEDIA_PLAN_LEAD =
  "A plan that everyone helped write is a plan that everyone is more likely to follow. Plans are also living documents—expect to revisit them every few months as kids get older and apps change.";

export function MediaPlanContent() {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <PlanColumn
          title="Where and when use makes sense"
          items={[
            "Phones at the dinner table—yes or no, decided together.",
            "Bedrooms overnight—where do devices charge?",
            "Homework time—what counts as a focus block?",
            "Long car rides, family events, hangouts—any shared norms?",
            "Public posts—what details stay out of videos, like school names, home addresses, daily routines, location clues, or other information that could identify where a child lives, studies, or spends time?",
          ]}
        />
        <PlanColumn
          title="What we do when things get hard"
          items={[
            "If something upsetting comes up, we talk before we punish.",
            "We use the report and mute tools instead of arguing in comments. We don't pile on, quote-post to shame someone, or send other people after an account.",
            "If a creator or trend stops feeling good, we mute or move on.",
            "Adults follow the same rules they ask teens to follow.",
          ]}
        />
        <PlanColumn
          title="Regular check-ins"
          items={[
            "A short, monthly check-in beats a once-a-year blow-up.",
            "Ask: what's working, what's not, what should we change?",
            "Adjust the plan in writing so it's clear what changed.",
          ]}
        />
        <PlanColumn
          title="Boundaries that are collaborative, not punitive"
          items={[
            "Boundaries are about the household, not just the teen.",
            "Explain the why, not just the rule.",
            "When trust grows, the plan gets more room. That's the deal.",
          ]}
        />
      </div>

      <p className="mt-6 text-base text-muted-foreground leading-relaxed">
        Looking for a template? A few household-plan starting points—from
        the AAP, Australia's eSafety Commissioner, and the WHO—are in the{" "}
        <a
          href="#resources"
          className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80"
        >
          outside resources
        </a>{" "}
        at the bottom of this page.
      </p>
    </>
  );
}
