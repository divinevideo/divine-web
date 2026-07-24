// ABOUTME: Tests for parsing the showcase curation list configuration
// ABOUTME: pubkey:dTag entries, hex validation, dedupe

import { describe, it, expect } from 'vitest';
import { parseCurationLists } from './curation';

const PK_A = 'a'.repeat(64);
const PK_B = 'b'.repeat(64);

describe('parseCurationLists', () => {
  it('returns nothing for empty or undefined input', () => {
    expect(parseCurationLists(undefined)).toEqual([]);
    expect(parseCurationLists('')).toEqual([]);
    expect(parseCurationLists('   ')).toEqual([]);
  });

  it('parses a single pubkey:dTag entry', () => {
    expect(parseCurationLists(`${PK_A}:list_123`)).toEqual([
      { pubkey: PK_A, dTag: 'list_123' },
    ]);
  });

  it('parses multiple comma-separated entries', () => {
    expect(parseCurationLists(`${PK_A}:list_1, ${PK_B}:list_2`)).toEqual([
      { pubkey: PK_A, dTag: 'list_1' },
      { pubkey: PK_B, dTag: 'list_2' },
    ]);
  });

  it('lowercases the pubkey', () => {
    expect(parseCurationLists(`${PK_A.toUpperCase()}:list_1`)).toEqual([
      { pubkey: PK_A, dTag: 'list_1' },
    ]);
  });

  it('rejects entries with a non-hex or wrong-length pubkey', () => {
    expect(parseCurationLists('nothex:list_1')).toEqual([]);
    expect(parseCurationLists('abc:list_1')).toEqual([]);
  });

  it('rejects entries with no d tag', () => {
    expect(parseCurationLists(`${PK_A}:`)).toEqual([]);
    expect(parseCurationLists(PK_A)).toEqual([]);
  });

  it('dedupes identical coordinates', () => {
    expect(parseCurationLists(`${PK_A}:list_1, ${PK_A}:list_1`)).toEqual([
      { pubkey: PK_A, dTag: 'list_1' },
    ]);
  });
});
