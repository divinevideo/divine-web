import { nip19 } from 'nostr-tools';

const HEX_PUBKEY_PATTERN = /^[0-9a-f]{64}$/i;
const DEFAULT_APEX_DOMAIN = 'divine.video';
const ALTERNATE_APEX_DOMAIN = 'dvine.video';
const APEX_DOMAINS = [DEFAULT_APEX_DOMAIN, ALTERNATE_APEX_DOMAIN] as const;

export type ProfileFallbackRoute = 'root' | 'profile';

interface BuildProfileLinkPathInput {
  pubkey: string;
  nip05?: string | null;
  fallbackRoute?: ProfileFallbackRoute;
}

/**
 * Build a human-friendly URL path for a profile.
 *
 * Order of preference:
 * 1. Bare local part on the default apex — `/u/jacky` (from `_@jacky.divine.video`
 *    or `jacky@divine.video`).
 * 2. Friendly multi-segment form for everything else — `/u/jacky.dvine.video` or
 *    `/u/alice.primal.net`. Replaces `@` with `.` and strips a leading `_` so the
 *    path needs no percent-encoding.
 * 3. Npub fallback (`/{npub}` or `/profile/{npub}`) when the NIP-05 is missing or
 *    malformed.
 */
export function buildProfileLinkPath({
  pubkey,
  nip05,
  fallbackRoute = 'root',
}: BuildProfileLinkPathInput): string {
  const friendly = toFriendlyPath(nip05);
  if (friendly) {
    const bareName = bareLocalFromFriendly(friendly);
    if (bareName) {
      return `/u/${bareName}`;
    }
    return `/u/${friendly}`;
  }

  const npub = toNpub(pubkey);
  return fallbackRoute === 'profile' ? `/profile/${npub}` : `/${npub}`;
}

function bareLocalFromFriendly(friendly: string): string | null {
  for (const apex of APEX_DOMAINS) {
    const suffix = `.${apex}`;
    if (friendly === apex) return null;
    if (friendly.endsWith(suffix)) {
      const local = friendly.slice(0, -suffix.length);
      if (local && !local.includes('.') && apex === DEFAULT_APEX_DOMAIN) {
        return local;
      }
    }
  }
  return null;
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

/**
 * Convert a NIP-05 identifier to a single URL-safe path segment.
 *
 *   _@jacky.divine.video   -> 'jacky.divine.video'   (then bare-name form collapses it)
 *   jacky@divine.video     -> 'jacky.divine.video'
 *   _@jacky.dvine.video    -> 'jacky.dvine.video'
 *   _@alice.primal.net     -> 'alice.primal.net'
 *   alice@primal.net       -> 'alice.primal.net'
 *   _@divine.video         -> 'divine.video'         (degenerate but unambiguous)
 *   malformed / no @       -> null
 *
 * The leading `_` (NIP-05 self-name) is dropped from the local part. `@` is replaced
 * with `.`. The result is always lowercase, ASCII, and safe to use in a URL without
 * encoding.
 */
export function toFriendlyPath(nip05: string | null | undefined): string | null {
  const normalized = nip05?.trim().toLowerCase() ?? '';
  if (!normalized) return null;

  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) return null;
  if (normalized.indexOf('@') !== atIndex) return null;

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);

  if (!/^[a-z0-9.-]+$/.test(domain)) return null;

  const cleanLocal = local === '_' ? '' : local;
  if (cleanLocal && !/^[a-z0-9._-]+$/.test(cleanLocal)) return null;

  if (!cleanLocal) return domain;
  return `${cleanLocal}.${domain}`;
}

/**
 * Inverse of {@link buildProfileLinkPath} for the friendly-path branch.
 *
 * Given a URL segment from `/u/:userId`, return the canonical NIP-05 strings we
 * should try to match against a kind-0 profile's `nip05` field (or resolve via
 * NIP-05 DNS). Always returns lowercased forms.
 *
 *   'jacky'                      -> ['jacky@divine.video', '_@jacky.divine.video']
 *   'jacky.divine.video'         -> ['jacky@divine.video', '_@jacky.divine.video']
 *   'jacky.dvine.video'          -> ['jacky@dvine.video',  '_@jacky.dvine.video']
 *   'a.b.divine.video'           -> ['a.b@divine.video',   '_@a.b.divine.video']
 *   'alice.primal.net'           -> ['alice.primal.net', 'alice@primal.net', '_@alice.primal.net']
 *   'jacky.divine.video'         (third-party case)       -> ['jacky.divine.video']
 *
 * Returns an empty array for inputs that can't be interpreted as a NIP-05.
 */
export function nip05CandidatesFromUrlSegment(segment: string): string[] {
  const decoded = decodeURIComponent(segment).trim().toLowerCase();
  if (!decoded) return [];

  // 1. Literal NIP-05 — has '@'.
  if (decoded.includes('@')) {
    return [decoded];
  }

  // 2. Multi-dot path with a recognized apex suffix — split into local + domain.
  if (decoded.includes('.')) {
    for (const apex of APEX_DOMAINS) {
      const suffix = `.${apex}`;
      if (decoded.endsWith(suffix)) {
        const local = decoded.slice(0, -suffix.length);
        if (local && !local.includes('@')) {
          return [
            `${local}@${apex}`,
            `_@${local}.${apex}`,
          ];
        }
      }
    }
    // Third-party domain — keep the literal for older friendly metadata, then
    // try every split whose domain side still looks domain-shaped.
    return [
      decoded,
      ...thirdPartyNip05Candidates(decoded),
      `_@${decoded}`,
    ];
  }

  // 3. Bare local part — assume the default apex.
  return [
    `${decoded}@${DEFAULT_APEX_DOMAIN}`,
    `_@${decoded}.${DEFAULT_APEX_DOMAIN}`,
  ];
}

function thirdPartyNip05Candidates(decoded: string): string[] {
  const candidates: string[] = [];
  for (let index = decoded.indexOf('.'); index > 0; index = decoded.indexOf('.', index + 1)) {
    const local = decoded.slice(0, index);
    const domain = decoded.slice(index + 1);
    if (domain.includes('.')) {
      candidates.push(`${local}@${domain}`);
    }
  }
  return candidates;
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
