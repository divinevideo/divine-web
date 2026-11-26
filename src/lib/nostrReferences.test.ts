import { describe, expect, it } from 'vitest';
import { nip19 } from 'nostr-tools';

import { parseNostrReferences } from '@/lib/nostrReferences';

const PUBKEY = 'a'.repeat(64);
const NPUB = nip19.npubEncode(PUBKEY);
const NPROFILE = nip19.nprofileEncode({ pubkey: PUBKEY, relays: ['wss://relay.example.com'] });
const NOTE = nip19.noteEncode('c'.repeat(64));

describe('parseNostrReferences', () => {
  it('parses a complete reference and consumes its nostr: prefix', () => {
    expect(parseNostrReferences(`nostr:${NPUB}`)).toEqual([
      { identifier: NPUB, pubkey: PUBKEY, start: 0, end: 6 + NPUB.length },
    ]);
  });

  it('returns a pubkey for profile references only', () => {
    expect(parseNostrReferences(NPROFILE)).toEqual([
      { identifier: NPROFILE, pubkey: PUBKEY, start: 0, end: NPROFILE.length },
    ]);
    expect(parseNostrReferences(NOTE)).toEqual([
      { identifier: NOTE, start: 0, end: NOTE.length },
    ]);
  });

  it('leaves trailing text after a recovered reference unconsumed', () => {
    expect(parseNostrReferences(`${NPUB}hello`)).toEqual([
      { identifier: NPUB, pubkey: PUBKEY, start: 0, end: NPUB.length },
    ]);
  });

  it('recovers a variable-length reference from at most four trailing characters', () => {
    expect(parseNostrReferences(`${NPROFILE}ssss`)).toEqual([
      { identifier: NPROFILE, pubkey: PUBKEY, start: 0, end: NPROFILE.length },
    ]);
    expect(parseNostrReferences(`${NPROFILE}sssss`)).toEqual([]);
  });

  it('splits references glued without a separator', () => {
    const second = 6 + NPROFILE.length;
    expect(parseNostrReferences(`nostr:${NPROFILE}${NOTE}${NPUB}s`)).toEqual([
      { identifier: NPROFILE, pubkey: PUBKEY, start: 0, end: second },
      { identifier: NOTE, start: second, end: second + NOTE.length },
      { identifier: NPUB, pubkey: PUBKEY, start: second + NOTE.length, end: second + NOTE.length + NPUB.length },
    ]);
  });

  it('lowercases an uppercase identifier but rejects mixed case', () => {
    expect(parseNostrReferences(`NOSTR:${NPUB.toUpperCase()}`)).toEqual([
      { identifier: NPUB, pubkey: PUBKEY, start: 0, end: 6 + NPUB.length },
    ]);
    expect(parseNostrReferences(`${NPUB.slice(0, 10)}${NPUB.slice(10).toUpperCase()}`)).toEqual([]);
  });

  it('rejects identifiers whose payload is not a 32-byte id', () => {
    expect(parseNostrReferences(nip19.npubEncode('a'.repeat(40)))).toEqual([]);
    expect(parseNostrReferences(nip19.neventEncode({ id: 'a'.repeat(40) }))).toEqual([]);
  });
});
