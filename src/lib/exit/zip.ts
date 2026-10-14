// ABOUTME: Streaming store-only ZIP64 writer for account archives
// ABOUTME: Writes each entry directly to a sink while retaining only central-directory metadata

const encoder = new TextEncoder();
const ZIP32_MAX = 0xffffffffn;
// General-purpose bit 11 (EFS): entry names are UTF-8, not CP437.
const UTF8_NAME_FLAG = 0x0800;
const ZIP16_MAX = 0xffffn;

export interface ZipSink {
  write(chunk: Uint8Array): Promise<void>;
  close?(): Promise<void>;
  abort?(reason?: unknown): Promise<void>;
}

export type ZipContent = string | Uint8Array;

export interface ZipWriter {
  addFile(name: string, content: ZipContent): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
}

interface Entry {
  name: Uint8Array;
  crc32: number;
  size: bigint;
  offset: bigint;
  zip64Size: boolean;
  zip64Offset: boolean;
}

interface ZipWriterOptions {
  zip32Limit?: bigint;
  zip16Limit?: bigint;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value: number | bigint): Uint8Array {
  const number = Number(value);
  return new Uint8Array([number & 0xff, (number >>> 8) & 0xff]);
}

function uint32(value: number | bigint): Uint8Array {
  const number = Number(BigInt(value) & ZIP32_MAX);
  return new Uint8Array([number & 0xff, (number >>> 8) & 0xff, (number >>> 16) & 0xff, (number >>> 24) & 0xff]);
}

function uint64(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  let remaining = value;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function zip64Extra(values: bigint[]): Uint8Array {
  const body = concat(values.map(uint64));
  return concat([uint16(0x0001), uint16(body.length), body]);
}

export function createZipWriter(sink: ZipSink, options: ZipWriterOptions = {}): ZipWriter {
  const zip32Limit = options.zip32Limit ?? ZIP32_MAX;
  const zip16Limit = options.zip16Limit ?? ZIP16_MAX;
  const entries: Entry[] = [];
  let offset = 0n;
  let finished = false;

  async function write(chunk: Uint8Array) {
    await sink.write(chunk);
    offset += BigInt(chunk.length);
  }

  return {
    async addFile(name, content) {
      if (finished) throw new Error("This ZIP writer is already closed.");
      const encodedName = encoder.encode(name);
      if (encodedName.length > 0xffff) throw new RangeError("This archive entry name is too long.");
      const body = typeof content === "string" ? encoder.encode(content) : content;
      const size = BigInt(body.length);
      const entryOffset = offset;
      const zip64Size = size > zip32Limit;
      const zip64Offset = entryOffset > zip32Limit;
      const checksum = crc32(body);
      const extra = zip64Size ? zip64Extra([size, size]) : new Uint8Array();
      entries.push({ name: encodedName, crc32: checksum, size, offset: entryOffset, zip64Size, zip64Offset });
      await write(concat([
        uint32(0x04034b50), uint16(zip64Size ? 45 : 20), uint16(UTF8_NAME_FLAG), uint16(0), uint16(0), uint16(0),
        uint32(checksum), uint32(zip64Size ? ZIP32_MAX : size), uint32(zip64Size ? ZIP32_MAX : size),
        uint16(encodedName.length), uint16(extra.length), encodedName, extra,
      ]));
      await write(body);
    },

    async close() {
      if (finished) return;
      finished = true;
      const centralOffset = offset;
      let usesZip64 = false;
      for (const entry of entries) {
        const values: bigint[] = [];
        if (entry.zip64Size) values.push(entry.size, entry.size);
        if (entry.zip64Offset) values.push(entry.offset);
        const extra = values.length ? zip64Extra(values) : new Uint8Array();
        usesZip64 ||= values.length > 0;
        await write(concat([
          uint32(0x02014b50), uint16(45), uint16(values.length ? 45 : 20), uint16(UTF8_NAME_FLAG), uint16(0), uint16(0), uint16(0),
          uint32(entry.crc32), uint32(entry.zip64Size ? ZIP32_MAX : entry.size), uint32(entry.zip64Size ? ZIP32_MAX : entry.size),
          uint16(entry.name.length), uint16(extra.length), uint16(0), uint16(0), uint16(0), uint32(0),
          uint32(entry.zip64Offset ? ZIP32_MAX : entry.offset), entry.name, extra,
        ]));
      }
      const centralSize = offset - centralOffset;
      const count = BigInt(entries.length);
      usesZip64 ||= centralOffset > zip32Limit || centralSize > zip32Limit || count > zip16Limit;
      if (usesZip64) {
        const zip64Offset = offset;
        await write(concat([
          uint32(0x06064b50), uint64(44n), uint16(45), uint16(45), uint32(0), uint32(0),
          uint64(count), uint64(count), uint64(centralSize), uint64(centralOffset),
        ]));
        await write(concat([uint32(0x07064b50), uint32(0), uint64(zip64Offset), uint32(1)]));
      }
      await write(concat([
        uint32(0x06054b50), uint16(0), uint16(0),
        uint16(count > zip16Limit ? ZIP16_MAX : count), uint16(count > zip16Limit ? ZIP16_MAX : count),
        uint32(centralSize > zip32Limit ? ZIP32_MAX : centralSize), uint32(centralOffset > zip32Limit ? ZIP32_MAX : centralOffset), uint16(0),
      ]));
      await sink.close?.();
    },

    async abort(reason) {
      if (finished) return;
      finished = true;
      await sink.abort?.(reason);
    },
  };
}

export async function createZipBytes(files: Record<string, ZipContent>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const writer = createZipWriter({ write: async (chunk) => { parts.push(chunk); } });
  for (const [name, content] of Object.entries(files)) await writer.addFile(name, content);
  await writer.close();
  return concat(parts);
}

export async function createZip(files: Record<string, ZipContent>): Promise<Blob> {
  const parts: BlobPart[] = [];
  const writer = createZipWriter({ write: async (chunk) => { parts.push(chunk.slice().buffer); } });
  for (const [name, content] of Object.entries(files)) await writer.addFile(name, content);
  await writer.close();
  return new Blob(parts, { type: "application/zip" });
}
