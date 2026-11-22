import { describe, expect, it, vi } from 'vitest';
import { createEdgeTemplateHeaders } from './templateCachePolicy.js';
import { resolveCachedVideoPage } from './videoPageCache.js';

function createMemoryStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    get: vi.fn(async (key) => {
      if (!map.has(key)) return null;
      const value = map.get(key);
      return { text: async () => value };
    }),
    put: vi.fn(async (key, value) => {
      map.set(key, value);
    }),
    delete: vi.fn(async (key) => {
      map.delete(key);
    }),
  };
}

const STATIC_ASSETS = { mainJs: '/assets/index-abc.js', mainCss: '/assets/index-abc.css' };

describe('resolveCachedVideoPage', () => {
  it('deletes the KV cache entry on a definite 404 during background SWR so removed videos are not served for an hour', async () => {
    const store = createMemoryStore({
      'page:video:vid-404': JSON.stringify({
        html: '<html>stale taken-down video</html>',
        timestamp: 1000,
        assetMainJs: STATIC_ASSETS.mainJs,
        ageRestricted: false,
      }),
    });
    const bgTasks = [];

    const first = await resolveCachedVideoPage({
      videoId: 'vid-404',
      staticAssets: STATIC_ASSETS,
      contentStore: store,
      fetchVideoMetadataWithStatus: vi.fn(async () => ({ status: 'not_found' })),
      renderVideoPage: vi.fn(),
      createHeaders: createEdgeTemplateHeaders,
      waitUntil: (p) => bgTasks.push(p),
      nowSeconds: () => 1400, // 400s old: stale (>300s, <3600s)
    });

    expect(first?.status).toBe(200);
    await Promise.all(bgTasks);

    expect(store.delete).toHaveBeenCalledWith('page:video:vid-404');
    expect(store.map.has('page:video:vid-404')).toBe(false);

    // Next request sees no KV entry and falls through to SPA instead of serving removed video
    const second = await resolveCachedVideoPage({
      videoId: 'vid-404',
      staticAssets: STATIC_ASSETS,
      contentStore: store,
      fetchVideoMetadataWithStatus: vi.fn(async () => ({ status: 'not_found' })),
      renderVideoPage: vi.fn(),
      createHeaders: createEdgeTemplateHeaders,
      waitUntil: (p) => bgTasks.push(p),
      nowSeconds: () => 1405,
    });

    expect(second).toBeNull();
  });

  it('keeps serving stale HTML on transient 5xx/network errors without deleting the KV entry', async () => {
    const store = createMemoryStore({
      'page:video:vid-500': JSON.stringify({
        html: '<html>stale during outage</html>',
        timestamp: 1000,
        assetMainJs: STATIC_ASSETS.mainJs,
        ageRestricted: false,
      }),
    });
    const bgTasks = [];

    const response = await resolveCachedVideoPage({
      videoId: 'vid-500',
      staticAssets: STATIC_ASSETS,
      contentStore: store,
      fetchVideoMetadataWithStatus: vi.fn(async () => ({ status: 'error' })),
      renderVideoPage: vi.fn(),
      createHeaders: createEdgeTemplateHeaders,
      waitUntil: (p) => bgTasks.push(p),
      nowSeconds: () => 1400,
    });

    await Promise.all(bgTasks);

    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe('<html>stale during outage</html>');
    expect(store.delete).not.toHaveBeenCalled();
    expect(store.map.has('page:video:vid-500')).toBe(true);
  });

  it('does not fall back to stale HTML on foreground 404 when waitUntil is unavailable', async () => {
    const store = createMemoryStore({
      'page:video:vid-fg-404': JSON.stringify({
        html: '<html>stale taken-down video</html>',
        timestamp: 1000,
        assetMainJs: STATIC_ASSETS.mainJs,
        ageRestricted: false,
      }),
    });

    const response = await resolveCachedVideoPage({
      videoId: 'vid-fg-404',
      staticAssets: STATIC_ASSETS,
      contentStore: store,
      fetchVideoMetadataWithStatus: vi.fn(async () => ({ status: 'not_found' })),
      renderVideoPage: vi.fn(),
      createHeaders: createEdgeTemplateHeaders,
      waitUntil: undefined,
      nowSeconds: () => 1400,
    });

    expect(response).toBeNull();
    expect(store.delete).toHaveBeenCalledWith('page:video:vid-fg-404');
  });

  it('sets X-Robots-Tag: noindex on both fresh and cached age-restricted video pages', async () => {
    const store = createMemoryStore();
    const bgTasks = [];

    const fresh = await resolveCachedVideoPage({
      videoId: 'vid-age',
      staticAssets: STATIC_ASSETS,
      contentStore: store,
      fetchVideoMetadataWithStatus: vi.fn(async () => ({
        status: 'ok',
        meta: { title: 'Age gated', age_restricted: true },
      })),
      renderVideoPage: vi.fn(() => '<html>age gated</html>'),
      createHeaders: createEdgeTemplateHeaders,
      waitUntil: (p) => bgTasks.push(p),
      nowSeconds: () => 2000,
    });

    await Promise.all(bgTasks);
    expect(fresh?.headers.get('X-Robots-Tag')).toBe('noindex');

    const cached = await resolveCachedVideoPage({
      videoId: 'vid-age',
      staticAssets: STATIC_ASSETS,
      contentStore: store,
      fetchVideoMetadataWithStatus: vi.fn(),
      renderVideoPage: vi.fn(),
      createHeaders: createEdgeTemplateHeaders,
      waitUntil: (p) => bgTasks.push(p),
      nowSeconds: () => 2050,
    });

    expect(cached?.headers.get('X-Robots-Tag')).toBe('noindex');
  });
});
