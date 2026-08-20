// ABOUTME: Shows per-blob verification progress while a media archive is written
// ABOUTME: Uses plain status text so partial and mismatched results remain unambiguous

import type { MediaProgress } from "@/lib/exit/mediaDownloader";

export function MediaProgressList({ progress }: { progress: MediaProgress | null }) {
  if (!progress) return null;
  const label = progress.result.verification === "verified"
    ? "Verified"
    : progress.result.verification === "unverified"
      ? "Saved without an advertised hash"
      : progress.result.verification === "hash-mismatch"
        ? "Saved separately because the hash did not match"
        : "Could not download";
  return (
    <div className="rounded-lg border border-brand-dark-green/15 p-4 dark:border-brand-green/25" aria-live="polite">
      <p className="font-semibold text-foreground">Media {progress.completed} of {progress.total}</p>
      <p className="text-sm text-muted-foreground">{label}: <span className="break-all">{progress.result.source_url}</span></p>
    </div>
  );
}
