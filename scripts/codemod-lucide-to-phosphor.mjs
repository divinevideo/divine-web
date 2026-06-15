#!/usr/bin/env node
// ABOUTME: Codemod to rewrite lucide-react imports to @phosphor-icons/react using ICON_MAP from src/lib/iconMap.ts
// ABOUTME: Walks every .ts/.tsx file under src/, rewrites imports with aliasing, strips strokeWidth on migrated icons,
// ABOUTME: merges with existing Phosphor imports, and emits a dry-run report.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');
const SRC_DIR = join(REPO_ROOT, 'src');
const ICON_MAP_PATH = join(SRC_DIR, 'lib', 'iconMap.ts');
const REPORT_JSON_PATH = '/tmp/codemod-report.json';
const REPORT_MD_PATH = join(REPO_ROOT, 'docs', 'brand', 'codemod-lucide-report.md');

/**
 * Parse ICON_MAP from src/lib/iconMap.ts. We read the source and grep the
 * `Key: 'Value',` lines — avoiding dynamic import keeps this codemod
 * zero-dependency and decoupled from a working TS build.
 */
function loadIconMap() {
  const source = readFileSync(ICON_MAP_PATH, 'utf8');
  const map = {};
  const lineRe = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*'([^']+)'\s*,?\s*$/gm;
  let m;
  while ((m = lineRe.exec(source)) !== null) {
    map[m[1]] = m[2];
  }
  return map;
}

async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      await walk(full, acc);
    } else if (entry.isFile()) {
      if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full);
    }
  }
  return acc;
}

/**
 * Split a named-import clause into individual specifiers, stripping comments
 * and blank entries.
 *
 * Returns an array of objects: { imported, local, raw }
 *   - imported: the name as exported from the module
 *   - local:    the local alias (same as imported if no `as` clause)
 *   - raw:      the verbatim specifier text (unused, kept for debugging)
 *
 * Skips anything that doesn't look like an identifier (e.g. `Link2/*` comment
 * artifacts) — we return null for those and the caller can warn.
 */
