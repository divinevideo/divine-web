import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPerformanceRoute } from './performanceRoutes';

describe('performance route grouping', () => {
  it.each([
    ['/u/sample-user?ref=private#secret', '/u/:userId'],
    [`/profile/${'a'.repeat(64)}/lists`, '/profile/:npub/lists'],
    [`https://divine.video/video/${'b'.repeat(64)}?q=private`, '/video/:id'],
    ['/discovery/classics', '/discovery/:tab'],
    ['/search?q=private', '/search'],
    ['/messages/private-thread', '/messages/:conversationId'],
    ['/unrecognized/private/value', '/:unmatched'],
    ['/privacy', '/privacy'],
    ['/u/:userId', '/u/:userId'],
  ])('groups %s without identifiers', (input, expected) => {
    expect(getPerformanceRoute(input)).toBe(expected);
  });

  it('gives every AppRouter route its own template rather than a catch-all', () => {
    const source = readFileSync(resolve('src/AppRouter.tsx'), 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    const paths = [...source.matchAll(/\bpath="([^"]+)"/g)].map(([, path]) => path)
      .filter(path => path !== '*' && path !== '/:nip19');
    expect(paths.length).toBeGreaterThan(50);
    expect(paths.filter(path => ['/:nip19', '/:unmatched'].includes(getPerformanceRoute(path)))).toEqual([]);
  });
});
