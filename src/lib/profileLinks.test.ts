import { describe, expect, it } from 'vitest';
import { buildProfileLinkPath, normalizeNip05Identifier } from './profileLinks';

describe('normalizeNip05Identifier', () => {
  it('normalizes valid NIP-05 to lowercase', () => {
    expect(normalizeNip05Identifier(' Alice@Divine.Video ')).toBe('alice@divine.video');
  });

  it('returns null for invalid NIP-05 values', () => {
    expect(normalizeNip05Identifier('')).toBeNull();
    expect(normalizeNip05Identifier('alice')).toBeNull();
    expect(normalizeNip05Identifier('alice@')).toBeNull();
    expect(normalizeNip05Identifier('@divine.video')).toBeNull();
    expect(normalizeNip05Identifier('alice@divine@video')).toBeNull();
  });
});

describe('buildProfileLinkPath', () => {
  const pubkey = 'f'.repeat(64);
  const npub = 'npub1lllllllllllllllllllllllllllllllllllllllllllllllllllsq7lrjw';

  it('builds a NIP-05 route when metadata is available', () => {
    expect(buildProfileLinkPath({
      pubkey,
      nip05: '_@alice.divine.video',
    })).toBe('/u/_%40alice.divine.video');
  });

  it('falls back to root npub route by default', () => {
    expect(buildProfileLinkPath({ pubkey })).toBe(`/${npub}`);
  });

  it('uses /profile fallback route when requested', () => {
    expect(buildProfileLinkPath({
      pubkey,
      fallbackRoute: 'profile',
    })).toBe(`/profile/${npub}`);
  });

  it('preserves existing npub values without re-encoding', () => {
    expect(buildProfileLinkPath({ pubkey: npub })).toBe(`/${npub}`);
  });
});
