// ABOUTME: Vitest unit tests for handleAtUsernameOg (new /@username crawler OG handler)
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Use a module-level store map that the mock factory closes over.
// IMPORTANT: the factory must not reference any class named 'KVStore' because
// vitest hoists vi.mock() above the imports and that name collides with the
// import alias '__vi_import_0__', producing a TDZ error.
const _kvStore = new Map<string, string>();

vi.mock('fastly:kv-store', () => {
  class MockKVStore {
    constructor(_name: string) {}
    async get(key: string): Promise<{ text(): Promise<string> } | null> {
      const val = _kvStore.get(key);
      if (!val) return null;
      return { text: async () => val };
    }
  }
  return { KVStore: MockKVStore };
});

import { handleAtUsernameOg } from './crawlerHandlers.js';

const HEX64 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('handleAtUsernameOg', () => {
  beforeEach(() => {
    _kvStore.clear();
    vi.unstubAllGlobals();
  });

  it('returns null when username is not in KV', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await handleAtUsernameOg('nobody', new URL('https://divine.video/@nobody'));
    expect(result).toBeNull();
  });

  it('returns null when KV entry is inactive', async () => {
    _kvStore.set('user:alice', JSON.stringify({ status: 'inactive', pubkey: HEX64 }));
    const result = await handleAtUsernameOg('alice', new URL('https://divine.video/@alice'));
    expect(result).toBeNull();
  });

  it('returns OG HTML when username is active and funnelcake responds', async () => {
    _kvStore.set('user:alice', JSON.stringify({ status: 'active', pubkey: HEX64 }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: { display_name: 'Alice', about: 'Hello', picture: 'https://x/y.jpg' },
        stats: { video_count: 5 },
      }),
    }));
    const result = await handleAtUsernameOg('alice', new URL('https://divine.video/@alice'));
    expect(result).not.toBeNull();
    const html = await result!.text();
    expect(html).toContain('Alice on Divine');
    expect(html).toContain('Hello');
    expect(html).toContain('https://x/y.jpg');
    expect(html).toContain('https://divine.video/@alice');
    // Profile cards should NOT include image dimensions (avatar is square)
    expect(html).not.toContain('og:image:width');
  });

  it('falls back gracefully when funnelcake fails', async () => {
    _kvStore.set('user:alice', JSON.stringify({ status: 'active', pubkey: HEX64 }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await handleAtUsernameOg('alice', new URL('https://divine.video/@alice'));
    const html = await result!.text();
    expect(html).toContain('alice on Divine');
    // The apostrophe is HTML-escaped in the og:description attribute
    expect(html).toContain(`Watch alice&#039;s videos on Divine.`);
  });

  it('falls back gracefully when funnelcake throws', async () => {
    _kvStore.set('user:alice', JSON.stringify({ status: 'active', pubkey: HEX64 }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const result = await handleAtUsernameOg('alice', new URL('https://divine.video/@alice'));
    const html = await result!.text();
    expect(html).toContain('alice on Divine');
  });

  it('uses video count in description when no about and count > 0', async () => {
    _kvStore.set('user:bob', JSON.stringify({ status: 'active', pubkey: HEX64 }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profile: { name: 'Bob' }, stats: { video_count: 7 } }),
    }));
    const result = await handleAtUsernameOg('bob', new URL('https://divine.video/@bob'));
    const html = await result!.text();
    // The apostrophe is HTML-escaped in the og:description attribute
    expect(html).toContain(`Watch Bob&#039;s 7 videos on Divine.`);
  });
});
