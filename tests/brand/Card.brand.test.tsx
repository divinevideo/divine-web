import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card } from '@/components/ui/card';

describe('Card variant="brand"', () => {
  it('applies brand-card when variant=brand', () => {
    const { container } = render(<Card variant="brand" data-testid="c" />);
    expect(container.firstElementChild).toHaveClass('brand-card');
  });

  it('does not apply brand-card by default', () => {
    const { container } = render(<Card data-testid="c" />);
    expect(container.firstElementChild).not.toHaveClass('brand-card');
  });

  it('applies the correct accent shadow class when accent is provided', () => {
    const { container } = render(<Card variant="brand" accent="pink" />);
    expect(container.firstElementChild).toHaveClass('brand-offset-shadow-pink');
  });

  it('applies accent only when variant=brand', () => {
    const { container } = render(<Card accent="violet" />);
    // Default variant should NOT pick up the accent shadow — accent is only active on brand variant.
    expect(container.firstElementChild).not.toHaveClass('brand-offset-shadow-violet');
  });

  it('omits accent shadow when accent prop not passed', () => {
    const { container } = render(<Card variant="brand" />);
    expect(container.firstElementChild).toHaveClass('brand-card');
    expect(container.firstElementChild?.className).not.toMatch(/brand-offset-shadow-/);
  });
});
