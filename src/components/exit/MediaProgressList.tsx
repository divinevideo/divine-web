// ABOUTME: Shows per-blob verification progress while a media archive is written
// ABOUTME: Uses plain status text so partial and mismatched results remain unambiguous

import type { MediaProgress } from "@/lib/exit/mediaDownloader";
import { TransferProgress } from "@/components/exit/TransferProgress";

export function MediaProgressList({ progress }: { progress: MediaProgress | null }) {
  if (!progress) return null;
  const label = progress.result.verification === "verified"
    ? "Verified"
    : progress.result.verification === "unverified"
      ? "Saved without an advertised hash"
      : progress.result.verification === "hash-mismatch"
        ? "Saved separately because the hash did not match"
        : "Could not download";
  return <TransferProgress completed={progress.completed} total={progress.total} label={label} url={progress.result.source_url} />;
}
