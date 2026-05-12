import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const requiredFiles = [
  path.join(projectRoot, 'dist', '.well-known', 'apple-app-site-association'),
  path.join(projectRoot, 'dist', '.well-known', 'assetlinks.json'),
];

for (const file of requiredFiles) {
  await access(file);
}

const aasa = JSON.parse(
  await readFile(requiredFiles[0], 'utf8'),
);

const appIds = aasa?.applinks?.details?.flatMap((detail) => detail.appIDs ?? []);
if (!Array.isArray(appIds) || appIds.length === 0) {
  throw new Error('apple-app-site-association is missing applinks.details[].appIDs');
}

const requiredPaths = new Set(['/video/*', '/profile/*']);
const declaredPaths = new Set(
  aasa?.applinks?.details?.flatMap((detail) =>
    (detail.components ?? []).map((component) => component?.['/']).filter(Boolean),
  ) ?? [],
);

for (const requiredPath of requiredPaths) {
  if (!declaredPaths.has(requiredPath)) {
    throw new Error(`apple-app-site-association is missing required path ${requiredPath}`);
  }
}

const assetlinks = JSON.parse(
  await readFile(requiredFiles[1], 'utf8'),
);

if (!Array.isArray(assetlinks) || assetlinks.length === 0) {
  throw new Error('assetlinks.json must contain at least one target entry');
}

