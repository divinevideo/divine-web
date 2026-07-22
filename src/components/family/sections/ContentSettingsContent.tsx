// ABOUTME: "Understanding content settings" section content, moved verbatim from FamilyPage
// ABOUTME: Settings rows plus the note that settings are one layer, not a guarantee

import { Card, CardContent } from "@/components/ui/card";

import { SettingsRow } from "./shared";

export const SETTINGS_LEAD =
  "Settings are a useful layer. They are not a guarantee. The most important step is for the adult in the household to actually open them, read them, and adjust them together with the teen who'll use the account. For accounts used by teens, start with the most protective settings that still let the account work for your family, then loosen settings only after you have (a) talked through why the change makes sense, and (b) made the decision, as parents, to make that change.";

export function ContentSettingsContent() {
  return (
    <Card variant="brand" accent="violet">
      <CardContent className="pt-6 space-y-4 text-base leading-relaxed">
        <SettingsRow
          title="Adult content gating"
          body="Adult and sensitive content is hidden by default and gated behind an age-affirmation step. Accounts that don't meet the requirements don't see that content on Divine-controlled surfaces."
        />
        <SettingsRow
          title="Moderation lists and filters"
          body="Users can apply moderation lists, mute words, and filter creators they don't want to see. These can be revisited any time—they're not one-time decisions."
        />
        <SettingsRow
          title="Blocking and muting"
          body="Blocking removes someone from your view on Divine. Muting hides their posts without notifying them. Both are reversible."
        />
        <SettingsRow
          title="Reporting"
          body="The report button is inside the app and on every video and profile. Reports go to a human review queue."
        />
        <div className="pt-2 border-t border-brand-dark-green/15 dark:border-brand-green/20">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">A note on settings:</strong>{" "}
            even good settings can be turned off, worked around, or simply
            not catch every edge case. Treat them as one helpful layer of
            several—alongside conversation, check-ins, and the off
            switch.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
