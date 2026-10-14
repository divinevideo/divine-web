// ABOUTME: Summarizes the final contents and integrity of a streamed media archive
// ABOUTME: Keeps failed downloads and quarantined hash mismatches visible after progress ends

import type { MediaExportState } from "@/hooks/useArchiveMediaExport";
import type { MediaSummary } from "@/lib/exit/archive";
import type { MediaDownloadResult } from "@/lib/exit/mediaDownloader";
import { Card, CardContent } from "@/components/ui/card";

interface MediaExportSummaryProps {
  state: MediaExportState;
  summary: MediaSummary | null;
  results: MediaDownloadResult[];
}

export function MediaExportSummary({ state, summary, results }: MediaExportSummaryProps) {
  if (!summary || !["complete", "partial", "no-media", "empty"].includes(state)) return null;

  const saved = summary.media_verified + summary.media_unverified;
  const issues = results.filter((result) => result.verification === "failed" || result.verification === "hash-mismatch");
  const accent = state === "complete" ? "green" : state === "no-media" ? "pink" : "yellow";
  const heading = state === "complete"
    ? `Your media archive is saved — ${saved} of ${summary.media_total} files saved.`
    : state === "partial"
      ? `${saved} of ${summary.media_total} files were saved as usable media.`
      : state === "no-media"
        ? `No media was saved. The archive has your events, but none of your ${summary.media_total} media files could be downloaded.`
        : "Your archive has no media files to save.";

  return (
    <Card variant="brand" accent={accent} role={state === "no-media" ? "alert" : "status"}>
      <CardContent className="space-y-3 pt-6">
        <p className="text-base font-semibold text-foreground">{heading}</p>
        {summary.media_unverified > 0 && (
          <p className="text-sm text-muted-foreground">
            {summary.media_unverified} saved without an advertised hash.
          </p>
        )}
        {summary.media_mismatched > 0 && (
          <p className="text-sm text-muted-foreground">
            {summary.media_mismatched} saved separately because the advertised hash did not match.
          </p>
        )}
        {issues.length > 0 && (
          <ul className="space-y-2 text-sm text-muted-foreground">
            {issues.map((result) => (
              <li key={`${result.verification}:${result.expected_sha256}:${result.source_url}`} className="break-all">
                <span className="font-semibold text-foreground">{result.source_url}</span>
                {result.verification === "failed"
                  ? ` — ${result.failure_reason ?? "Download failed"}`
                  : ` — Hash mismatch; expected ${result.expected_sha256 ?? "unknown"}, computed ${result.computed_sha256 ?? "unknown"}.`}
              </li>
            ))}
          </ul>
        )}
        {issues.length > 0 && (
          <p className="text-sm text-muted-foreground">The details are also in media-failures.txt inside the archive.</p>
        )}
      </CardContent>
    </Card>
  );
}
