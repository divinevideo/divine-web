// ABOUTME: Minimal store-only ZIP writer for the account archive download
// ABOUTME: Avoids a compression dependency for the handful of JSON files we emit

const encoder = new TextEncoder();

interface CentralDirectoryEntry {
  name: Uint8Array;
  crc32: number;
  size: number;
  offset: number;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }

  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function uint32(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  ]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

export function createZipBytes(files: Record<string, string>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const entries: CentralDirectoryEntry[] = [];
  let offset = 0;

  for (const [filename, content] of Object.entries(files)) {
    const name = encoder.encode(filename);
    const body = encoder.encode(content);
    const checksum = crc32(body);
    const localHeader = concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(body.length),
      uint32(body.length),
      uint16(name.length),
      uint16(0),
      name
    ]);

    localParts.push(localHeader, body);
    entries.push({ name, crc32: checksum, size: body.length, offset });
    offset += localHeader.length + body.length;
  }

  const centralDirectoryOffset = offset;

  for (const entry of entries) {
    centralParts.push(
      concat([
        uint32(0x02014b50),
        uint16(20),
        uint16(20),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(entry.crc32),
        uint32(entry.size),
        uint32(entry.size),
        uint16(entry.name.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(entry.offset),
        entry.name
      ])
    );
  }

  const centralDirectory = concat(centralParts);
  const endOfCentralDirectory = concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(centralDirectory.length),
    uint32(centralDirectoryOffset),
    uint16(0)
  ]);

  return concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

export function createZip(files: Record<string, string>): Blob {
  const bytes = createZipBytes(files);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  return new Blob([copy.buffer], {
    type: "application/zip"
  });
}
