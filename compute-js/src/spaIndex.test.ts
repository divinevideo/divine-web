// ABOUTME: Vitest unit tests for readSpaIndexHtml (reads index.html directly from the KV content store)
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Module-level store the mock factory closes over. Per crawlerHandlers.test.ts:
// the factory must not reference a name 'KVStore' (vi.mock hoists above imports).
const _kvStore = new Map<string, string>();

vi.mock('fastly:kv-store', () => {
  class MockKVStore {
    constructor(_name: string) {}
    async get(key: string): Promise<{ text(): Promise<string> } | null> {
      const val = _kvStore.get(key);
      if (val === undefined) return null;
      return { text: async () => val };
    }
  }
  return { KVStore: MockKVStore };
});

import { readSpaIndexHtml } from './spaIndex.js';

const HASH = 'abc123def456';
const HTML = '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>';

describe('readSpaIndexHtml', () => {
  beforeEach(() => {
    _kvStore.clear();
  });

  it('resolves index.html through the KV index pointer and returns its content', async () => {
    _kvStore.set('default_index_live', JSON.stringify({ '/index.html': { key: `sha256:${HASH}` } }));
    _kvStore.set(`default_files_sha256_${HASH}`, HTML);
    await expect(readSpaIndexHtml()).resolves.toBe(HTML);
  });

  it('throws when the content index is missing', async () => {
    await expect(readSpaIndexHtml()).rejects.toThrow('Content index not found in KV');
  });

  it('throws when index.html is not listed in the index', async () => {
    _kvStore.set('default_index_live', JSON.stringify({ '/other.html': { key: 'sha256:x' } }));
    await expect(readSpaIndexHtml()).rejects.toThrow('index.html not in content index');
  });

  it('throws when the content blob is missing', async () => {
    _kvStore.set('default_index_live', JSON.stringify({ '/index.html': { key: `sha256:${HASH}` } }));
    await expect(readSpaIndexHtml()).rejects.toThrow(`Content not found: default_files_sha256_${HASH}`);
  });
});
