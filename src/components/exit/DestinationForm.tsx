// ABOUTME: Collects a custom Blossom destination and reports mirror progress
// ABOUTME: Keeps destination validation errors next to the field that needs attention

import { ArrowClockwise, CheckCircle, Copy, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";

import { TransferProgress } from "@/components/exit/TransferProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DestinationError, normalizeDestinationUrl } from "@/lib/exit/destination";
import type { MirrorProgress, MirrorSummary } from "@/lib/exit/mirrorClient";

interface DestinationFormProps {
  state: "idle" | "running" | "complete" | "failed";
  progress: MirrorProgress | null;
  summary: MirrorSummary | null;
  failure: string | null;
  onStart(destination: string): Promise<void>;
}

function progressLabel(progress: MirrorProgress): string {
  switch (progress.result.verification) {
    case "descriptor-verified": return "Mirrored and confirmed by the destination";
    case "unverified": return "Mirrored without confirmed readback";
    case "hash-mismatch": return "Destination reported a different hash";
    case "skipped": return progress.result.reason ?? "Skipped this source";
    default: return "Could not mirror";
  }
}

export function DestinationForm({ state, progress, summary, failure, onStart }: DestinationFormProps) {
  const [destination, setDestination] = useState("");
  const [validationFailure, setValidationFailure] = useState<string | null>(null);

  function submit() {
    try {
      const normalized = normalizeDestinationUrl(destination);
      setDestination(normalized);
      setValidationFailure(null);
      void onStart(normalized);
    } catch (error) {
      setValidationFailure(error instanceof DestinationError ? error.message : "Enter a valid Blossom server URL.");
    }
  }

  return (
    <Card variant="brand" accent="violet">
      <CardHeader>
        <CardTitle>Copy media to another server</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-base leading-relaxed text-muted-foreground">
          Enter a Blossom server you trust. The server copies each original file directly from its current URL—your browser never re-uploads the media.
        </p>
        <div className="space-y-2">
          <label htmlFor="blossom-destination" className="text-sm font-semibold text-foreground">Blossom server URL</label>
          <Input
            id="blossom-destination"
            type="url"
            inputMode="url"
            placeholder="https://blossom.example"
            value={destination}
            disabled={state === "running"}
            aria-describedby={validationFailure ? "blossom-destination-error" : undefined}
            aria-invalid={Boolean(validationFailure)}
            onChange={(event) => setDestination(event.target.value)}
          />
          {validationFailure && <p id="blossom-destination-error" className="text-sm text-destructive" role="alert">{validationFailure}</p>}
        </div>
        <Button type="button" variant="sticker" disabled={state === "running" || !destination.trim()} onClick={submit}>
          {state === "running" ? <ArrowClockwise className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {state === "running" ? "Copying media" : "Copy my media"}
        </Button>
        {progress && <TransferProgress completed={progress.completed} total={progress.total} label={progressLabel(progress)} url={progress.result.source_url} />}
        {state === "failed" && failure && (
          <div className="flex items-start gap-3" role="alert">
            <WarningCircle weight="fill" className="mt-1 h-5 w-5 flex-shrink-0 text-destructive" />
            <p className="text-base leading-relaxed text-muted-foreground">{failure}</p>
          </div>
        )}
        {state === "complete" && summary && (
          <div className="flex items-start gap-3" role="status">
            <CheckCircle weight="fill" className="mt-1 h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green" />
            <div>
              <p className="font-semibold text-foreground">Destination copy finished.</p>
              <p className="text-base leading-relaxed text-muted-foreground">
                {summary.mirrored} mirrored, {summary.failed} failed, {summary.skipped} skipped, and {summary.unverified} unverified.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
