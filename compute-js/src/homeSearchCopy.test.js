import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderFeedPage } from './templates/pages.js';
import { renderShell } from './templates/shell.js';

describe('homepage search copy', () => {
  it('names the watchable Vine archive and new videos in both HTML paths', () => {
    const html = renderFeedPage({ videos: [], feedType: 'trending' });
    const copy = JSON.parse(readFileSync('src/lib/i18n/locales/en/common.json', 'utf8')).indexPage;
    const fallback = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');

    const page = new DOMParser().parseFromString(html, 'text/html');
    expect(page.title).toBe(copy.seoTitle);
    expect(page.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(copy.seoDescription);
    expect(fallback.title).toBe(copy.seoTitle);
    expect(fallback.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(copy.seoDescription);
    expect(fallback.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(copy.seoTitle);
    expect(fallback.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe(copy.seoDescription);
    expect(fallback.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(copy.seoTitle);
    expect(fallback.querySelector('meta[name="twitter:description"]')?.getAttribute('content')).toBe(copy.seoDescription);
    expect(copy.seoTitle).toContain('Classic Vines');
    expect(copy.seoDescription).toContain('new short videos');
  });

  it('defaults the edge shell to the same homepage copy as the SPA fallback', () => {
    const page = new DOMParser().parseFromString(renderShell(), 'text/html');
    const fallback = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');

    expect(page.title).toBe(fallback.title);
    expect(page.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toBe(fallback.querySelector('meta[name="description"]')?.getAttribute('content'));
  });

  it('keeps discovery metadata and canonical separate from the homepage', () => {
    const html = renderFeedPage({ videos: [], feedType: 'trending', pathname: '/discovery/hot' });
    const page = new DOMParser().parseFromString(html, 'text/html');

    expect(page.title).toBe('Trending Videos - Divine');
    expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://divine.video/discovery/hot');
    expect(page.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Watch classic Vines and new short videos on Divine.');
  });
});
