import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'public', '.well-known');
const targetDir = path.join(projectRoot, 'dist', '.well-known');

await mkdir(targetDir, { recursive: true });
await cp(sourceDir, targetDir, { recursive: true });

