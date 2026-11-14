import { nip19 } from 'nostr-tools';

export const NOSTR_REFERENCE_PATTERN = `(?:nostr:|\\b)(?:npub1|note1|nprofile1|nevent1|naddr1)[a-z0-9]+?(?=$|[^A-Za-z0-9_]|nostr:)`;

// Every prefix contains `1`, which bech32 never uses as a data character, so a
// prefix found inside a token always marks where the reference before it ends.
const REFERENCE_PREFIX = /npub1|note1|nprofile1|nevent1|naddr1/i;
const LEADING_REFERENCE_PREFIX = /^(?:npub1|note1|nprofile1|nevent1|naddr1)/i;

export interface NostrReference {
  identifier: string;
  pubkey?: string;
  /** Offset of the reference, including any `nostr:` prefix, within the parsed token. */
  start: number;
  /** Offset just past the reference within the parsed token. */
  end: number;
}

type DecodedReference = Pick<NostrReference, 'identifier' | 'pubkey'>;

function decodeReference(candidate: string): DecodedReference | undefined {
  // bech32 rejects mixed case; lowercasing first would hide that from nip19.decode.
  const identifier = candidate.toLowerCase();
  if (candidate !== identifier && candidate !== candidate.toUpperCase()) return undefined;
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

function parseLeadingReference(token: string): (DecodedReference & { length: number }) | undefined {
  const prefixLength = /^nostr:/i.test(token) ? 6 : 0;
  const body = token.slice(prefixLength);
  const nextPrefix = body.slice(1).search(REFERENCE_PREFIX);
  const bounded = nextPrefix === -1 ? body : body.slice(0, nextPrefix + 1);
  const complete = decodeReference(bounded);
  if (complete) return { ...complete, length: prefixLength + bounded.length };

  const fixedLength = /^(?:npub1|note1)/i.test(bounded);
  const candidates = fixedLength
    ? (bounded.length > 63 ? [bounded.slice(0, 63)] : [])
    : Array.from({ length: Math.min(4, Math.max(0, bounded.length - 20)) }, (_, index) => bounded.slice(0, -index - 1));

  for (const candidate of candidates) {
    const decoded = decodeReference(candidate);
    if (decoded) return { ...decoded, length: prefixLength + candidate.length };
  }
  return undefined;
}

/**
 * Parse the references at the start of a token matched by NOSTR_REFERENCE_PATTERN.
 * A reference glued directly onto the one before it is returned as its own entry;
 * any other trailing text is left unconsumed after the last entry's `end`.
 */
export function parseNostrReferences(token: string): NostrReference[] {
  const references: NostrReference[] = [];
  let start = 0;
  do {
    const reference = parseLeadingReference(token.slice(start));
    if (!reference) break;
    const { length, ...decoded } = reference;
    references.push({ ...decoded, start, end: start + length });
    start += length;
  } while (LEADING_REFERENCE_PREFIX.test(token.slice(start)));
  return references;
}
