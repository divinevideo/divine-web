// ABOUTME: Vitest unit tests for buildCrawlerHtml, escapeHtml, and truncateText
import { describe, expect, it } from 'vitest';
import { buildCrawlerHtml, escapeHtml, truncateText } from './ogTags.js';

const baseArgs = {
  title: 'Hello',
  description: 'A description',
  image: 'https://example.com/img.jpg',
  url: 'https://example.com/page',
  ogType: 'website',
};

describe('buildCrawlerHtml', () => {
  it('does NOT emit a meta http-equiv refresh tag (breaks Slack unfurls)', () => {
    const html = buildCrawlerHtml(baseArgs);
    expect(html).not.toMatch(/http-equiv\s*=\s*"refresh"/i);
  });

  it('omits og:image:width and og:image:height when no dimensions are supplied', () => {
    const html = buildCrawlerHtml(baseArgs);
    expect(html).not.toContain('og:image:width');
    expect(html).not.toContain('og:image:height');
  });

  it('emits og:image:width and og:image:height when both are supplied', () => {
    const html = buildCrawlerHtml({ ...baseArgs, imageWidth: 720, imageHeight: 1280 });
    expect(html).toContain('<meta property="og:image:width" content="720"');
    expect(html).toContain('<meta property="og:image:height" content="1280"');
  });

  it('omits dimensions when only one of width/height is supplied', () => {
    const onlyWidth = buildCrawlerHtml({ ...baseArgs, imageWidth: 720 });
    expect(onlyWidth).not.toContain('og:image:width');
    expect(onlyWidth).not.toContain('og:image:height');
  });

  it('omits og:video block when no video is provided', () => {
    const html = buildCrawlerHtml(baseArgs);
    expect(html).not.toContain('og:video');
    expect(html).not.toContain('twitter:player');
  });

  it('emits the og:video block when video is provided', () => {
    const html = buildCrawlerHtml({
      ...baseArgs,
      ogType: 'video.other',
      twitterCard: 'player',
      video: {
        url: 'https://media.divine.video/abc.mp4',
        type: 'video/mp4',
        width: 720,
        height: 1280,
        embedUrl: 'https://divine.video/embed/abc',
      },
    });
    expect(html).toContain('<meta property="og:video" content="https://media.divine.video/abc.mp4"');
    expect(html).toContain('<meta property="og:video:secure_url"');
    expect(html).toContain('<meta property="og:video:type" content="video/mp4"');
    expect(html).toContain('<meta property="og:video:width" content="720"');
    expect(html).toContain('<meta property="og:video:height" content="1280"');
    expect(html).toContain('<meta name="twitter:card" content="player"');
    expect(html).toContain('<meta name="twitter:player" content="https://divine.video/embed/abc"');
    expect(html).toContain('<meta name="twitter:player:width" content="720"');
    expect(html).toContain('<meta name="twitter:player:height" content="1280"');
    expect(html).toContain('<meta name="twitter:player:stream" content="https://media.divine.video/abc.mp4"');
    expect(html).toContain('<meta name="twitter:player:stream:content_type" content="video/mp4"');
  });

  it('omits twitter:player tags when video has no embedUrl', () => {
    const html = buildCrawlerHtml({
      ...baseArgs,
      ogType: 'video.other',
      video: {
        url: 'https://media.divine.video/abc.mp4',
        type: 'video/mp4',
        width: 720,
        height: 1280,
      },
    });
    expect(html).toContain('og:video');
    expect(html).not.toContain('twitter:player');
  });

  it('falls back to twitter:card=summary_large_image by default', () => {
    const html = buildCrawlerHtml(baseArgs);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
  });

  it('escapes HTML in user-supplied fields', () => {
    const html = buildCrawlerHtml({ ...baseArgs, title: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('emits canonical link', () => {
    const html = buildCrawlerHtml(baseArgs);
    expect(html).toContain('<link rel="canonical" href="https://example.com/page"');
  });

  it('emits twitter:creator only when provided', () => {
    const without = buildCrawlerHtml(baseArgs);
    expect(without).not.toContain('twitter:creator');
    const withCreator = buildCrawlerHtml({ ...baseArgs, twitterCreator: '@alice' });
    expect(withCreator).toContain('<meta name="twitter:creator" content="@alice"');
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#039;');
  });
  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
  it('coerces non-string input safely', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('truncateText', () => {
  it('returns short input unchanged', () => {
    expect(truncateText('hi there', 80)).toBe('hi there');
  });
  it('truncates long input with ellipsis', () => {
    const long = 'a'.repeat(100);
    const result = truncateText(long, 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('…')).toBe(true);
  });
  it('collapses whitespace before truncating', () => {
    expect(truncateText('hi   there', 80)).toBe('hi there');
  });
});
