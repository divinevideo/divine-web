// ABOUTME: Tests for showcase creator name resolution
// ABOUTME: The display_name-first order is the fix for the generic-username bug

import { describe, it, expect } from 'vitest';
import { resolveDisplayName } from './showcaseDisplayName';
import { genUserName } from './genUserName';

const PUBKEY = 'a'.repeat(64);

describe('resolveDisplayName', () => {
  it('prefers display_name', () => {
    expect(resolveDisplayName({ display_name: 'Lele Pons', name: 'lelepons' }, PUBKEY)).toBe('Lele Pons');
  });

  // The exact bug: name is empty, the real name is only in display_name.
  it('uses display_name when name is empty', () => {
    expect(resolveDisplayName({ display_name: 'Vladimira | Nafidha', name: '' }, PUBKEY)).toBe(
      'Vladimira | Nafidha',
    );
  });

  it('falls back to name when there is no display_name', () => {
    expect(resolveDisplayName({ name: 'AC555' }, PUBKEY)).toBe('AC555');
  });

  it('skips whitespace-only values', () => {
    expect(resolveDisplayName({ display_name: '   ', name: 'realname' }, PUBKEY)).toBe('realname');
  });

  it('uses the cached name before the generic fallback', () => {
    expect(resolveDisplayName(undefined, PUBKEY, 'CachedName')).toBe('CachedName');
  });

  it('falls back to a deterministic generic name when nothing else exists', () => {
    expect(resolveDisplayName(undefined, PUBKEY)).toBe(genUserName(PUBKEY));
    expect(resolveDisplayName({ name: '', display_name: '' }, PUBKEY)).toBe(genUserName(PUBKEY));
  });
});
