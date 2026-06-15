import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BadgeImage } from '@/components/BadgeImage';

describe('BadgeImage', () => {
  it('renders a fallback when no badge image is available', () => {
    render(<BadgeImage alt="Missing badge" className="h-8 w-8 rounded-full" />);

    expect(screen.getByRole('img', { name: 'Missing badge' })).toBeInTheDocument();
    expect(document.querySelector('img[alt="Missing badge"]')).toBeNull();
  });

  it('falls back to the default badge artwork when the badge image fails to load', () => {
    const { container } = render(
      <BadgeImage
        src="https://example.com/broken-badge.png"
        alt="Broken badge"
        className="h-8 w-8 rounded-full"
      />
    );

    const image = container.querySelector('img[alt="Broken badge"]');
    expect(image).not.toBeNull();

    fireEvent.error(image!);

    expect(container.querySelector('img[alt="Broken badge"]')).toBeNull();
    expect(screen.getByRole('img', { name: 'Broken badge' })).toBeInTheDocument();
  });
});
