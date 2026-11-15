import { nip19 } from 'nostr-tools';

import { DIVINE_APEX_DOMAINS, getDivineNip05Info } from '@/lib/nip05Utils';
import { normalizeExternalUrl } from '@/lib/profileBioLinkify';
import {
  buildProfileLinkPath,
  nip05CandidatesFromUrlSegment,
  normalizeNip05Identifier,
} from '@/lib/profileLinks';

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

// The router resolves /u/:userId and /profile/:userId through NIP-05 identity
// candidates, so a self link spelled in any of those forms — the bare or dotted
// friendly segment, or the raw identifier the NIP-05 badge links with — is the
// current profile's own link too. divine.video's apex and subdomain spellings of
// one name are one identity (getDivineNip05Info maps both to the same host), so
// those spellings match each other as well. Only spellings of the verified
// identity ever match, so another profile's URL is never rewritten.
function matchesVerifiedNip05(pathname: string, verifiedNip05: string): boolean {
  const match = pathname.replace(/\/$/, '').match(/^\/(?:u|profile)\/([^/]+)$/);
  if (!match) return false;
  const normalized = normalizeNip05Identifier(verifiedNip05);
  if (!normalized) return false;
  try {
    if (nip05CandidatesFromUrlSegment(match[1]).includes(normalized)) return true;
  } catch {
    return false;
  }
  let segment: string;
  try {
    segment = decodeURIComponent(match[1]);
  } catch {
    return false;
  }
  const segmentIdentifier = normalizeNip05Identifier(segment);
  if (!segmentIdentifier) return false;
  const segmentInfo = getDivineNip05Info(segmentIdentifier);
  const verifiedInfo = getDivineNip05Info(normalized);
  return !!segmentInfo && !!verifiedInfo && segmentInfo.href === verifiedInfo.href;
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
    || url.pathname.replace(/\/$/, '') === profilePath
    || matchesVerifiedNip05(url.pathname, verifiedNip05);
  if (!isOwnProfile || !profilePath.startsWith('/u/')) return original;

  const destination = getDivineNip05Info(verifiedNip05)?.href ?? `https://divine.video${profilePath}`;
  return {
    href: `${destination}${url.search}${url.hash}`,
    label: destination.replace(/^https?:\/\//, ''),
  };
}
