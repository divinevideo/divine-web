import { render, screen } from '@testing-library/react';
import { BrandLogo } from '@/components/brand/BrandLogo';

describe('BrandLogo', () => {
  it('renders the Divine wordmark', () => {
    render(<BrandLogo />);
    expect(screen.getByText('Divine')).toBeInTheDocument();
  });

  it('uses Bricolage Grotesque with extra-bold weight', () => {
    render(<BrandLogo />);
    const el = screen.getByText('Divine');
    expect(el.className).toMatch(/font-extrabold/);
    expect(el.tagName).toBe('SPAN');
  });

  it('never uses Pacifico or font-logo', () => {
    render(<BrandLogo />);
    const el = screen.getByText('Divine');
    expect(el.className).not.toMatch(/font-logo/);
    expect(el.className).not.toMatch(/pacifico/i);
  });

  it('applies Bricolage Grotesque via inline style', () => {
    // <span> does not inherit from the h1-h6 selector, so the inline style
    // is load-bearing. Guard against accidental removal.
    render(<BrandLogo />);
    const el = screen.getByText('Divine');
    expect(el.style.fontFamily).toMatch(/Bricolage Grotesque/);
  });

  it('applies the brand green text color class', () => {
    render(<BrandLogo />);
    expect(screen.getByText('Divine').className).toMatch(/text-brand-green/);
  });
});
