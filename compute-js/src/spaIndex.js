// ABOUTME: Reads the built index.html directly from the KV content store as an identity string.
// ABOUTME: Needed because PublisherServer.serveRequest()'s response body reads back empty in-worker (#435).

import { KVStore } from 'fastly:kv-store';

const CONTENT_STORE = 'divine-web-content';

/**
 * Read the built index.html directly from the KV content store, as an identity
 * (uncompressed) string.
 *
 * Any worker path that needs the page HTML as a mutable string must read the KV
 * entry directly: the body of a `publisherServer.serveRequest()` response reads
 * back empty via `.text()` in the worker runtime, which silently blanks pages
 * that mutate the HTML (see #435). Throws if the index or content entry is
 * missing so callers can decide how to degrade.
 *
 * @returns {Promise<string>} the full index.html
 */
export async function readSpaIndexHtml() {
  const contentStore = new KVStore(CONTENT_STORE);

  // File index written by compute-js-static-publish: publishId_index_collectionName.
  const indexEntry = await contentStore.get('default_index_live');
  if (!indexEntry) {
    throw new Error('Content index not found in KV');
  }
  const kvIndex = JSON.parse(await indexEntry.text());

  // Asset format: { key: "sha256:<hash>", ... }; content lives at default_files_sha256_<hash>.
  const htmlAsset = kvIndex['/index.html'];
  if (!htmlAsset) {
    throw new Error('index.html not in content index');
  }
  const sha256 = htmlAsset.key.replace('sha256:', '');
  const contentKey = `default_files_sha256_${sha256}`;
  const contentEntry = await contentStore.get(contentKey);
  if (!contentEntry) {
    throw new Error(`Content not found: ${contentKey}`);
  }
  const html = await contentEntry.text();
  console.log('Read index.html from KV, sha256:', sha256.slice(0, 16) + '...', 'length:', html.length);
  return html;
}
