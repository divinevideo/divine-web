// ABOUTME: Utility functions for divine.video NIP-05 detection and formatting
// ABOUTME: Handles both _@username.divine.video and username@divine.video formats

const DIVINE_APEX_DOMAINS = ['divine.video', 'dvine.video'];

/**
 * Check if a NIP-05 belongs to a divine.video subdomain.
 * Matches both formats:
 *   _@username.divine.video  (subdomain format)
 *   username@divine.video    (apex format)
 */
export function isDivineNip05(nip05: string): boolean {
  return getDivineNip05Info(nip05) !== null;
}

/**
 * Format a divine.video NIP-05 for display and linking.
 * Returns { displayName, href } or null if not a divine NIP-05.
 *
 * _@alice.divine.video → { displayName: '@alice.divine.video', href: 'https://alice.divine.video' }
 * alice@divine.video   → { displayName: '@alice.divine.video', href: 'https://alice.divine.video' }
 */
export function getDivineNip05Info(nip05: string): { displayName: string; href: string } | null {
  const atIndex = nip05.indexOf('@');
  if (atIndex === -1) return null;

  const localPart = nip05.slice(0, atIndex);
  const domain = nip05.slice(atIndex + 1);

  // Format: _@username.divine.video (subdomain format)
  if (localPart === '_') {
    for (const apex of DIVINE_APEX_DOMAINS) {
      if (domain.endsWith(`.${apex}`)) {
        const subdomain = domain.slice(0, -(apex.length + 1));
        if (subdomain && !subdomain.includes('.')) {
          return {
            displayName: `@${subdomain}.${apex}`,
            href: `https://${subdomain}.${apex}`,
          };
        }
      }
    }
    return null;
  }

  // Format: username@divine.video (apex format)
  for (const apex of DIVINE_APEX_DOMAINS) {
    if (domain === apex) {
      return {
        displayName: `@${localPart}.${apex}`,
        href: `https://${localPart}.${apex}`,
      };
    }
  }

  return null;
}
