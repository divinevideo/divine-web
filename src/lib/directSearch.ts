import { nip19 } from 'nostr-tools';
import { VIDEO_KINDS } from '@/types/video';
import {
  buildAddressableRoute,
  buildEventPath,
  buildProfilePath as buildProfileRoute,
  buildVideoPath,
  buildResolvedEventRoute,
} from '@/lib/eventRouting';

const VIDEO_COORDINATE_PATTERN = /^(?:a:)?(?<kind>\d+):(?<pubkey>[0-9a-f]{64}):(?<identifier>.+)$/i;
const HEX_64_PATTERN = /^[0-9a-f]{64}$/i;
const OPAQUE_IDENTIFIER_PATTERN = /^[a-z0-9:_-]+$/i;
const VINE_USER_ID_PATTERN = /^\d{15,20}$/;
const VINE_HOSTNAME_PATTERN = /(^|\.)vine\.co$/i;
const VINE_RESERVED_PATHS = new Set([
  'about',
  'explore',
  'help',
  'login',
  'messages',
  'privacy',
  'search',
  'settings',
  'u',
  'v',
  'terms',
]);

export interface DirectSearchTarget {
  path: string;
  entity: 'event' | 'profile' | 'video';
}

export function normalizeDirectSearchInput(value: string): string {
  return value
    .trim()
    .replace(/^(?:web\+)?nostr:/i, '')
    .trim();
}

export function buildProfilePath(identifier: string): string {
  return buildProfileRoute(identifier);
}

export function isHexIdentifier(value: string): boolean {
  return HEX_64_PATTERN.test(normalizeDirectSearchInput(value));
}

export function isLikelyOpaqueVideoIdentifier(value: string, allowShortTokens = false): boolean {
  const normalized = normalizeDirectSearchInput(value);

  if (!normalized || normalized.startsWith('#') || /\s/.test(normalized)) {
    return false;
  }

  if (getDirectSearchTarget(normalized)) {
    return false;
  }

  if (isHexIdentifier(normalized)) {
    return true;
  }

  if (!OPAQUE_IDENTIFIER_PATTERN.test(normalized)) {
    return false;
  }

  return allowShortTokens || normalized.length >= 16;
}

function withRelayHints(path: string, relayHints?: string[]): string {
  if (!path.startsWith('/event') || !relayHints?.length) {
    return path;
  }

  const params = new URLSearchParams();
  params.set('relays', relayHints.join(','));
  return `${path}?${params.toString()}`;
}

function parseHttpUrl(value: string): URL | null {
  const trimmed = value.trim();
  const candidates = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? [trimmed]
    : [`https://${trimmed}`];

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function isVineHostname(hostname: string): boolean {
  return VINE_HOSTNAME_PATTERN.test(hostname);
}

function getVineDirectTarget(value: string): DirectSearchTarget | null {
  const normalized = normalizeDirectSearchInput(value);
  if (!normalized) {
    return null;
  }

  if (VINE_USER_ID_PATTERN.test(normalized)) {
    return {
      path: `/u/${normalized}`,
      entity: 'profile',
    };
  }

  const url = parseHttpUrl(normalized);
  if (!url || !isVineHostname(url.hostname)) {
    return null;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  if (segments[0] === 'v' && segments.length === 2) {
    return {
      path: buildVideoPath(segments[1]),
      entity: 'video',
    };
  }

  if (segments[0] === 'u' && segments.length === 2) {
    if (!VINE_USER_ID_PATTERN.test(segments[1])) {
      return null;
    }
    return {
      path: `/u/${segments[1]}`,
      entity: 'profile',
    };
  }

  if (segments.length === 1 && !VINE_RESERVED_PATHS.has(segments[0].toLowerCase())) {
    return {
      path: `/u/${segments[0]}`,
      entity: 'profile',
    };
  }

  return null;
}

export function getDirectSearchTarget(value: string): DirectSearchTarget | null {
  const normalized = normalizeDirectSearchInput(value);
  if (!normalized) {
    return null;
  }

  const vineTarget = getVineDirectTarget(normalized);
  if (vineTarget) {
    return vineTarget;
  }

  const coordinateMatch = normalized.match(VIDEO_COORDINATE_PATTERN);
  if (coordinateMatch?.groups) {
    const kind = Number(coordinateMatch.groups.kind);
    const path = buildAddressableRoute(
      kind,
      coordinateMatch.groups.pubkey,
      coordinateMatch.groups.identifier,
    );

    return {
      path,
      entity: VIDEO_KINDS.includes(kind as typeof VIDEO_KINDS[number]) ? 'video' : 'event',
    };
  }

  try {
    const decoded = nip19.decode(normalized);

    switch (decoded.type) {
      case 'npub':
        return {
          path: buildProfilePath(normalized),
          entity: 'profile',
        };

      case 'nprofile':
        return {
          path: buildProfilePath(nip19.npubEncode(decoded.data.pubkey)),
          entity: 'profile',
        };

      case 'note':
        return {
          path: buildEventPath(decoded.data),
          entity: 'event',
        };

      case 'nevent':
        {
          const path = decoded.data.kind
            ? buildResolvedEventRoute({
              id: decoded.data.id,
              kind: decoded.data.kind,
              pubkey: decoded.data.author || '',
              tags: [],
            })
            : buildEventPath(decoded.data.id);

        return {
          path: withRelayHints(path, decoded.data.relays),
          entity: decoded.data.kind && VIDEO_KINDS.includes(decoded.data.kind as typeof VIDEO_KINDS[number])
            ? 'video'
            : 'event',
        };
        }

      case 'naddr':
        {
          const path = buildAddressableRoute(decoded.data.kind, decoded.data.pubkey, decoded.data.identifier);
        return {
          path: withRelayHints(path, decoded.data.relays),
          entity: VIDEO_KINDS.includes(decoded.data.kind as typeof VIDEO_KINDS[number]) ? 'video' : 'event',
        };
        }

      default:
        return null;
    }
  } catch {
    return null;
  }
}
