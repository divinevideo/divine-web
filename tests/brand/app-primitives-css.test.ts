import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles/brand-utilities.css'), 'utf8');

describe('app primitive CSS', () => {
  it.each([
    'app-page',
    'app-page__inner',
    'app-page__header',
    'app-eyebrow',
    'app-title',
    'app-subtitle',
    'app-chip-row',
    'app-chip',
    'app-chip-active',
  ])('defines .%s', (className) => {
    expect(css).toContain(`.${className}`);
  });
});
