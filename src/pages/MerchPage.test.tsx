import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import MerchPage from './MerchPage';
import { MERCH_STORE_URL } from '@/lib/externalLinks';
import merchProducts from '@/data/merchProducts.json';

vi.mock('@unhead/react', () => ({
  useHead: () => undefined,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MerchPage />
    </MemoryRouter>,
  );
}

describe('MerchPage', () => {
  it('renders a hero headline', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders the fulfillment trust line', () => {
    renderPage();
    expect(screen.getByText(/printed and shipped by bonfire/i)).toBeInTheDocument();
  });

  it('renders one card per scraped Bonfire product, deep-linking to that product', () => {
    renderPage();
    const grid = screen.getByRole('list', { name: /merch products/i });
    const cards = within(grid).getAllByRole('listitem');
    expect(cards).toHaveLength(merchProducts.products.length);

    for (const product of merchProducts.products) {
      const link = screen.getByRole('link', { name: new RegExp(product.name, 'i') });
      expect(link).toHaveAttribute('href', product.url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });

  it('renders a Shop everything CTA pointing at the Bonfire store, opening in a new tab', () => {
    renderPage();
    const cta = screen.getByRole('link', { name: /shop everything/i });
    expect(cta).toHaveAttribute('href', MERCH_STORE_URL);
    expect(cta).toHaveAttribute('target', '_blank');
    expect(cta).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
