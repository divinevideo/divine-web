// ABOUTME: Orchestrates destination relay republication for the account exit flow
// ABOUTME: Aborts active work and clears relay results when its archive or mirror changes

import type { NostrSigner } from "@nostrify/nostrify";
import { useEffect, useRef, useState } from "react";

import type { ArchiveFiles } from "@/lib/exit/archive";
import type { MirrorResult } from "@/lib/exit/mirrorClient";
import {
  publishArchiveEvents,
  summarizePublishResults,
  type PublishProgress,
  type PublishResult,
  type PublishSummary,
} from "@/lib/exit/relayPublisher";

type DestinationRepublishState = "idle" | "running" | "complete" | "failed";

export function useDestinationRepublish(input: {
  files: ArchiveFiles | null;
  mirrorResults: MirrorResult[] | null;
  signer: NostrSigner | null | undefined;
}) {
  const [state, setState] = useState<DestinationRepublishState>("idle");
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [results, setResults] = useState<PublishResult[] | null>(null);
  const [summary, setSummary] = useState<PublishSummary | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const activeController = useRef<AbortController | null>(null);
  const archivePubkey = input.files?.["manifest.json"].pubkey;

  useEffect(() => {
    activeController.current?.abort();
    setState("idle");
    setProgress(null);
    setResults(null);
    setSummary(null);
    setFailure(null);
    return () => activeController.current?.abort();
  }, [archivePubkey, input.mirrorResults]);

  async function start(destination: string) {
    if (!input.files || !input.mirrorResults || !input.signer) return;
    const controller = new AbortController();
    activeController.current?.abort();
    activeController.current = controller;
    setState("running");
    setProgress(null);
    setResults(null);
    setSummary(null);
    setFailure(null);
    try {
      const publishResults = await publishArchiveEvents({
        destination,
        events: input.files["events.json"],
        mirrorResults: input.mirrorResults,
        signer: input.signer,
        signal: controller.signal,
        onProgress: setProgress,
      });
      if (controller.signal.aborted) return;
      setResults(publishResults);
      setSummary(summarizePublishResults(publishResults));
      setState("complete");
    } catch (error) {
      if (controller.signal.aborted) return;
      setFailure(error instanceof Error ? error.message : "The relay publish stopped. Try again.");
      setState("failed");
    } finally {
      if (activeController.current === controller) activeController.current = null;
    }
  }

  return { state, progress, results, summary, failure, start };
}
