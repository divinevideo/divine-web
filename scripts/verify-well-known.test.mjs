import { describe, expect, it } from 'vitest';

import {
  componentPatternMatchesPath,
  declaredComponentsClaimExit,
} from './verify-well-known.mjs';

describe('verify-well-known universal link guard', () => {
  it('matches Apple AASA wildcard paths', () => {
    expect(componentPatternMatchesPath('/profile/*', '/profile/npub1example')).toBe(true);
    expect(componentPatternMatchesPath('/profile/*', '/video/abc')).toBe(false);
  });

  it('rejects broad patterns that claim the exit route', () => {
    expect(declaredComponentsClaimExit(new Set(['/video/*', '/profile/*', '/invite/*', '/list/*']))).toBe(false);
    expect(declaredComponentsClaimExit(new Set(['/video/*', '/*']))).toBe(true);
    expect(declaredComponentsClaimExit(new Set(['/video/*', '/e*']))).toBe(true);
    expect(declaredComponentsClaimExit(new Set(['/video/*', '/exit/*']))).toBe(true);
  });

  it('respects ordered exclusions', () => {
    expect(declaredComponentsClaimExit([
      { '/': '/exit*', exclude: true },
      { '/': '/*' },
    ])).toBe(false);
    expect(declaredComponentsClaimExit([
      { '/': '/*' },
      { '/': '/exit*', exclude: true },
    ])).toBe(true);
  });
});
