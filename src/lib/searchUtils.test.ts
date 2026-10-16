import { describe, it, expect } from 'vitest';
import { nip19 } from 'nostr-tools';
import { SYNTHETIC_NSEC } from '@/test/secretKeyFixture';
import { isUrlLikeQuery, looksLikeSecretKey } from './searchUtils';

describe('isUrlLikeQuery', () => {
  it('detects http URLs', () => {
    expect(isUrlLikeQuery('http://example.com')).toBe(true);
  });

  it('detects https URLs', () => {
    expect(isUrlLikeQuery('https://vine.co/v/hAgW0mP5zKL//')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isUrlLikeQuery('HTTPS://VINE.CO')).toBe(true);
    expect(isUrlLikeQuery('Http://Example.com')).toBe(true);
  });

  it('handles leading/trailing whitespace', () => {
    expect(isUrlLikeQuery('  https://vine.co  ')).toBe(true);
  });

  it('rejects normal search terms', () => {
    expect(isUrlLikeQuery('funny cats')).toBe(false);
  });

  it('rejects hashtags', () => {
    expect(isUrlLikeQuery('#divine')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isUrlLikeQuery('')).toBe(false);
  });

  it('rejects strings that contain URLs but do not start with them', () => {
    expect(isUrlLikeQuery('check out https://vine.co')).toBe(false);
  });

  it('detects bare hostname with path (scheme-less Vine URL)', () => {
    expect(isUrlLikeQuery('vine.co/v/hAgW0mP5zKL')).toBe(true);
    expect(isUrlLikeQuery('vine.co/v/hAgW0mP5zKL//')).toBe(true);
  });

  it('detects other bare hostname URLs with paths', () => {
    expect(isUrlLikeQuery('example.com/page')).toBe(true);
    expect(isUrlLikeQuery('sub.domain.co.uk/path')).toBe(true);
  });

  it('rejects bare hostnames without a path', () => {
    expect(isUrlLikeQuery('vine.co')).toBe(false);
    expect(isUrlLikeQuery('example.com')).toBe(false);
  });

  it('rejects dotted words that are not URLs', () => {
    expect(isUrlLikeQuery('funny.cats')).toBe(false);
    expect(isUrlLikeQuery('music.video')).toBe(false);
  });
});

describe('looksLikeSecretKey', () => {
  it('matches a whole nsec', () => {
    expect(looksLikeSecretKey(SYNTHETIC_NSEC)).toBe(true);
  });

  it('matches regardless of case', () => {
    expect(looksLikeSecretKey(SYNTHETIC_NSEC.toUpperCase())).toBe(true);
    expect(looksLikeSecretKey(`Nsec1${SYNTHETIC_NSEC.slice(5)}`)).toBe(true);
  });

  it('matches an nsec among other words', () => {
    expect(looksLikeSecretKey(`my key ${SYNTHETIC_NSEC} thanks`)).toBe(true);
    expect(looksLikeSecretKey(`nostr:${SYNTHETIC_NSEC}`)).toBe(true);
    expect(looksLikeSecretKey(`key=${SYNTHETIC_NSEC}`)).toBe(true);
  });

  it('matches part of an nsec, as typed or pasted', () => {
    expect(looksLikeSecretKey(SYNTHETIC_NSEC.slice(0, 20))).toBe(true);
    expect(looksLikeSecretKey('nsec1')).toBe(true);
  });

  it('leaves ordinary searches alone', () => {
    expect(looksLikeSecretKey('funny cats')).toBe(false);
    expect(looksLikeSecretKey('nsec')).toBe(false);
    expect(looksLikeSecretKey('insecure')).toBe(false);
    expect(looksLikeSecretKey('nsec 1')).toBe(false);
    expect(looksLikeSecretKey('#nostr')).toBe(false);
    expect(looksLikeSecretKey('')).toBe(false);
  });

  it('leaves public identifiers alone', () => {
    expect(looksLikeSecretKey(nip19.npubEncode('f'.repeat(64)))).toBe(false);
    expect(looksLikeSecretKey(nip19.noteEncode('e'.repeat(64)))).toBe(false);
    expect(looksLikeSecretKey(nip19.neventEncode({ id: 'e'.repeat(64), relays: ['wss://relay.example'] }))).toBe(false);
    expect(looksLikeSecretKey(nip19.naddrEncode({ kind: 34236, pubkey: 'f'.repeat(64), identifier: 'clip-7' }))).toBe(false);
    expect(looksLikeSecretKey('a'.repeat(64))).toBe(false);
  });
});
