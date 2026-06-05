import { nip19 } from 'nostr-tools';

const HEX_PUBKEY_PATTERN = /^[0-9a-f]{64}$/i;

export type ProfileFallbackRoute = 'root' | 'profile';

interface BuildProfileLinkPathInput {
  pubkey: string;
  nip05?: string | null;
  fallbackRoute?: ProfileFallbackRoute;
}

export function buildProfileLinkPath({
  pubkey,
  nip05,
  fallbackRoute = 'root',
}: BuildProfileLinkPathInput): string {
  const normalizedNip05 = normalizeNip05Identifier(nip05);
  if (normalizedNip05) {
    return `/u/${encodeURIComponent(normalizedNip05)}`;
  }

  const npub = toNpub(pubkey);
  return fallbackRoute === 'profile' ? `/profile/${npub}` : `/${npub}`;
}

export function normalizeNip05Identifier(nip05?: string | null): string | null {
  if (!nip05) return null;

  const normalized = nip05.trim().toLowerCase();
  if (!normalized) return null;

  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return null;
  }

  if (normalized.indexOf('@') !== atIndex) {
    return null;
  }

  return normalized;
}

function toNpub(pubkey: string): string {
  const normalized = pubkey.trim();
  if (normalized.startsWith('npub1')) {
    return normalized;
  }

  if (!HEX_PUBKEY_PATTERN.test(normalized)) {
    return normalized;
  }

  try {
    return nip19.npubEncode(normalized.toLowerCase());
  } catch {
    return normalized;
  }
}
