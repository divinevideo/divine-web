// ABOUTME: Unit tests for Nostr addressable coordinate helpers

import { describe, expect, it } from 'vitest';

import {
  buildAddressableCoordinate,
  isHex64,
  parseAddressableCoordinate,
} from './nostrCoordinates';

const PUBKEY = 'a'.repeat(64);

describe('buildAddressableCoordinate', () => {
  it('builds canonical NIP-01 addressable coordinates', () => {
    expect(buildAddressableCoordinate(30000, PUBKEY, 'team')).toBe(`30000:${PUBKEY}:team`);
  });
});

describe('parseAddressableCoordinate', () => {
  it('parses canonical addressable coordinates', () => {
    expect(parseAddressableCoordinate(`30000:${PUBKEY}:team`)).toEqual({
      kind: 30000,
      pubkey: PUBKEY,
      dTag: 'team',
    });
  });

  it('keeps colons inside the d tag', () => {
    expect(parseAddressableCoordinate(`30005:${PUBKEY}:team:2026:q3`)).toEqual({
      kind: 30005,
      pubkey: PUBKEY,
      dTag: 'team:2026:q3',
    });
  });

  it('rejects empty d tags', () => {
    expect(parseAddressableCoordinate(`30000:${PUBKEY}:`)).toBeNull();
  });

  it('rejects invalid kinds', () => {
    expect(parseAddressableCoordinate(`:${PUBKEY}:team`)).toBeNull();
    expect(parseAddressableCoordinate(`kind:${PUBKEY}:team`)).toBeNull();
    expect(parseAddressableCoordinate(`30000.5:${PUBKEY}:team`)).toBeNull();
    expect(parseAddressableCoordinate(`-1:${PUBKEY}:team`)).toBeNull();
  });

  it('rejects invalid pubkeys', () => {
    expect(parseAddressableCoordinate('30000:not-a-pubkey:team')).toBeNull();
  });
});

describe('isHex64', () => {
  it('matches 64-character hex strings only', () => {
    expect(isHex64(PUBKEY)).toBe(true);
    expect(isHex64('g'.repeat(64))).toBe(false);
    expect(isHex64('a'.repeat(63))).toBe(false);
  });
});
