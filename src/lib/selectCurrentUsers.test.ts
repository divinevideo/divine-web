import { describe, it, expect } from 'vitest';
import { selectCurrentUsers, isJwtResolving } from './selectCurrentUsers';

describe('selectCurrentUsers', () => {
  const manual = ['m1', 'm2'];

  it('returns manual logins when there is no hosted token', () => {
    expect(selectCurrentUsers({ hasToken: false, jwtUser: undefined, jwtError: false, manualUsers: manual }))
      .toEqual(manual);
  });

  it('returns the resolved JWT user, taking precedence over manual logins', () => {
    expect(selectCurrentUsers({ hasToken: true, jwtUser: 'jwt', jwtError: false, manualUsers: manual }))
      .toEqual(['jwt']);
  });

  it('falls back to manual logins when the JWT session failed', () => {
    expect(selectCurrentUsers({ hasToken: true, jwtUser: undefined, jwtError: true, manualUsers: manual }))
      .toEqual(manual);
  });

  it('returns none while the JWT session is still resolving (no identity flash)', () => {
    expect(selectCurrentUsers({ hasToken: true, jwtUser: undefined, jwtError: false, manualUsers: manual }))
      .toEqual([]);
  });

  it('returns none when the JWT failed and there is no manual login', () => {
    expect(selectCurrentUsers({ hasToken: true, jwtUser: undefined, jwtError: true, manualUsers: [] }))
      .toEqual([]);
  });
});

describe('isJwtResolving', () => {
  it('is false when there is no JWT signer', () => {
    expect(isJwtResolving({ hasSigner: false, jwtPubkey: undefined, jwtError: false })).toBe(false);
  });

  it('is true when a signer exists but pubkey not yet resolved and no error', () => {
    expect(isJwtResolving({ hasSigner: true, jwtPubkey: undefined, jwtError: false })).toBe(true);
  });

  it('is false once the pubkey has resolved', () => {
    expect(isJwtResolving({ hasSigner: true, jwtPubkey: 'abc', jwtError: false })).toBe(false);
  });

  it('is false once the session has errored', () => {
    expect(isJwtResolving({ hasSigner: true, jwtPubkey: undefined, jwtError: true })).toBe(false);
  });
});
