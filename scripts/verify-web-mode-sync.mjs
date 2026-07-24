import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const edgeModeFile = path.join(projectRoot, 'compute-js', 'src', 'webMode.js');

const effectiveViteMode = process.env.VITE_WEB_MODE === 'full' ? 'full' : 'showcase';
const edgeSource = await readFile(edgeModeFile, 'utf8');
const edgeMode = edgeSource.match(/export const WEB_MODE = ['"]([^'"]+)['"];/)?.[1];

if (edgeMode !== 'showcase' && edgeMode !== 'full') {
  console.error(`✗ Could not read a valid WEB_MODE from ${edgeModeFile}`);
  process.exit(1);
}

if (edgeMode !== effectiveViteMode) {
  console.error(`✗ VITE_WEB_MODE resolves to "${effectiveViteMode}" but compute-js/src/webMode.js exports "${edgeMode}"`);
  console.error('  Keep the frontend and Fastly worker modes in sync before deploying.');
  process.exit(1);
}

console.log(`✓ Frontend and Fastly worker web mode are both "${edgeMode}"`);
