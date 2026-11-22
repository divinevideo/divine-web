// ABOUTME: Tests for public/robots.txt and public/sitemap.xml
// ABOUTME: Guards crawler policy and sitemap entries for public pages

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('public robots.txt', () => {
  const robots = readFileSync(join(process.cwd(), 'public/robots.txt'), 'utf8');
  const groups = robots.split(/\r?\n\s*\r?\n/).map(group => group.split(/\r?\n/));

  function rulesFor(agent: string) {
    return groups
      .filter(group => group.includes(`User-agent: ${agent}`))
      .flatMap(group => group.filter(line => /^(Allow|Disallow):/.test(line)));
  }

  it('allows default crawling outside the restricted paths', () => {
    expect(rulesFor('*')).toEqual([
      'Allow: /',
      'Disallow: /t/',
      'Disallow: /hashtag/',
      'Disallow: /search',
    ]);
    expect(rulesFor('*')).not.toContain('Disallow: /hashtags');
  });

  it.each([
    'GPTBot',
    'ClaudeBot',
    'anthropic-ai',
    'Google-Extended',
    'GoogleOther',
    'GoogleOther-Image',
    'GoogleOther-Video',
    'FacebookBot',
    'Meta-ExternalAgent',
    'Bytespider',
    'Amazonbot',
    'CCBot',
    'Applebot-Extended',
    'cohere-ai',
    'cohere-training-data-crawler',
    'AI2Bot',
    'Ai2Bot-Dolma',
    'Timpibot',
    'Omgilibot',
    'Webzio-Extended',
    'DeepSeekBot',
    'PanguBot',
  ])('disallows AI training and scraping crawler %s', agent => {
    expect(rulesFor(agent)).toEqual(['Disallow: /']);
  });

  it.each(['Claude-Web', 'Claude-User', 'Claude-SearchBot', 'OAI-SearchBot', 'PerplexityBot'])(
    'asks %s to crawl only the assistant guide',
    agent => {
      expect(rulesFor(agent)).toEqual(['Allow: /llms.txt$', 'Disallow: /']);
    },
  );

  it.each(['facebookexternalhit', 'Twitterbot', 'Slackbot', 'LinkedInBot', 'Pinterest', 'Pinterestbot'])(
    'allows %s to fetch shared links',
    agent => {
      expect(rulesFor(agent)).toEqual(['Allow: /']);
    },
  );

  it('points at the sitemap', () => {
    expect(robots).toContain('Sitemap: https://divine.video/sitemap.xml');
  });
});

describe('public sitemap.xml', () => {
  const sitemap = readFileSync(join(process.cwd(), 'public/sitemap.xml'), 'utf8');

  it('lists all five family routes', () => {
    for (const path of [
      '/family',
      '/family/talking-to-your-teen',
      '/family/media-plan',
      '/family/when-something-goes-wrong',
      '/family/safety-tools',
    ]) {
      expect(sitemap).toContain(`<loc>https://divine.video${path}</loc>`);
    }
  });

  it('gives family routes a lastmod date', () => {
    const familyEntries = sitemap.split('<url>').filter((e) => e.includes('/family'));
    expect(familyEntries.length).toBeGreaterThanOrEqual(5);
    for (const entry of familyEntries) {
      expect(entry).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    }
  });

  it('links the kids policy, download, and account portability pages', () => {
    expect(sitemap).toContain('<loc>https://divine.video/kids</loc>');
    expect(sitemap).toContain('<loc>https://divine.video/download</loc>');
    expect(sitemap).toContain('<loc>https://divine.video/exit</loc>');
    expect(sitemap).toContain('<loc>https://divine.video/delete-account</loc>');
  });
});
