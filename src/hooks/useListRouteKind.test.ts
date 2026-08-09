import { describe, expect, it } from 'vitest';

import { resolveListRouteKind } from './useListRouteKind';

describe('resolveListRouteKind', () => {
  it('prefers video lists when both list kinds share a d tag', () => {
    expect(resolveListRouteKind([{ kind: 30000 }, { kind: 30005 }])).toBe('videos');
  });

  it('routes people lists when no video list is present', () => {
    expect(resolveListRouteKind([{ kind: 30000 }])).toBe('people');
  });

  it('returns missing when neither detail kind is present', () => {
    expect(resolveListRouteKind([{ kind: 30001 }, { kind: 1 }])).toBe('missing');
  });
});