function parseSpecifiers(inside) {
  // Strip /* ... */ block comments and // line comments conservatively.
  const cleaned = inside
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const parts = cleaned.split(',');
  const specs = [];
  const skipped = [];
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;
    const asMatch = /^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(part);
    if (asMatch) {
      specs.push({ imported: asMatch[1], local: asMatch[2] });
      continue;
    }
    const plainMatch = /^([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(part);
    if (plainMatch) {
      specs.push({ imported: plainMatch[1], local: plainMatch[1] });
      continue;
    }
    skipped.push(part);
  }
  return { specs, skipped };
}

/**
 * Replace comment contents with same-length spaces/newlines so regex matches
 * on code only. Preserving length lets us reuse match indices on the original.
 * Not a full JS lexer — ignores strings — but good enough for our use case
 * since we only care about `import` statements which precede any runtime code.
 */
function maskComments(src) {
  const chars = src.split('');
  let i = 0;
  while (i < chars.length) {
    // Line comment
    if (chars[i] === '/' && chars[i + 1] === '/') {
      while (i < chars.length && chars[i] !== '\n') {
        chars[i] = ' ';
        i++;
      }
      continue;
    }
    // Block comment
    if (chars[i] === '/' && chars[i + 1] === '*') {
      chars[i] = ' ';
      chars[i + 1] = ' ';
      i += 2;
      while (i < chars.length && !(chars[i] === '*' && chars[i + 1] === '/')) {
        if (chars[i] !== '\n') chars[i] = ' ';
        i++;
      }
      if (i < chars.length) {
        chars[i] = ' ';
        chars[i + 1] = ' ';
        i += 2;
      }
      continue;
    }
    i++;
  }
  return chars.join('');
}

/**
 * Match a single `import { ... } from 'lucide-react'` statement (optionally
 * `import type { ... }`). Multi-line imports are supported. The inside group
 * excludes `{` and `}` so we can't accidentally span across an earlier
 * non-lucide import that also happens to appear on the page.
 */
const LUCIDE_IMPORT_RE =
  /import\s+(type\s+)?\{\s*([^{}]*?)\s*\}\s*from\s*['"]lucide-react['"]\s*;?/g;

/**
 * Match an existing `import { ... } from '@phosphor-icons/react'` so we can
 * merge new specifiers into it (edge case 3).
 */
const PHOSPHOR_IMPORT_RE =
  /import\s+(type\s+)?\{\s*([^{}]*?)\s*\}\s*from\s*['"]@phosphor-icons\/react['"]\s*;?/g;

/**
 * Build a canonical import line from a list of specs.
 *   buildImport([{ imported: 'ChatCircle', local: 'MessageCircle' }]) →
 *   "import { ChatCircle as MessageCircle } from '@phosphor-icons/react';"
 */
function buildImport(specs, { typeOnly } = { typeOnly: false }) {
  // De-dupe by (imported, local) pair.
  const seen = new Set();
  const unique = [];
  for (const s of specs) {
    const key = `${s.imported}|${s.local}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  const parts = unique.map((s) =>
    s.imported === s.local ? s.imported : `${s.imported} as ${s.local}`,
  );
  const typeKw = typeOnly ? 'type ' : '';
  return `import ${typeKw}{ ${parts.join(', ')} } from '@phosphor-icons/react';`;
}

/**
 * Transform a single file's source. Returns
 *   { changed: boolean, source: string, unmapped: [{name, line}], strokeStripped: number }
 *
 * Files that don't import lucide-react are returned untouched (changed=false,
 * identical source) — the caller never writes those.
 */
function transformFile(source, iconMap, filePath) {
  // Mask block comments and line comments so our import regex can't match
  // example code inside JSDoc (e.g. `import { X } from 'lucide-react'` in
  // docs). Same-length replacement keeps offsets aligned with the original.
  const masked = maskComments(source);
  if (!LUCIDE_IMPORT_RE.test(masked)) {
    LUCIDE_IMPORT_RE.lastIndex = 0;
    return { changed: false, source, unmapped: [], strokeStripped: 0 };
  }
  LUCIDE_IMPORT_RE.lastIndex = 0;

  const unmapped = [];
  // Collect all rewritten (imported, local) pairs for each existing import
  // variant (type vs value) so we can merge into a single Phosphor import.
  const phosphorValueSpecs = [];
  const phosphorTypeSpecs = [];

  // Splice-style replace: collect match ranges from the masked source, then
  // rewrite the original source in a single pass from last to first.
  const edits = []; // { start, end, text }

  for (const m of masked.matchAll(LUCIDE_IMPORT_RE)) {
    const full = m[0];
    const typeKw = m[1];
    const inside = m[2];
    const start = m.index;
    const end = start + full.length;
    const typeOnly = Boolean(typeKw);
    const { specs, skipped } = parseSpecifiers(inside);
    const lineNumber = source.slice(0, start).split('\n').length;

    for (const skip of skipped) {
      unmapped.push({ name: `<unparsed: ${skip}>`, line: lineNumber });
    }

    const kept = [];
    for (const spec of specs) {
      if (typeOnly && spec.imported === 'LucideIcon') {
        phosphorTypeSpecs.push({ imported: 'Icon', local: spec.local });
        continue;
      }
      const phosphorName = iconMap[spec.imported];
      if (!phosphorName) {
        unmapped.push({ name: spec.imported, line: lineNumber });
        kept.push(spec);
        continue;
      }
      const target = typeOnly ? phosphorTypeSpecs : phosphorValueSpecs;
      target.push({ imported: phosphorName, local: spec.local });
    }

    // Did this import contribute any mapped specs? Used to decide whether to
    // leave a marker for the Phosphor import to fill in.
    const migratedSome =
      specs.length > 0 &&
      specs.some((s) => iconMap[s.imported] || (typeOnly && s.imported === 'LucideIcon'));

    if (kept.length === 0) {
      edits.push({ start, end, text: '__LUCIDE_IMPORT_REMOVED__' });
    } else {
      const rebuilt = buildImport(kept, { typeOnly }).replace(
        "@phosphor-icons/react",
        'lucide-react',
      );
      // If we migrated some specs from THIS import, leave a marker right
      // after the rebuilt line so the Phosphor import lands on the next line.
      const text = migratedSome
        ? rebuilt + '\n__LUCIDE_IMPORT_REMOVED__'
        : rebuilt;
      edits.push({ start, end, text });
    }
  }

  // Also handle existing Phosphor imports (for merging).
  for (const m of masked.matchAll(PHOSPHOR_IMPORT_RE)) {
    const typeKw = m[1];
    const inside = m[2];
    const start = m.index;
    const end = start + m[0].length;
    const typeOnly = Boolean(typeKw);
    const { specs } = parseSpecifiers(inside);
    if (typeOnly) phosphorTypeSpecs.push(...specs);
    else phosphorValueSpecs.push(...specs);
    edits.push({ start, end, text: '__PHOSPHOR_IMPORT_REMOVED__' });
  }

  // Apply edits back-to-front.
  edits.sort((a, b) => b.start - a.start);
  let out = source;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  const mergedValueSpecs = phosphorValueSpecs;
  const mergedTypeSpecs = phosphorTypeSpecs;

  // Insertion strategy: at the location of the FIRST removed marker (lucide
  // or phosphor), emit the merged Phosphor import(s). Other markers get
  // stripped along with their trailing newline to avoid blank-line drift.
  const newImportLines = [];
  if (mergedValueSpecs.length > 0) {
    newImportLines.push(buildImport(mergedValueSpecs, { typeOnly: false }));
  }
  if (mergedTypeSpecs.length > 0) {
    newImportLines.push(buildImport(mergedTypeSpecs, { typeOnly: true }));
  }
  const replacement = newImportLines.join('\n');

  let firstMarkerReplaced = false;
  out = out.replace(
    /__(?:LUCIDE|PHOSPHOR)_IMPORT_REMOVED__(?:\r?\n)?/g,
    (match) => {
      if (!firstMarkerReplaced && replacement) {
        firstMarkerReplaced = true;
        // Preserve whatever newline the original marker ate so surrounding
        // layout stays identical.
        const hadNewline = /\r?\n$/.test(match);
        return replacement + (hadNewline ? '\n' : '');
      }
      return '';
    },
  );

  // Strip `strokeWidth={...}`, `strokeWidth="..."` on JSX tags whose name
  // matches a migrated local identifier. We operate per-identifier to keep
  // the blast radius small — SVG <path strokeWidth={2}/> won't match because
  // <path> isn't in the migrated set.
  const migratedLocals = new Set([
    ...mergedValueSpecs.map((s) => s.local),
    // Don't strip on type-only specs (they're never JSX tags).
  ]);
  let strokeStripped = 0;
  for (const local of migratedLocals) {
    // <Local ... strokeWidth={...} ... /> or <Local ... strokeWidth="..." ... />
    // We match the prop anywhere inside the opening tag, being careful not
    // to cross a `>` that closes the tag.
    const tagRe = new RegExp(
      String.raw`(<${local}\b[^>]*?)\s+strokeWidth=(?:\{[^}]*\}|"[^"]*")([^>]*>)`,
      'g',
    );
    out = out.replace(tagRe, (_m, before, after) => {
      strokeStripped += 1;
      return before + after;
    });
  }

  return {
    changed: out !== source,
    source: out,
    unmapped,
    strokeStripped,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const write = argv.includes('--write');
  const dryRun = !write || argv.includes('--dry-run');

  const iconMap = loadIconMap();
  const files = await walk(SRC_DIR);

  const filesModified = [];
  const unmappedIcons = [];
  let strokeWidthStripped = 0;

  for (const file of files) {
    const original = readFileSync(file, 'utf8');
    const { changed, source: next, unmapped, strokeStripped } = transformFile(
      original,
      iconMap,
      file,
    );
    if (!changed && unmapped.length === 0) continue;

    const relPath = relative(REPO_ROOT, file);
    for (const u of unmapped) unmappedIcons.push({ ...u, file: relPath });

    if (changed) {
      filesModified.push(relPath);
      strokeWidthStripped += strokeStripped;
      if (write && !dryRun) {
        writeFileSync(file, next, 'utf8');
      }
    }
  }

  const report = { filesModified, unmappedIcons, strokeWidthStripped };
  writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

  // Markdown report.
  const md = renderMarkdown(report, { dryRun: !write });
  const mdDir = dirname(REPORT_MD_PATH);
  if (!existsSync(mdDir)) mkdirSync(mdDir, { recursive: true });
  writeFileSync(REPORT_MD_PATH, md, 'utf8');

  // Console summary.
  console.log(
    `${write ? 'WROTE' : 'DRY-RUN'}: ${filesModified.length} files would change`,
  );
  console.log(`strokeWidth props stripped: ${strokeWidthStripped}`);
  console.log(`unmapped icons: ${unmappedIcons.length}`);
  if (unmappedIcons.length > 0) {
    const groups = new Map();
    for (const u of unmappedIcons) {
      if (!groups.has(u.name)) groups.set(u.name, []);
      groups.get(u.name).push(u);
    }
    for (const [name, occurrences] of groups) {
      console.log(`  - ${name} (${occurrences.length}x)`);
    }
  }
  console.log(`JSON report: ${REPORT_JSON_PATH}`);
  console.log(`MD report:   ${REPORT_MD_PATH}`);
}

function renderMarkdown({ filesModified, unmappedIcons, strokeWidthStripped }, { dryRun }) {
  const lines = [];
  lines.push(`# Lucide → Phosphor codemod report`);
  lines.push('');
  lines.push(`- Mode: **${dryRun ? 'dry-run' : 'write'}**`);
  lines.push(`- Files modified: **${filesModified.length}**`);
  lines.push(`- strokeWidth props stripped: **${strokeWidthStripped}**`);
  lines.push(`- Unmapped icons: **${unmappedIcons.length}**`);
  lines.push('');

  lines.push(`## Unmapped icons`);
  lines.push('');
  if (unmappedIcons.length === 0) {
    lines.push(`_None._`);
  } else {
    lines.push(`| Icon | File | Line |`);
    lines.push(`| --- | --- | --- |`);
    for (const u of unmappedIcons) {
      lines.push(`| \`${u.name}\` | \`${u.file}\` | ${u.line} |`);
    }
  }
  lines.push('');

  lines.push(`## Files that would change`);
  lines.push('');
  if (filesModified.length === 0) {
    lines.push(`_None._`);
  } else {
    for (const f of filesModified) {
      lines.push(`- \`${f}\``);
    }
  }
  lines.push('');

  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
