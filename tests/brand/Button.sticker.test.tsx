import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from '@/components/ui/button';

describe('Button variant="sticker"', () => {
  it('applies the brand-sticker composition class', () => {
    render(<Button variant="sticker">Share your thing</Button>);
    expect(screen.getByRole('button')).toHaveClass('brand-sticker');
  });

  it('uses brand green background and dark-green text by default', () => {
    render(<Button variant="sticker">Share your thing</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/bg-brand-green/);
    expect(btn.className).toMatch(/text-brand-dark-green/);
  });

  it('overrides the base rounded-full with a 14px radius', () => {
    render(<Button variant="sticker">Share your thing</Button>);
    expect(screen.getByRole('button').className).toMatch(/!rounded-\[14px\]/);
  });
});
