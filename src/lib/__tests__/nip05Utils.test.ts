// ABOUTME: Tests for divine.video NIP-05 utility functions

import { describe, it, expect } from 'vitest';
import { isDivineNip05, getDivineNip05Info } from '../nip05Utils';

describe('isDivineNip05', () => {
  it('returns true for _@username.divine.video', () => {
    expect(isDivineNip05('_@alice.divine.video')).toBe(true);
  });

  it('returns true for username@divine.video', () => {
    expect(isDivineNip05('alice@divine.video')).toBe(true);
  });

  it('returns true for _@username.dvine.video', () => {
    expect(isDivineNip05('_@alice.dvine.video')).toBe(true);
  });

  it('returns true for username@dvine.video', () => {
    expect(isDivineNip05('alice@dvine.video')).toBe(true);
  });

  it('returns false for non-divine NIP-05', () => {
    expect(isDivineNip05('user@example.com')).toBe(false);
  });

  it('returns false for _@example.com', () => {
    expect(isDivineNip05('_@example.com')).toBe(false);
  });

  it('returns false for string without @', () => {
    expect(isDivineNip05('nodomain')).toBe(false);
  });
});

describe('getDivineNip05Info', () => {
  it('formats _@alice.divine.video correctly', () => {
    const result = getDivineNip05Info('_@alice.divine.video');
    expect(result).toEqual({
      displayName: '@alice.divine.video',
      href: 'https://alice.divine.video',
    });
  });

  it('formats alice@divine.video correctly', () => {
    const result = getDivineNip05Info('alice@divine.video');
    expect(result).toEqual({
      displayName: '@alice.divine.video',
      href: 'https://alice.divine.video',
    });
  });

  it('formats _@alice.dvine.video correctly', () => {
    const result = getDivineNip05Info('_@alice.dvine.video');
    expect(result).toEqual({
      displayName: '@alice.dvine.video',
      href: 'https://alice.dvine.video',
    });
  });

  it('formats alice@dvine.video correctly', () => {
    const result = getDivineNip05Info('alice@dvine.video');
    expect(result).toEqual({
      displayName: '@alice.dvine.video',
      href: 'https://alice.dvine.video',
    });
  });

  it('returns null for non-divine NIP-05', () => {
    expect(getDivineNip05Info('user@example.com')).toBeNull();
  });

  it('returns null for string without @', () => {
    expect(getDivineNip05Info('nodomain')).toBeNull();
  });

  it('returns null for _@ on non-divine subdomain', () => {
    expect(getDivineNip05Info('_@sub.example.com')).toBeNull();
  });

  it('returns null for _@divine.video (no subdomain)', () => {
    expect(getDivineNip05Info('_@divine.video')).toBeNull();
  });

  it('returns null for nested subdomains like _@a.b.divine.video', () => {
    expect(getDivineNip05Info('_@a.b.divine.video')).toBeNull();
  });
});
