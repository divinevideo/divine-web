import { nip19 } from 'nostr-tools';
import { VIDEO_KINDS } from '@/types/video';

const VIDEO_COORDINATE_PATTERN = /^(?:a:)?(?<kind>\d+):(?<pubkey>[0-9a-f]{64}):(?<identifier>.+)$/i;
const HEX_64_PATTERN = /^[0-9a-f]{64}$/i;
const OPAQUE_IDENTIFIER_PATTERN = /^[a-z0-9:_-]+$/i;

export interface DirectSearchTarget {
  path: string;
  entity: 'profile' | 'video';
}

export function normalizeDirectSearchInput(value: string): string {
  return value
    .trim()
    .replace(/^(?:web\+)?nostr:/i, '')
    .trim();
}

export function buildProfilePath(identifier: string): string {
  return `/profile/${identifier}`;
}

export function buildVideoPath(identifier: string): string {
  return `/video/${encodeURIComponent(identifier)}`;
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
    if (VIDEO_KINDS.includes(kind as typeof VIDEO_KINDS[number])) {
      return {
        path: buildVideoPath(coordinateMatch.groups.identifier),
        entity: 'video',
      };
    }
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
          path: buildVideoPath(decoded.data),
          entity: 'video',
        };

      case 'nevent':
        return {
          path: buildVideoPath(decoded.data.id),
          entity: 'video',
        };

      case 'naddr':
        if (VIDEO_KINDS.includes(decoded.data.kind as typeof VIDEO_KINDS[number])) {
          return {
            path: buildVideoPath(decoded.data.identifier),
            entity: 'video',
          };
        }
        return null;

      default:
        return null;
    }
  } catch {
    return null;
  }
}
