import { describe, expect, it } from 'vitest';
import { genUserName } from './genUserName';
import { generateUsername } from './generateProfile';
import { adjectives, animals } from './generatedNameDictionaries';

describe('genUserName', () => {
  it('matches mobile pinned output for issue #2979 pubkey', () => {
    expect(
      genUserName('89ef92b9ebe6dc1e4ea398f6477f227e95429627b0a33dc89b640e137b256be5')
    ).toBe('Possible Mandrill 76');
  });

  it('matches mobile pinned output for test pubkey', () => {
    expect(
      genUserName('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')
    ).toBe('Integral Cicada 66');
  });

  it('matches mobile output for short pubkey', () => {
    expect(genUserName('short123')).toBe('Olympic Rodent 91');
  });

  it('uses stable dictionary sizes', () => {
    expect(adjectives).toHaveLength(1202);
    expect(animals).toHaveLength(354);
  });

  it('delegates generateUsername to the same algorithm', () => {
    const pubkey = '89ef92b9ebe6dc1e4ea398f6477f227e95429627b0a33dc89b640e137b256be5';
    expect(generateUsername(pubkey)).toBe(genUserName(pubkey));
  });
});
