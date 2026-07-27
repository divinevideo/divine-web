import { describe, expect, it } from 'vitest';
import {
  readLastKnownProtected,
  writeLastKnownProtected,
} from './protectedMinorStickyStore';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

describe('protectedMinorStickyStore', () => {
  it('returns null when nothing is stored', () => {
    expect(readLastKnownProtected('acct', fakeStorage())).toBeNull();
  });

  it('round-trips a definitive verdict', () => {
    const s = fakeStorage();
    writeLastKnownProtected('acct', 'protected', s);
    expect(readLastKnownProtected('acct', s)).toBe('protected');
    writeLastKnownProtected('acct', 'not_protected', s);
    expect(readLastKnownProtected('acct', s)).toBe('not_protected');
  });

  it('is keyed per account', () => {
    const s = fakeStorage();
    writeLastKnownProtected('minor', 'protected', s);
    expect(readLastKnownProtected('adult', s)).toBeNull();
  });

  it('ignores a garbage stored value', () => {
    const s = fakeStorage();
    s.setItem('protected_minor_sticky_acct', 'nonsense');
    expect(readLastKnownProtected('acct', s)).toBeNull();
  });
});
