import { describe, expect, it } from 'vitest';
import {
  buildProfileLinkPath,
  nip05CandidatesFromUrlSegment,
  normalizeNip05Identifier,
  toFriendlyPath,
} from './profileLinks';

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

describe('toFriendlyPath', () => {
  it('drops the leading _ on the default apex', () => {
    expect(toFriendlyPath('_@alice.divine.video')).toBe('alice.divine.video');
    expect(toFriendlyPath('alice@divine.video')).toBe('alice.divine.video');
  });

  it('drops the leading _ on the alternate apex', () => {
    expect(toFriendlyPath('_@alice.dvine.video')).toBe('alice.dvine.video');
    expect(toFriendlyPath('alice@dvine.video')).toBe('alice.dvine.video');
  });

  it('keeps the apex for third-party NIP-05s', () => {
    expect(toFriendlyPath('_@alice.primal.net')).toBe('alice.primal.net');
    expect(toFriendlyPath('alice@primal.net')).toBe('alice.primal.net');
  });

  it('handles a degenerate _@apex by collapsing to the apex itself', () => {
    expect(toFriendlyPath('_@divine.video')).toBe('divine.video');
  });

  it('lowercases the result', () => {
    expect(toFriendlyPath('_@Alice.Divine.Video')).toBe('alice.divine.video');
  });

  it('returns null for malformed inputs', () => {
    expect(toFriendlyPath(null)).toBeNull();
    expect(toFriendlyPath(undefined)).toBeNull();
    expect(toFriendlyPath('')).toBeNull();
    expect(toFriendlyPath('   ')).toBeNull();
    expect(toFriendlyPath('alice')).toBeNull();
    expect(toFriendlyPath('alice@')).toBeNull();
    expect(toFriendlyPath('@divine.video')).toBeNull();
    expect(toFriendlyPath('alice@divine@video')).toBeNull();
    expect(toFriendlyPath('alice@bad domain')).toBeNull();
  });
});

describe('buildProfileLinkPath', () => {
  const pubkey = 'f'.repeat(64);
  const npub = 'npub1lllllllllllllllllllllllllllllllllllllllllllllllllllsq7lrjw';

  it('uses the bare-name form on the default apex', () => {
    expect(buildProfileLinkPath({
      pubkey,
      nip05: '_@alice.divine.video',
    })).toBe('/u/alice');
  });

  it('uses the bare-name form even when the NIP-05 omits the underscore', () => {
    expect(buildProfileLinkPath({
      pubkey,
      nip05: 'alice@divine.video',
    })).toBe('/u/alice');
  });

  it('keeps the alternate apex in the path', () => {
    expect(buildProfileLinkPath({
      pubkey,
      nip05: '_@alice.dvine.video',
    })).toBe('/u/alice.dvine.video');
  });

  it('uses the friendly form for third-party NIP-05s', () => {
    expect(buildProfileLinkPath({
      pubkey,
      nip05: 'alice@primal.net',
    })).toBe('/u/alice.primal.net');
  });

  it('falls back to the root npub route when the NIP-05 is missing', () => {
    expect(buildProfileLinkPath({ pubkey })).toBe(`/${npub}`);
  });

  it('falls back to the root npub route when the NIP-05 is malformed', () => {
    expect(buildProfileLinkPath({ pubkey, nip05: 'no-at-sign' })).toBe(`/${npub}`);
  });

  it('uses the /profile fallback route when requested', () => {
    expect(buildProfileLinkPath({
      pubkey,
      fallbackRoute: 'profile',
    })).toBe(`/profile/${npub}`);
  });

  it('preserves existing npub values without re-encoding', () => {
    expect(buildProfileLinkPath({ pubkey: npub })).toBe(`/${npub}`);
  });
});

describe('nip05CandidatesFromUrlSegment', () => {
  it('treats a bare local part as the default apex', () => {
    expect(nip05CandidatesFromUrlSegment('jacky')).toEqual([
      'jacky@divine.video',
      '_@jacky.divine.video',
    ]);
  });

  it('expands an explicit default-apex segment to both NIP-05 forms', () => {
    expect(nip05CandidatesFromUrlSegment('jacky.divine.video')).toEqual([
      'jacky@divine.video',
      '_@jacky.divine.video',
    ]);
  });

  it('expands an alternate-apex segment', () => {
    expect(nip05CandidatesFromUrlSegment('jacky.dvine.video')).toEqual([
      'jacky@dvine.video',
      '_@jacky.dvine.video',
    ]);
  });

  it('expands a deeply-nested segment under a known apex', () => {
    expect(nip05CandidatesFromUrlSegment('a.b.divine.video')).toEqual([
      'a.b@divine.video',
      '_@a.b.divine.video',
    ]);
  });

  it('passes a third-party segment through unchanged', () => {
    expect(nip05CandidatesFromUrlSegment('alice.primal.net')).toEqual([
      'alice.primal.net',
    ]);
  });

  it('passes a literal NIP-05 through unchanged', () => {
    expect(nip05CandidatesFromUrlSegment('alice%40primal.net')).toEqual([
      'alice%40primal.net',
    ]);
  });

  it('lowercases the segment before processing', () => {
    expect(nip05CandidatesFromUrlSegment('JACKY.DIVINE.VIDEO')).toEqual([
      'jacky@divine.video',
      '_@jacky.divine.video',
    ]);
  });

  it('returns an empty list for empty / whitespace input', () => {
    expect(nip05CandidatesFromUrlSegment('')).toEqual([]);
    expect(nip05CandidatesFromUrlSegment('   ')).toEqual([]);
  });
});
