import { describe, expect, it } from "vitest";

import { createZip, createZipBytes } from "./zip";

function readUint32(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function unzipStored(bytes: Uint8Array): Record<string, string> {
  const files: Record<string, string> = {};
  let offset = 0;

  while (offset < bytes.length && readUint32(bytes, offset) === 0x04034b50) {
    const compression = readUint16(bytes, offset + 8);
    const size = readUint32(bytes, offset + 18);
    const nameLength = readUint16(bytes, offset + 26);
    const extraLength = readUint16(bytes, offset + 28);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    const data = bytes.slice(dataStart, dataStart + size);

    if (compression !== 0) {
      throw new Error(`expected stored compression for ${name}`);
    }

    files[name] = new TextDecoder().decode(data);
    offset = dataStart + size;
  }

  return files;
}

describe("createZip", () => {
  it("creates a zip blob whose stored files round-trip", async () => {
    const files = {
      "events.json": "[]\n",
      "manifest.json": "{}\n",
      "media.json": "[]\n"
    };
    const zipBytes = createZipBytes(files);
    const zip = createZip(files);

    expect(zip.type).toBe("application/zip");
    expect(zip.size).toBe(zipBytes.byteLength);
    expect(unzipStored(zipBytes)).toEqual(files);
  });
});
