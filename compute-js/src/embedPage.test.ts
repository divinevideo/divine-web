import { describe, expect, it } from 'vitest';
import { renderEmbedPage } from './embedPage.js';

describe('renderEmbedPage', () => {
  it('renders a <video> with autoplay loop muted playsinline', () => {
    const html = renderEmbedPage({
      videoUrl: 'https://media.divine.video/x.mp4',
      mime: 'video/mp4',
      poster: 'https://media.divine.video/x.jpg',
      title: 'My Video',
    });
    expect(html).toContain('<video');
    expect(html).toContain('autoplay');
    expect(html).toContain('loop');
    expect(html).toContain('muted');
    expect(html).toContain('playsinline');
    expect(html).toContain('src="https://media.divine.video/x.mp4"');
    expect(html).toContain('type="video/mp4"');
    expect(html).toContain('poster="https://media.divine.video/x.jpg"');
  });

  it('omits poster attribute when none is provided', () => {
    const html = renderEmbedPage({
      videoUrl: 'https://media.divine.video/x.mp4',
      mime: 'video/mp4',
      poster: null,
      title: 'X',
    });
    expect(html).not.toContain('poster=');
  });

  it('escapes HTML in title and URLs', () => {
    const html = renderEmbedPage({
      videoUrl: 'https://media.divine.video/x.mp4?a="><script>',
      mime: 'video/mp4',
      poster: '',
      title: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain(`?a="><script>`);
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders a fallback message when no videoUrl is given', () => {
    const html = renderEmbedPage({ videoUrl: null, mime: null, poster: null, title: 'X' });
    expect(html).not.toContain('<video');
    expect(html).toMatch(/video unavailable/i);
  });

  it('defaults mime to video/mp4 when not provided', () => {
    const html = renderEmbedPage({
      videoUrl: 'https://media.divine.video/x.mp4',
      mime: null,
      poster: null,
      title: 'X',
    });
    expect(html).toContain('type="video/mp4"');
  });

  it('uses the title as the document title', () => {
    const html = renderEmbedPage({
      videoUrl: 'https://media.divine.video/x.mp4',
      mime: 'video/mp4',
      poster: null,
      title: 'Hello world',
    });
    expect(html).toContain('<title>Hello world</title>');
  });
});
