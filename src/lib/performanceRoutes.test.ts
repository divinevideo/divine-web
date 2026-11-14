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
});
