import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderFeedPage } from './templates/pages.js';

describe('homepage search copy', () => {
  it('names the watchable Vine archive and new videos in both HTML paths', () => {
    const html = renderFeedPage({ videos: [], feedType: 'trending' });
    const copy = JSON.parse(readFileSync('src/lib/i18n/locales/en/common.json', 'utf8')).indexPage;

    const page = new DOMParser().parseFromString(html, 'text/html');
    expect(page.title).toBe(copy.seoTitle);
    expect(page.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(copy.seoDescription);
    expect(copy.seoTitle).toContain('Classic Vines');
    expect(copy.seoDescription).toContain('new short videos');
  });

  it('keeps discovery metadata and canonical separate from the homepage', () => {
    const html = renderFeedPage({ videos: [], feedType: 'trending', pathname: '/discovery/hot' });
    const page = new DOMParser().parseFromString(html, 'text/html');

    expect(page.title).toBe('Trending Videos - Divine');
    expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://divine.video/discovery/hot');
  });
});
