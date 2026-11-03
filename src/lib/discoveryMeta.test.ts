import { describe, expect, it } from 'vitest';
import { HOT_DESCRIPTION, HOT_TITLE } from '../../compute-js/src/siteCopy.js';
import { getDiscoveryMeta } from './discoveryMeta';

describe('getDiscoveryMeta', () => {
  it.each([
    ['/discovery/hot', 'Trending Videos - Divine'],
    ['/discovery/classics', 'Classic Vines - Divine'],
    ['/discovery/hashtags', 'Videos by Hashtag - Divine'],
    ['/discovery/foryou', 'For You Videos - Divine'],
    ['/discovery', 'Discover Videos - Divine'],
  ])('titles %s as %s', (pathname, title) => {
    expect(getDiscoveryMeta(pathname).title).toBe(title);
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'falls back to the generic title for the inherited object key %s',
    (tab) => expect(getDiscoveryMeta(`/discovery/${tab}`).title).toBe('Discover Videos - Divine'),
  );

  it('lowercases the path, as the route matches the tab case-insensitively', () => {
    expect(getDiscoveryMeta('/discovery/Hot')).toMatchObject({ title: 'Trending Videos - Divine', path: '/discovery/hot' });
  });

  it('matches the hot-route copy the Fastly worker serves', () => {
    expect(getDiscoveryMeta('/discovery/hot')).toMatchObject({ title: HOT_TITLE, description: HOT_DESCRIPTION });
  });
});
