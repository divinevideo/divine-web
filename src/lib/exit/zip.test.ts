import { describe, expect, it, vi } from "vitest";

import { createZip, createZipBytes, createZipWriter } from "./zip";

function readUint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function unzipStored(bytes: Uint8Array): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  let offset = 0;
  while (offset < bytes.length && readUint32(bytes, offset) === 0x04034b50) {
    const nameLength = bytes[offset + 26] | (bytes[offset + 27] << 8);
    const extraLength = bytes[offset + 28] | (bytes[offset + 29] << 8);
    const size32 = readUint32(bytes, offset + 18);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLength));
    const extraStart = nameStart + nameLength;
    const size = size32 === 0xffffffff
      ? Number(bytes.slice(extraStart + 4, extraStart + 12).reduceRight((total, byte) => total * 256 + byte, 0))
      : size32;
    const dataStart = extraStart + extraLength;
    files[name] = bytes.slice(dataStart, dataStart + size);
    offset = dataStart + size;
  }
  return files;
}

describe("createZip", () => {
  it("round-trips text and binary entries", async () => {
    const files = { "events.json": "[]\n", "media/blob.bin": new Uint8Array([0, 1, 255]) };
    const bytes = await createZipBytes(files);
    const zip = await createZip(files);
    expect(zip.type).toBe("application/zip");
    expect(zip.size).toBe(bytes.length);
    expect(new TextDecoder().decode(unzipStored(bytes)["events.json"])).toBe("[]\n");
    expect(unzipStored(bytes)["media/blob.bin"]).toEqual(new Uint8Array([0, 1, 255]));
  });

  it("writes entries to the sink before close", async () => {
    const write = vi.fn(async () => undefined);
    const writer = createZipWriter({ write });
    await writer.addFile("one", "body");
    expect(write).toHaveBeenCalledTimes(2);
    await writer.close();
  });

  it("emits Zip64 records for size, offset, directory, and count thresholds", async () => {
    const chunks: Uint8Array[] = [];
    const writer = createZipWriter({ write: async (chunk) => { chunks.push(chunk); } }, { zip32Limit: 8n, zip16Limit: 1n });
    await writer.addFile("first", new Uint8Array(9));
    await writer.addFile("second", new Uint8Array(1));
    await writer.close();
    const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    expect(Array.from({ length: bytes.length - 3 }, (_, offset) => readUint32(bytes, offset))).toContain(0x06064b50);
    expect(unzipStored(bytes)["first"]).toEqual(new Uint8Array(9));
  });

  it("aborts the underlying sink after a failed export", async () => {
    const abort = vi.fn(async () => undefined);
    const writer = createZipWriter({ write: async () => undefined, abort });
    await writer.abort(new Error("cancelled"));
    expect(abort).toHaveBeenCalledOnce();
    await expect(writer.addFile("late", "nope")).rejects.toThrow("already closed");
  });
});
