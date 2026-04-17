import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('brand utility class names are stable', () => {
  it('brand-offset-shadow-green is applied to elements that reference it', () => {
    const { container } = render(<div className="brand-offset-shadow-green" />);
    expect(container.firstElementChild).toHaveClass('brand-offset-shadow-green');
  });

  it('brand-tilt-neg-3 is applied to elements that reference it', () => {
    const { container } = render(<div className="brand-tilt-neg-3" />);
    expect(container.firstElementChild).toHaveClass('brand-tilt-neg-3');
  });

  it('brand-sticker is applied to elements that reference it', () => {
    const { container } = render(<div className="brand-sticker" />);
    expect(container.firstElementChild).toHaveClass('brand-sticker');
  });
});
