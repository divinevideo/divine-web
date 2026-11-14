import { nip19 } from 'nostr-tools';

export const NOSTR_REFERENCE_PATTERN = `(?:nostr:|\\b)(?:npub1|note1|nprofile1|nevent1|naddr1)[a-z0-9]+?(?=$|[^A-Za-z0-9_]|nostr:)`;

interface NostrReference {
  identifier: string;
  pubkey?: string;
  consumedLength: number;
}

function decodeReference(identifier: string): Omit<NostrReference, 'consumedLength'> | undefined {
  try {
    const decoded = nip19.decode(identifier);
    if (decoded.type === 'npub' || decoded.type === 'note') {
      if (!/^[0-9a-f]{64}$/i.test(decoded.data)) return undefined;
      return { identifier, pubkey: decoded.type === 'npub' ? decoded.data : undefined };
    }
    if (decoded.type === 'nprofile' || decoded.type === 'naddr') {
      if (!/^[0-9a-f]{64}$/i.test(decoded.data.pubkey)) return undefined;
      return { identifier, pubkey: decoded.type === 'nprofile' ? decoded.data.pubkey : undefined };
    }
    if (decoded.type === 'nevent' && /^[0-9a-f]{64}$/i.test(decoded.data.id)) {
      return { identifier };
    }
  } catch {
    return undefined;
  }
}

export function parseNostrReference(token: string): NostrReference | undefined {
  const prefixLength = /^nostr:/i.test(token) ? 6 : 0;
  const identifier = token.slice(prefixLength).toLowerCase();
  const complete = decodeReference(identifier);
  if (complete) return { ...complete, consumedLength: token.length };

  const fixedLength = /^(?:npub1|note1)/.test(identifier);
  const candidates = fixedLength
    ? (identifier.length > 63 ? [identifier.slice(0, 63)] : [])
    : Array.from({ length: Math.min(4, Math.max(0, identifier.length - 20)) }, (_, index) => identifier.slice(0, -index - 1));

  for (const candidate of candidates) {
    const decoded = decodeReference(candidate);
    if (decoded) return { ...decoded, consumedLength: prefixLength + candidate.length };
  }
  return undefined;
}
