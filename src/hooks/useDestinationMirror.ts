// ABOUTME: Orchestrates destination media mirroring for the account export page
// ABOUTME: Resets and aborts mirror work when the exported account changes

import type { NostrSigner } from "@nostrify/nostrify";
import { useEffect, useRef, useState } from "react";

import type { ArchiveFiles, MediaReference } from "@/lib/exit/archive";
import { normalizeDestinationUrl } from "@/lib/exit/destination";
import {
  mirrorArchiveMedia,
  summarizeMirrorResults,
  type MirrorProgress,
  type MirrorSummary,
} from "@/lib/exit/mirrorClient";

type DestinationMirrorState = "idle" | "running" | "complete" | "failed";

export function useDestinationMirror(input: { files: ArchiveFiles | null; signer: NostrSigner | null | undefined }) {
  const [state, setState] = useState<DestinationMirrorState>("idle");
  const [progress, setProgress] = useState<MirrorProgress | null>(null);
  const [summary, setSummary] = useState<MirrorSummary | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const activeController = useRef<AbortController | null>(null);
  const archivePubkey = input.files?.["manifest.json"].pubkey;

  useEffect(() => {
    activeController.current?.abort();
    setState("idle");
    setProgress(null);
    setSummary(null);
    setFailure(null);
    return () => activeController.current?.abort();
  }, [archivePubkey]);

  async function start(destinationValue: string) {
    if (!input.files || !input.signer) return;
    const controller = new AbortController();
    activeController.current?.abort();
    activeController.current = controller;
    setState("running");
    setProgress(null);
    setSummary(null);
    setFailure(null);
    try {
      const results = await mirrorArchiveMedia({
        destination: normalizeDestinationUrl(destinationValue),
        references: input.files["media.json"] as MediaReference[],
        signer: input.signer,
        signal: controller.signal,
        onProgress: setProgress,
      });
      if (controller.signal.aborted) return;
      setSummary(summarizeMirrorResults(results));
      setState("complete");
    } catch (error) {
      if (controller.signal.aborted) return;
      setFailure(error instanceof Error ? error.message : "The destination copy stopped. Try again.");
      setState("failed");
    } finally {
      if (activeController.current === controller) activeController.current = null;
    }
  }

  return { state, progress, summary, failure, start };
}
