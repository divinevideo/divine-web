// ABOUTME: Collects a destination relay and reports per-event republication outcomes
// ABOUTME: Keeps relay validation and migration limitations visible beside the action

import { ArrowClockwise, Broadcast, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";

import { TransferProgress } from "@/components/exit/TransferProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DestinationError } from "@/lib/exit/destination";
import { normalizeRelayDestinationUrl } from "@/lib/exit/relayDestination";
import { DEFAULT_RELAY_AGE_LIMIT_SECONDS, type PublishProgress, type PublishResult, type PublishSummary } from "@/lib/exit/relayPublisher";

interface RelayDestinationFormProps {
  state: "idle" | "running" | "complete" | "failed";
  progress: PublishProgress | null;
  results: PublishResult[] | null;
  summary: PublishSummary | null;
  failure: string | null;
  oldestVideoCreatedAt: number | null;
  onStart(destination: string): Promise<void>;
}

function progressLabel(result: PublishResult): string {
  switch (result.status) {
    case "published": return "Rewritten, signed, and published";
    case "unchanged": return result.reason ?? "Original signed event published unchanged";
    case "skipped": return result.reason ?? "Skipped";
    default: return result.reason ?? "Could not publish";
  }
}

function formatArchiveDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(timestamp * 1000));
}

export function RelayDestinationForm({ state, progress, results, summary, failure, oldestVideoCreatedAt, onStart }: RelayDestinationFormProps) {
  const [destination, setDestination] = useState("");
  const [validationFailure, setValidationFailure] = useState<string | null>(null);
  const defaultAgeCutoff = Math.floor(Date.now() / 1000) - DEFAULT_RELAY_AGE_LIMIT_SECONDS;

  function submit() {
    try {
      const normalized = normalizeRelayDestinationUrl(destination);
      setDestination(normalized);
      setValidationFailure(null);
      void onStart(normalized);
    } catch (error) {
      setValidationFailure(error instanceof DestinationError ? error.message : "Enter a valid relay URL.");
    }
  }

  return (
    <Card variant="brand" accent="orange">
      <CardHeader><CardTitle>Publish your posts to another relay</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-base leading-relaxed text-muted-foreground">
          Enter a relay you trust. Media links with confirmed destination copies will be updated; anything that could not be copied keeps its original link.
        </p>
        {oldestVideoCreatedAt !== null && oldestVideoCreatedAt < defaultAgeCutoff && (
          <p className="text-base leading-relaxed text-muted-foreground">
            Your oldest archived video is from {formatArchiveDate(oldestVideoCreatedAt)}. Many relays refuse posts older than three years, so Divine republishes old videos with today&apos;s event date and keeps their original publication dates in the video metadata.
          </p>
        )}
        <div className="space-y-2">
          <label htmlFor="relay-destination" className="text-sm font-semibold text-foreground">Relay URL</label>
          <Input
            id="relay-destination"
            type="url"
            inputMode="url"
            placeholder="wss://relay.example"
            value={destination}
            disabled={state === "running"}
            aria-describedby={validationFailure ? "relay-destination-error" : undefined}
            aria-invalid={Boolean(validationFailure)}
            onChange={(event) => setDestination(event.target.value)}
          />
          {validationFailure && <p id="relay-destination-error" className="text-sm text-destructive" role="alert">{validationFailure}</p>}
        </div>
        <Button type="button" variant="sticker" disabled={state === "running" || !destination.trim()} onClick={submit}>
          {state === "running" ? <ArrowClockwise className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Broadcast className="h-4 w-4" aria-hidden="true" />}
          {state === "running" ? "Publishing posts" : "Publish my posts"}
        </Button>
        {progress && (
          <TransferProgress
            completed={progress.completed}
            total={progress.total}
            itemLabel="Event"
            label={progressLabel(progress.result)}
            url={progress.result.event_id}
          />
        )}
        {state === "failed" && failure && (
          <div className="flex items-start gap-3" role="alert">
            <WarningCircle weight="fill" className="mt-1 h-5 w-5 flex-shrink-0 text-destructive" />
            <p className="text-base leading-relaxed text-muted-foreground">{failure}</p>
          </div>
        )}
        {state === "complete" && summary && (
          <div className="space-y-4">
            <div className="flex items-start gap-3" role="status">
              <CheckCircle weight="fill" className="mt-1 h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green" />
              <div>
                <p className="font-semibold text-foreground">Relay publish finished.</p>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {summary.published} rewritten, {summary.unchanged} unchanged, {summary.failed} failed, and {summary.skipped} skipped.
                  {summary.redated > 0 ? ` ${summary.redated} archived video${summary.redated === 1 ? " was" : "s were"} republished with today's event date; original publication dates remain in the video metadata.` : ""}
                  {summary.remainingMediaUrls > 0 ? ` ${summary.remainingMediaUrls} media link${summary.remainingMediaUrls === 1 ? "" : "s"} still point${summary.remainingMediaUrls === 1 ? "s" : ""} to the original location.` : ""}
                </p>
              </div>
            </div>
            {results && results.length > 0 && (
              <details className="rounded-lg border border-brand-dark-green/15 p-4 dark:border-brand-green/25">
                <summary className="cursor-pointer font-semibold text-foreground">Event results</summary>
                <ul className="mt-3 space-y-3">
                  {results.map((result) => (
                    <li key={result.event_id} className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{progressLabel(result)}</span>
                      <span className="block break-all">{result.event_id}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
