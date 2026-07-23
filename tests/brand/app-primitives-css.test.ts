import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const brandUtilitiesCss = readFileSync(resolve(process.cwd(), 'src/styles/brand-utilities.css'), 'utf8');
const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

function getSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return getSourceFiles(path);
    }

    return /\.(ts|tsx)$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

function getReferencedPrimitiveClasses(): string[] {
  const classNames = new Set<string>();
  const primitiveClassPattern = /(?<!-)\b(?:app|marketing)-[A-Za-z0-9_-]+/g;

  for (const sourceFile of getSourceFiles(resolve(process.cwd(), 'src'))) {
    const source = readFileSync(sourceFile, 'utf8');
    const classNameLines = source.split('\n').filter((line) => line.includes('className'));

    for (const line of classNameLines) {
      for (const match of line.matchAll(primitiveClassPattern)) {
        classNames.add(match[0]);
      }
    }
  }

  return [...classNames].sort();
}

describe('app primitive CSS', () => {
  it('defines every referenced app and marketing primitive class', () => {
    const missingClassNames = getReferencedPrimitiveClasses().filter(
      (className) => !brandUtilitiesCss.includes(`.${className}`),
    );

    expect(missingClassNames).toEqual([]);
  });

  it('defines the app header height token used by sticky app surfaces', () => {
    expect(indexCss).toContain('--app-header-height:');
  });
});
