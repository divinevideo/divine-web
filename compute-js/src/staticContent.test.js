import { describe, expect, it } from 'vitest';
import { extractStaticAssetsFromHtml, hasViteEntryScript, readPublishedStaticFile } from './staticContent.js';

function createStore(entries) {
  return {
    async get(key) {
      const value = entries.get(key);
      return value == null ? null : { text: async () => value };
    },
  };
}

describe('hasViteEntryScript', () => {
  it('detects the Vite index bundle in published HTML', () => {
    expect(hasViteEntryScript('<script type="module" src="/assets/index-abc123.js"></script>')).toBe(true);
  });

  it('rejects empty or scriptless HTML', () => {
    expect(hasViteEntryScript('')).toBe(false);
    expect(hasViteEntryScript('<!doctype html><html></html>')).toBe(false);
  });
});

describe('extractStaticAssetsFromHtml', () => {
  it('selects the Vite app entry instead of the first module script', () => {
    const html = `
      <script type="module" src="/assets/hubSpotLoader-AbCd.js"></script>
      <link rel="stylesheet" href="/assets/index-EfGh.css">
      <script type="module" src="/assets/index-IjKl.js"></script>
    `;

    expect(extractStaticAssetsFromHtml(html)).toEqual({
      mainJs: '/assets/index-IjKl.js',
      mainCss: '/assets/index-EfGh.css',
    });
  });

  it('returns null when the app entry script is missing', () => {
    const html = '<script type="module" src="/assets/hubSpotLoader-AbCd.js"></script>';

    expect(extractStaticAssetsFromHtml(html)).toBeNull();
  });
});

describe('readPublishedStaticFile', () => {
  it('reads a published static file through the static-publish KV index', async () => {
    const entries = new Map([
      ['default_index_live', JSON.stringify({
        '/index.html': {
          key: 'sha256:abc123',
          size: 49,
          contentType: 'text/html; charset=utf-8',
        },
      })],
      ['default_files_sha256_abc123', '<script type="module" src="/assets/index-abc123.js">'],
    ]);

    const result = await readPublishedStaticFile('/index.html', { store: createStore(entries) });

    expect(result.body).toContain('/assets/index-abc123.js');
    expect(result.contentKey).toBe('default_files_sha256_abc123');
    expect(result.sha256).toBe('abc123');
  });

  it('throws when the requested file is missing from the content index', async () => {
    const entries = new Map([
      ['default_index_live', JSON.stringify({})],
    ]);

    await expect(readPublishedStaticFile('/index.html', { store: createStore(entries) }))
      .rejects.toThrow('/index.html not in content index');
  });
});
