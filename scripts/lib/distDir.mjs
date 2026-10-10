// ABOUTME: Resolves the output directory for prerender scripts
// ABOUTME: --out-dir <dir> wins, then PRERENDER_OUT_DIR, else <root>/dist; Vite root and content sources stay the repo

import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

export function resolveDistDir(root, argv = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({
    args: argv,
    options: { 'out-dir': { type: 'string' } },
    strict: false,
    allowPositionals: true,
  });
  const dir = values['out-dir'] ?? env.PRERENDER_OUT_DIR;
  return dir ? resolve(dir) : resolve(root, 'dist');
}
