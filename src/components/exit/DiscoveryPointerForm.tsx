// ABOUTME: Publishes and reports destination relay and Blossom discovery pointers
// ABOUTME: Keeps each pointer outcome visible without changing earlier migration summaries

import { ArrowClockwise, CheckCircle, MapPin, WarningCircle } from "@phosphor-icons/react";
import type { NostrSigner } from "@nostrify/nostrify";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDiscoveryPointers } from "@/hooks/useDiscoveryPointers";
import type { ArchiveFiles } from "@/lib/exit/archive";

interface DiscoveryPointerFormProps {
  files: ArchiveFiles;
  relayDestination: string;
  blossomDestination: string;
  signer: NostrSigner;
}

export function DiscoveryPointerForm(props: DiscoveryPointerFormProps) {
  const pointers = useDiscoveryPointers(props);
  const discoverable = pointers.summaries.filter((summary) => summary.status === "published").length;

  return (
    <Card variant="brand" accent="violet">
      <CardHeader><CardTitle>Point apps at your new home</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-base leading-relaxed text-muted-foreground">
          Check the media and post results above first. Publishing these pointers tells compatible apps where to find your posts and files.
        </p>
        <dl className="space-y-3 rounded-lg border border-brand-dark-green/15 p-4 dark:border-brand-green/25">
          <div><dt className="text-sm font-semibold text-foreground">Relay</dt><dd className="break-all text-sm text-muted-foreground">{props.relayDestination}</dd></div>
          <div><dt className="text-sm font-semibold text-foreground">Blossom server</dt><dd className="break-all text-sm text-muted-foreground">{props.blossomDestination}</dd></div>
        </dl>
        <Button type="button" variant="sticker" disabled={pointers.state === "running"} onClick={() => void pointers.start()}>
          {pointers.state === "running" ? <ArrowClockwise className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}
          {pointers.state === "running" ? "Publishing pointers" : "Publish destination pointers"}
        </Button>
        {pointers.state === "complete" && (
          <div className="space-y-4">
            <ul className="space-y-3">
              {pointers.summaries.map((summary) => {
                const ok = summary.status === "published";
                const outcome = ok
                  ? `published to ${summary.acceptedDiscoveryRelays.length} of ${summary.totalDiscoveryRelays} places apps look`
                  : summary.status === "destination-only"
                    ? "only published to your destination"
                    : "not published";
                return (
                  <li key={summary.kind} className="flex items-start gap-3">
                    {ok ? <CheckCircle weight="fill" className="mt-1 h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green" /> : <WarningCircle weight="fill" className="mt-1 h-5 w-5 flex-shrink-0 text-destructive" />}
                    <div>
                      <p className="font-semibold text-foreground">{summary.label} — {outcome}.</p>
                      {summary.failures.map((failure) => (
                        <p key={`${summary.kind}:${failure.relay ?? summary.status}`} className="break-all text-sm text-muted-foreground">
                          {failure.relay ? `${failure.relay}: ` : ""}{failure.reason}
                        </p>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-base leading-relaxed text-muted-foreground" role="status">
              {discoverable === 2
                ? "Other apps can now find your new home through public discovery relays."
                : "At least one pointer is not discoverable yet. Try publishing again before relying on automatic discovery."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
