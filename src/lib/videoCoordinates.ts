// ABOUTME: Shared parsing helpers for Nostr addressable video coordinates

export interface VideoCoordinate {
  kind: number;
  pubkey: string;
  dTag: string;
}

export function parseVideoCoordinate(value: string, allowedKinds: readonly number[]): VideoCoordinate | null {
  const firstSeparator = value.indexOf(':');
  const secondSeparator = value.indexOf(':', firstSeparator + 1);
  if (firstSeparator < 0 || secondSeparator < 0) return null;

  const kind = Number(value.slice(0, firstSeparator));
  const pubkey = value.slice(firstSeparator + 1, secondSeparator);
  const dTag = value.slice(secondSeparator + 1);

  if (!allowedKinds.includes(kind) || !pubkey || !dTag) return null;
  return { kind, pubkey, dTag };
}

export function videoCoordinateKey(coordinate: Pick<VideoCoordinate, 'pubkey' | 'dTag'>): string {
  return `${coordinate.pubkey}:${coordinate.dTag}`;
}
