export const REMOTE_RELAY_HINT_CAP = 8;

export interface RelayAdmissionOptions {
  cap?: number;
  onRejected?: (relayUrl: string, reason: string) => void;
  onTruncated?: (droppedCount: number) => void;
}

interface ParsedRelayUrl {
  value: string;
  key: string;
  protocol: 'ws:' | 'wss:';
  hostname: string;
}

function parseRelayUrl(value: string): ParsedRelayUrl | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return null;
    if (url.pathname.startsWith('//')) return null;
    const protocol = url.protocol === 'ws:' ? 'ws:' : 'wss:';

    url.hash = '';
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();

    return {
      value: trimmed,
      key: url.toString(),
      protocol,
      hostname: url.hostname.toLowerCase(),
    };
  } catch {
    return null;
  }
}

function parseIpv4(hostname: string): number | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = (value << 8) + octet;
  }

  return value >>> 0;
}

function parseIpv6(hostname: string): Uint8Array | null {
  const unwrapped = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
  const zoneIndex = unwrapped.indexOf('%');
  const host = (zoneIndex === -1 ? unwrapped : unwrapped.slice(0, zoneIndex)).toLowerCase();

  if (!host.includes(':')) return null;

  const sides = host.split('::');
  if (sides.length > 2) return null;

  const parseGroup = (group: string): number[] | null => {
    if (!group) return [];
    const values: number[] = [];
    for (const part of group.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      values.push(parseInt(part, 16));
    }
    return values;
  };

  const left = parseGroup(sides[0]);
  const right = parseGroup(sides[1] ?? '');
  if (!left || !right) return null;

  const missing = sides.length === 2 ? 8 - left.length - right.length : 0;
  if (missing < 0) return null;

  const groups = sides.length === 2
    ? [...left, ...Array(missing).fill(0), ...right]
    : left;
  if (groups.length !== 8) return null;

  const bytes = new Uint8Array(16);
  groups.forEach((group, index) => {
    bytes[index * 2] = group >> 8;
    bytes[index * 2 + 1] = group & 0xff;
  });
  return bytes;
}

function isPrivateIpv4(value: number): boolean {
  const first = value >>> 24;
  const second = (value >>> 16) & 0xff;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isPrivateIpv6(bytes: Uint8Array): boolean {
  const isUnspecified = bytes.every((byte) => byte === 0);
  const isLoopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
  const isUniqueLocal = (bytes[0] & 0xfe) === 0xfc;
  const isLinkLocal = bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80;
  const isMulticast = bytes[0] === 0xff;
  const isIpv4Mapped = bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;

  if (isIpv4Mapped) {
    const ipv4 = ((bytes[12] << 24) | (bytes[13] << 16) | (bytes[14] << 8) | bytes[15]) >>> 0;
    return isPrivateIpv4(ipv4);
  }

  return isUnspecified || isLoopback || isUniqueLocal || isLinkLocal || isMulticast;
}

export function isPrivateOrLinkLocalHost(hostname: string): boolean {
  let host = hostname.toLowerCase();
  try {
    host = new URL(`wss://${host}`).hostname.toLowerCase();
  } catch {
    // Fall back to direct parsing for IPv6 strings that are already unwrapped.
  }

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa')
  ) {
    return true;
  }

  const ipv4 = parseIpv4(host);
  if (ipv4 !== null) return isPrivateIpv4(ipv4);

  const ipv6 = parseIpv6(host);
  if (ipv6) return isPrivateIpv6(ipv6);

  return false;
}

export function isRelayUrlAllowed(value: string): boolean {
  const parsed = parseRelayUrl(value);
  if (!parsed) return false;
  if (parsed.protocol === 'wss:') return true;
  return isPrivateOrLinkLocalHost(parsed.hostname);
}

export function isRemoteSuppliedRelayUrlAllowed(value: string): boolean {
  const parsed = parseRelayUrl(value);
  if (!parsed) return false;
  return parsed.protocol === 'wss:' && !isPrivateOrLinkLocalHost(parsed.hostname);
}

export function admitRelayUrls(relayUrls: string[]): string[] {
  const admitted: string[] = [];
  const seen = new Set<string>();

  for (const relayUrl of relayUrls) {
    const parsed = parseRelayUrl(relayUrl);
    if (!parsed || !isRelayUrlAllowed(parsed.value) || seen.has(parsed.key)) continue;
    seen.add(parsed.key);
    admitted.push(parsed.value);
  }

  return admitted;
}

export function admitRemoteSuppliedRelays(
  relayUrls: string[],
  options: RelayAdmissionOptions = {},
): string[] {
  const admitted: string[] = [];
  const seen = new Set<string>();

  for (const relayUrl of relayUrls) {
    const parsed = parseRelayUrl(relayUrl);
    if (!parsed) {
      options.onRejected?.(relayUrl, 'invalid relay URL');
      continue;
    }

    if (!isRemoteSuppliedRelayUrlAllowed(parsed.value)) {
      options.onRejected?.(parsed.value, 'remote relay URL must use wss:// and a public host');
      continue;
    }

    if (seen.has(parsed.key)) continue;
    seen.add(parsed.key);
    admitted.push(parsed.value);
  }

  if (options.cap !== undefined && admitted.length > options.cap) {
    const droppedCount = admitted.length - options.cap;
    options.onTruncated?.(droppedCount);
    return admitted.slice(0, options.cap);
  }

  return admitted;
}
