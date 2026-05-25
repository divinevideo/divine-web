// ABOUTME: Utility for subdomain-aware URL building
// ABOUTME: On subdomains, links to the owner's content stay local; everything else links to apex domain

import { getSubdomainUser } from '@/hooks/useSubdomainUser';

/**
 * Check if a pubkey (hex or npub) belongs to the subdomain user.
 */
export function isSubdomainOwner(pubkey: string | undefined | null): boolean {
  if (!pubkey) return false;
  const user = getSubdomainUser();
  if (!user) return false;
  return pubkey === user.pubkey || pubkey === user.npub;
}

/**
 * Build a subdomain-aware URL.
 *
 * When on a subdomain (e.g., alice.divine.video):
 * - Links to the subdomain user's content → relative path (stays on subdomain)
 * - Links to anything else → absolute URL on apex domain (leaves subdomain)
 *
 * When NOT on a subdomain, always returns the relative path unchanged.
 *
 * @param path - The route path (e.g., "/profile/npub1..." or "/discovery")
 * @param contentOwnerPubkey - Optional pubkey of the content's owner (hex or npub)
 */
export function getSubdomainAwareUrl(
  path: string,
  contentOwnerPubkey?: string | null,
): { href: string; isExternal: boolean } {
  const user = getSubdomainUser();

  // Not on a subdomain — everything is local
  if (!user) {
    return { href: path, isExternal: false };
  }

  // If we know the content owner and it matches the subdomain user, stay local
  if (contentOwnerPubkey && isSubdomainOwner(contentOwnerPubkey)) {
    return { href: path, isExternal: false };
  }

  // Check if path is the subdomain user's profile
  if (isSubdomainUserProfilePath(path, user.npub)) {
    return { href: path, isExternal: false };
  }

  // Root path stays local (renders subdomain user's profile directly)
  if (path === '/') {
    return { href: path, isExternal: false };
  }

  // Everything else goes to the apex domain
  return {
    href: `https://${user.apexDomain}${path}`,
    isExternal: true,
  };
}

/**
 * Check if a path points to the subdomain user's profile.
 */
function isSubdomainUserProfilePath(path: string, ownerNpub: string): boolean {
  // Match /profile/{npub} or /{npub}
  const normalized = path.replace(/\/$/, '');
  return normalized === `/profile/${ownerNpub}` || normalized === `/${ownerNpub}`;
}

/**
 * Get the apex domain URL for sharing. On subdomains, share links should
 * always use the apex domain for consistency.
 */
export function getApexShareUrl(path: string): string {
  const user = getSubdomainUser();
  if (!user) {
    return `${window.location.origin}${path}`;
  }
  return `https://${user.apexDomain}${path}`;
}
