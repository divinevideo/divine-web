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
});
