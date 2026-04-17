import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SectionHeader } from '@/components/brand/SectionHeader';

describe('SectionHeader', () => {
  it('renders an h2 by default', () => {
    render(<SectionHeader>Trending</SectionHeader>);
    expect(screen.getByRole('heading', { level: 2, name: 'Trending' })).toBeInTheDocument();
  });

  it('renders an h3 when as="h3"', () => {
    render(<SectionHeader as="h3">Pinned</SectionHeader>);
    expect(screen.getByRole('heading', { level: 3, name: 'Pinned' })).toBeInTheDocument();
  });

  it('applies font-extrabold and brand text colors', () => {
    render(<SectionHeader>Hello</SectionHeader>);
    const h = screen.getByRole('heading', { level: 2 });
    expect(h.className).toMatch(/font-extrabold/);
    expect(h.className).toMatch(/text-brand-dark-green/);
    expect(h.className).toMatch(/dark:text-brand-off-white/);
  });

  it('merges a custom className on top of the defaults', () => {
    render(<SectionHeader className="text-4xl">Big</SectionHeader>);
    expect(screen.getByRole('heading', { level: 2 }).className).toMatch(/text-4xl/);
  });

  it('throws in dev when className contains `uppercase`', () => {
    // In the test environment, import.meta.env.DEV is true (jsdom default).
    expect(() =>
      render(<SectionHeader className="uppercase tracking-wide">Nope</SectionHeader>),
    ).toThrow(/uppercase/);
  });
});
