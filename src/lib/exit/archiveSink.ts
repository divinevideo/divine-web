// ABOUTME: Adapts the File System Access API writable stream to the archive ZIP sink
// ABOUTME: Keeps unsupported-browser detection isolated from archive orchestration

import type { ZipSink } from "./zip";

interface ArchiveWritable {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
}

interface SaveFileHandle { createWritable(): Promise<ArchiveWritable>; }
interface SavePickerWindow extends Window {
  showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<SaveFileHandle>;
}

export function supportsStreamingArchive(): boolean {
  return typeof (window as SavePickerWindow).showSaveFilePicker === "function";
}

export async function pickArchiveSink(suggestedName: string): Promise<ZipSink> {
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (!picker) throw new Error("This browser cannot build one large media archive.");
  const handle = await picker({ suggestedName, types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }] });
  return handle.createWritable();
}
