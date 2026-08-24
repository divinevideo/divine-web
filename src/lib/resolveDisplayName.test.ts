import { describe, expect, it } from 'vitest';

import { genUserName } from '@/lib/genUserName';
import { resolveDisplayName } from '@/lib/resolveDisplayName';

const PUBKEY = 'a'.repeat(64);

describe('resolveDisplayName', () => {
  it('prefers display_name when both fields are set', () => {
    expect(resolveDisplayName({ display_name: 'Display Name', name: 'handle' }, PUBKEY))
      .toBe('Display Name');
  });

  it('uses name when display_name is absent', () => {
    expect(resolveDisplayName({ name: 'handle' }, PUBKEY)).toBe('handle');
  });

  it('generates a name when name is empty and display_name is absent', () => {
    expect(resolveDisplayName({ name: '' }, PUBKEY)).toBe(genUserName(PUBKEY));
  });

  it('generates a name when name contains only whitespace', () => {
    expect(resolveDisplayName({ name: '   ' }, PUBKEY)).toBe(genUserName(PUBKEY));
  });

  it('uses display_name when name is empty', () => {
    expect(resolveDisplayName({ display_name: 'Visible Name', name: '' }, PUBKEY))
      .toBe('Visible Name');
  });

  it('generates a name when metadata is absent', () => {
    expect(resolveDisplayName(undefined, PUBKEY)).toBe(genUserName(PUBKEY));
  });

  it.each([
    undefined,
    {},
    { name: '' },
    { display_name: '' },
    { name: '  ', display_name: '  ' },
  ])('never returns an empty string for metadata %j', (metadata) => {
    expect(resolveDisplayName(metadata, PUBKEY)).not.toBe('');
  });
});
