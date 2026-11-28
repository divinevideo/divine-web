// ABOUTME: Verifies cn() resolves tailwindcss-safe-area utilities against the padding,
// ABOUTME: margin and inset classes they conflict with instead of keeping both.

import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('lets a later padding class override a safe-area padding class', () => {
    // src/components/ui/sidebar.tsx renders SheetContent with `p-0`; the sheet variant
    // supplies `py-safe-offset-6 pr-safe-offset-6`. Keeping both leaves the sheet padded.
    expect(cn('p-6 py-safe-offset-6 pr-safe-offset-6', 'p-0')).toBe('p-0');
  });

  it('lets a later inset class override a safe-area inset class', () => {
    expect(cn('top-safe-offset-4', 'top-0')).toBe('top-0');
    expect(cn('bottom-safe', 'bottom-2')).toBe('bottom-2');
  });

  it('lets a later margin class override a safe-area margin class', () => {
    expect(cn('mb-safe-or-4', 'mb-0')).toBe('mb-0');
  });

  it('keeps a safe-area class that overrides an earlier broader class', () => {
    expect(cn('p-6', 'pb-safe-offset-6')).toBe('p-6 pb-safe-offset-6');
  });

  it('keeps safe-area classes for axes the later class does not cover', () => {
    expect(cn('px-safe pt-safe', 'pt-4')).toBe('px-safe pt-4');
  });

  it('does not merge across responsive variants', () => {
    expect(cn('pb-safe-offset-16 md:pb-0')).toBe('pb-safe-offset-16 md:pb-0');
  });
});
