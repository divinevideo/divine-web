import { nip19 } from 'nostr-tools';
import { VIDEO_KINDS } from '@/types/video';
import {
  buildAddressableRoute,
  buildEventPath,
  buildProfilePath as buildProfileRoute,
  buildResolvedEventRoute,
} from '@/lib/eventRouting';

const VIDEO_COORDINATE_PATTERN = /^(?:a:)?(?<kind>\d+):(?<pubkey>[0-9a-f]{64}):(?<identifier>.+)$/i;
const HEX_64_PATTERN = /^[0-9a-f]{64}$/i;
const OPAQUE_IDENTIFIER_PATTERN = /^[a-z0-9:_-]+$/i;

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

export function getDirectSearchTarget(value: string): DirectSearchTarget | null {
  const normalized = normalizeDirectSearchInput(value);
  if (!normalized) {
    return null;
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
        return {
          path: decoded.data.kind
            ? buildResolvedEventRoute({
              id: decoded.data.id,
              kind: decoded.data.kind,
              pubkey: decoded.data.author || '',
              tags: [],
            })
            : buildEventPath(decoded.data.id),
          entity: decoded.data.kind && VIDEO_KINDS.includes(decoded.data.kind as typeof VIDEO_KINDS[number])
            ? 'video'
            : 'event',
        };

      case 'naddr':
        return {
          path: buildAddressableRoute(decoded.data.kind, decoded.data.pubkey, decoded.data.identifier),
          entity: VIDEO_KINDS.includes(decoded.data.kind as typeof VIDEO_KINDS[number]) ? 'video' : 'event',
        };

      default:
        return null;
    }
  } catch {
    return null;
  }
}
