// ABOUTME: Helpers for building and parsing Nostr addressable event coordinates

const HEX64 = /^[0-9a-f]{64}$/i;

export interface AddressableCoordinate {
  kind: number;
  pubkey: string;
  dTag: string;
}

export function buildAddressableCoordinate(kind: number, pubkey: string, dTag: string): string {
  return `${kind}:${pubkey}:${dTag}`;
}

export function parseAddressableCoordinate(value: string): AddressableCoordinate | null {
  const firstSeparator = value.indexOf(':');
  if (firstSeparator === -1) return null;

  const secondSeparator = value.indexOf(':', firstSeparator + 1);
  if (secondSeparator === -1) return null;

  const kindText = value.slice(0, firstSeparator);
  const pubkey = value.slice(firstSeparator + 1, secondSeparator);
  const dTag = value.slice(secondSeparator + 1);

  if (!/^\d+$/.test(kindText)) return null;
  const kind = Number(kindText);
  if (!Number.isInteger(kind)) return null;
  if (!HEX64.test(pubkey)) return null;
  if (!dTag) return null;

  return { kind, pubkey, dTag };
}

export function isHex64(value: string): boolean {
  return HEX64.test(value);
}
