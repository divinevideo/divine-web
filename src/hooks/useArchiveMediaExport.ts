// ABOUTME: Orchestrates streamed media archive creation for the account export page
// ABOUTME: Keeps picker, downloader, ZIP finalization, and progress state out of the page

import type { NostrSigner } from "@nostrify/nostrify";
import { useEffect, useRef, useState } from "react";

import { completeArchiveMedia, serializeArchiveFiles, summarizeMedia, type ArchiveFiles, type MediaSummary } from "@/lib/exit/archive";
import { pickArchiveSink, supportsStreamingArchive } from "@/lib/exit/archiveSink";
import { downloadArchiveMedia, type MediaDownloadResult, type MediaProgress } from "@/lib/exit/mediaDownloader";
import { createZipWriter } from "@/lib/exit/zip";

export type MediaExportState = "idle" | "running" | "complete" | "partial" | "no-media" | "empty" | "failed";

export function classifyMediaExport(summary: MediaSummary): Extract<MediaExportState, "complete" | "partial" | "no-media" | "empty"> {
  if (summary.media_total === 0) return "empty";
  if (summary.media_failed === summary.media_total) return "no-media";
  if (summary.media_failed > 0 || summary.media_mismatched > 0) return "partial";
  return "complete";
}

export function useArchiveMediaExport(input: { files: ArchiveFiles | null; signer: NostrSigner | null | undefined }) {
  const [state, setState] = useState<MediaExportState>("idle");
  const [progress, setProgress] = useState<MediaProgress | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [summary, setSummary] = useState<MediaSummary | null>(null);
  const [results, setResults] = useState<MediaDownloadResult[]>([]);
  const activeController = useRef<AbortController | null>(null);
  const archiveIdentity = input.files
    ? `${input.files["manifest.json"].pubkey}:${input.files["manifest.json"].snapshot?.enforcement_id ?? "owner"}`
    : undefined;

  useEffect(() => {
    activeController.current?.abort();
    setState("idle");
    setProgress(null);
    setFailure(null);
    setSummary(null);
    setResults([]);
    return () => activeController.current?.abort();
  }, [archiveIdentity]);

  async function start() {
    if (!input.files || !input.signer || !supportsStreamingArchive()) return;
    const pubkey = input.files["manifest.json"].pubkey;
    let sink;
    try {
      sink = await pickArchiveSink(`divine-export-${pubkey}-media.zip`);
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
    setSummary(null);
    setResults([]);
    try {
      const initial = serializeArchiveFiles(input.files);
      await writer.addFile("events.json", initial["events.json"]);
      const results = await downloadArchiveMedia({
        references: input.files["media.json"],
        signer: input.signer,
        signal: controller.signal,
        onFile: (path, bytes) => writer.addFile(path, bytes),
        onProgress: setProgress,
      });
      if (controller.signal.aborted) throw new DOMException("Download cancelled", "AbortError");
      const completed = serializeArchiveFiles(completeArchiveMedia(input.files, results));
      await writer.addFile("manifest.json", completed["manifest.json"]);
      await writer.addFile("media.json", completed["media.json"]);
      if (completed["media-checksums.txt"]) await writer.addFile("media-checksums.txt", completed["media-checksums.txt"]);
      if (completed["media-failures.txt"]) await writer.addFile("media-failures.txt", completed["media-failures.txt"]);
      await writer.close();
      const mediaSummary = summarizeMedia(results);
      setSummary(mediaSummary);
      setResults(results);
      setState(classifyMediaExport(mediaSummary));
    } catch (error) {
      await writer.abort(error);
      setFailure(error instanceof Error ? error.message : "The media archive could not be created.");
      setState("failed");
    } finally {
      if (activeController.current === controller) activeController.current = null;
    }
  }

  return { state, progress, failure, summary, results, supported: supportsStreamingArchive(), start };
}
