import { KVStore } from 'fastly:kv-store';

const DEFAULT_CONTENT_STORE = 'divine-web-content';
const DEFAULT_PUBLISH_ID = 'default';
const DEFAULT_COLLECTION = 'live';

function normalizeStaticPath(pathname) {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function hasViteEntryScript(html) {
  return /\/assets\/index-[^"']+\.js/.test(html);
}

export function extractStaticAssetsFromHtml(html) {
  const scriptSources = [...String(html).matchAll(/<script\b[^>]*\bsrc=(["'])([^"']+\.js)\1[^>]*>/gi)]
    .map(match => match[2]);
  const mainJs = scriptSources.find(src => /\/assets\/index-[^/"']+\.js$/.test(src)) || null;
  if (!mainJs) return null;

  const cssSources = [...String(html).matchAll(/<link\b[^>]*\bhref=(["'])([^"']+\.css)\1[^>]*>/gi)]
    .map(match => match[2]);

  return {
    mainJs,
    mainCss: cssSources[0] || '',
  };
}

export async function readPublishedStaticFile(pathname, options = {}) {
  const {
    store = new KVStore(DEFAULT_CONTENT_STORE),
    publishId = DEFAULT_PUBLISH_ID,
    collection = DEFAULT_COLLECTION,
  } = options;

  const normalizedPathname = normalizeStaticPath(pathname);
  const indexEntry = await store.get(`${publishId}_index_${collection}`);
  if (!indexEntry) {
    throw new Error(`Content index not found: ${publishId}_index_${collection}`);
  }

  const kvIndex = JSON.parse(await indexEntry.text());
  const asset = kvIndex[normalizedPathname];
  if (!asset?.key) {
    throw new Error(`${normalizedPathname} not in content index`);
  }

  const [algorithm, hash] = asset.key.split(':');
  if (algorithm !== 'sha256' || !hash) {
    throw new Error(`Unsupported content key for ${normalizedPathname}: ${asset.key}`);
  }

  const contentKey = `${publishId}_files_sha256_${hash}`;
  const contentEntry = await store.get(contentKey);
  if (!contentEntry) {
    throw new Error(`Content not found: ${contentKey}`);
  }

  return {
    body: await contentEntry.text(),
    asset,
    contentKey,
    sha256: hash,
  };
}
