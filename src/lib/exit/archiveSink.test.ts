import { afterEach, describe, expect, it, vi } from "vitest";

import { pickArchiveSink, supportsStreamingArchive } from "./archiveSink";

describe("archiveSink", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports unsupported browsers without allocating an in-memory fallback", async () => {
    expect(supportsStreamingArchive()).toBe(false);
    await expect(pickArchiveSink("archive.zip")).rejects.toThrow("cannot build one large media archive");
  });

  it("opens a ZIP file and returns its writable sink", async () => {
    const writable = { write: vi.fn(), close: vi.fn(), abort: vi.fn() };
    const picker = vi.fn(async () => ({ createWritable: async () => writable }));
    vi.stubGlobal("showSaveFilePicker", picker);
    await expect(pickArchiveSink("archive.zip")).resolves.toBe(writable);
    expect(picker).toHaveBeenCalledWith({
      suggestedName: "archive.zip",
      types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }],
    });
  });
});
