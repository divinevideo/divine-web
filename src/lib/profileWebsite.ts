import { nip19 } from 'nostr-tools';

import { DIVINE_APEX_DOMAINS, getDivineNip05Info } from '@/lib/nip05Utils';
import { normalizeExternalUrl } from '@/lib/profileBioLinkify';
import { buildProfileLinkPath } from '@/lib/profileLinks';

function getProfilePubkey(pathname: string): string | undefined {
  const match = pathname.match(/^\/(?:profile\/)?([^/]+)\/?$/);
  if (!match) return undefined;
  try {
    const identifier = decodeURIComponent(match[1]).toLowerCase();
    if (/^[0-9a-f]{64}$/.test(identifier)) return identifier;
    const decoded = nip19.decode(identifier);
    return decoded.type === 'npub' ? decoded.data : undefined;
  } catch {
    return undefined;
  }
}

export function getProfileWebsiteLink(
  website: string | undefined,
  pubkey: string,
  verifiedNip05?: string,
): { href: string; label: string } | null {
  const href = normalizeExternalUrl(website);
  const label = website?.trim();
  if (!href || !label) return null;
  const original = { href, label };
  if (!verifiedNip05) return original;

  const url = new URL(href);
  const isDivineHost = DIVINE_APEX_DOMAINS.some((domain) => url.hostname === domain || url.hostname === `www.${domain}`);
  if (!isDivineHost || url.port || url.username || url.password) return original;

  const profilePath = buildProfileLinkPath({ pubkey, nip05: verifiedNip05 });
  const isOwnProfile = getProfilePubkey(url.pathname) === pubkey.toLowerCase()
    || url.pathname.replace(/\/$/, '') === profilePath;
  if (!isOwnProfile || !profilePath.startsWith('/u/')) return original;

  const destination = getDivineNip05Info(verifiedNip05)?.href ?? `https://divine.video${profilePath}`;
  return {
    href: `${destination}${url.search}${url.hash}`,
    label: destination.replace(/^https?:\/\//, ''),
  };
}
