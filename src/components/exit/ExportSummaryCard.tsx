import { CheckCircle, WarningCircle } from "@phosphor-icons/react";

import { Card, CardContent } from "@/components/ui/card";
import type { ArchiveManifest } from "@/lib/exit/archive";

interface ExportSummaryCardProps {
  manifest: ArchiveManifest;
  mediaCount: number;
}

function withheldMessage(withheld: ArchiveManifest["moderation"]["withheld"]): string {
  if (withheld?.complete) {
    if (withheld.count === 0) {
      return "Divine confirmed that it withheld no events from this archive.";
    }
    return `Divine withheld ${withheld.count} event${withheld.count === 1 ? "" : "s"} under its content rules. ${withheld.count === 1 ? "It isn't" : "They aren't"} in this archive.`;
  }
  if (withheld?.complete === false) {
    return "Divine couldn't confirm whether any events were withheld.";
  }
  return "This Divine API version didn't provide withheld-event details.";
}

export function ExportSummaryCard({ manifest, mediaCount }: ExportSummaryCardProps) {
  const failures = manifest.failures;
  const moderation = manifest.moderation;
  const bannedCount = moderation.annotations.filter(({ status }) => status === "banned").length;
  const quarantinedCount = moderation.annotations.filter(({ status }) => status === "quarantined").length;
  const moderationIncomplete = moderation.annotations_status === "incomplete" || moderation.withheld?.complete === false;
  const withheldPositive = moderation.withheld?.complete === true && moderation.withheld.count > 0;
  const warning = failures.length > 0 || moderationIncomplete || withheldPositive;

  const heading = failures.length > 0
    ? "This archive is incomplete."
    : manifest.event_count === 0
      ? "Your archive is ready, and it is empty."
      : moderationIncomplete
        ? "Your archive is ready, with moderation details unavailable."
        : withheldPositive
        ? "Your archive is ready, with some events withheld."
        : "Your archive is ready.";

  return (
    <Card variant="brand" accent={warning ? "yellow" : "green"}>
      <CardContent className="pt-6 flex items-start gap-3">
        {warning ? (
          <WarningCircle weight="fill" className="mt-1 h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green" />
        ) : (
          <CheckCircle weight="fill" className="mt-1 h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green" />
        )}
        <div className="space-y-2">
          <p className="font-semibold text-foreground">{heading}</p>
          <p className="text-base leading-relaxed text-muted-foreground">
            {manifest.page_count} page{manifest.page_count === 1 ? "" : "s"} read, {manifest.event_count} event{manifest.event_count === 1 ? "" : "s"} and {mediaCount} media reference{mediaCount === 1 ? "" : "s"} collected from Divine. Other relays were not checked, so anything you posted elsewhere is not in this file.
          </p>
          {bannedCount > 0 && <p className="text-base leading-relaxed text-muted-foreground">{bannedCount} event{bannedCount === 1 ? "" : "s"} in this archive {bannedCount === 1 ? "is" : "are"} banned on Divine. {bannedCount === 1 ? "It is" : "They are"} still yours and remain in your archive.</p>}
          {quarantinedCount > 0 && <p className="text-base leading-relaxed text-muted-foreground">{quarantinedCount} event{quarantinedCount === 1 ? "" : "s"} in this archive {quarantinedCount === 1 ? "is" : "are"} quarantined on Divine. {quarantinedCount === 1 ? "It is" : "They are"} still yours and remain in your archive.</p>}
          {moderation.annotations_status === "incomplete" && <p className="text-base leading-relaxed text-muted-foreground">Divine returned incomplete moderation annotations, so some event labels may be missing.</p>}
          {moderation.annotations_status === "unsupported" && <p className="text-base leading-relaxed text-muted-foreground">This Divine API version didn't provide event moderation annotations.</p>}
          <p className="text-base leading-relaxed text-muted-foreground">{withheldMessage(moderation.withheld)}</p>
          {failures.map((failure) => <p key={`${failure.code}-${failure.message}`} className="text-base leading-relaxed text-muted-foreground">{failure.message}</p>)}
          {failures.length > 0 && <p className="text-base leading-relaxed text-muted-foreground">You can download what was collected and run the export again; starting over is safe and does not duplicate anything.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
