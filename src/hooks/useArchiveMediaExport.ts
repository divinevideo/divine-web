// ABOUTME: Orchestrates streamed media archive creation for the account export page
// ABOUTME: Keeps picker, downloader, ZIP finalization, and progress state out of the page

import type { NostrSigner } from "@nostrify/nostrify";
import { useEffect, useRef, useState } from "react";

import { completeArchiveMedia, serializeArchiveFiles, type ArchiveFiles, type MediaReference } from "@/lib/exit/archive";
import { pickArchiveSink, supportsStreamingArchive } from "@/lib/exit/archiveSink";
import { downloadArchiveMedia, type MediaProgress } from "@/lib/exit/mediaDownloader";
import { createZipWriter } from "@/lib/exit/zip";

type MediaExportState = "idle" | "running" | "complete" | "failed";

export function useArchiveMediaExport(input: { files: ArchiveFiles | null; signer: NostrSigner | null | undefined }) {
  const [state, setState] = useState<MediaExportState>("idle");
  const [progress, setProgress] = useState<MediaProgress | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const activeController = useRef<AbortController | null>(null);
  const archivePubkey = input.files?.["manifest.json"].pubkey;

  useEffect(() => {
    activeController.current?.abort();
    setState("idle");
    setProgress(null);
    setFailure(null);
    return () => activeController.current?.abort();
  }, [archivePubkey]);

  async function start() {
    if (!input.files || !input.signer || !supportsStreamingArchive()) return;
    const pubkey = input.files["manifest.json"].pubkey;
    let sink;
    try {
      sink = await pickArchiveSink(`divine-export-${pubkey}-with-media.zip`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFailure(error instanceof Error ? error.message : "The media archive could not be created.");
      setState("failed");
      return;
    }
    const writer = createZipWriter(sink);
    const controller = new AbortController();
    activeController.current?.abort();
    activeController.current = controller;
    setState("running");
    setFailure(null);
    setProgress(null);
    try {
      const initial = serializeArchiveFiles(input.files);
      await writer.addFile("events.json", initial["events.json"]);
      const results = await downloadArchiveMedia({
        references: input.files["media.json"] as MediaReference[],
        signer: input.signer,
        signal: controller.signal,
        onFile: (path, bytes) => writer.addFile(path, bytes),
        onProgress: setProgress,
      });
      if (controller.signal.aborted) throw new DOMException("Download cancelled", "AbortError");
      const completed = serializeArchiveFiles(completeArchiveMedia(input.files, results));
      await writer.addFile("manifest.json", completed["manifest.json"]);
      await writer.addFile("media.json", completed["media.json"]);
      await writer.addFile("media-checksums.txt", completed["media-checksums.txt"]);
      await writer.close();
      setState("complete");
    } catch (error) {
      await writer.abort(error);
      setFailure(error instanceof Error ? error.message : "The media archive could not be created.");
      setState("failed");
    } finally {
      if (activeController.current === controller) activeController.current = null;
    }
  }

  return { state, progress, failure, supported: supportsStreamingArchive(), start };
}
