import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { MERCH_STORE_URL } from '@/lib/externalLinks';
import { MerchPage } from './MerchPage';

vi.mock('@/components/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('MerchPage', () => {
  it('renders an on-site merch page with an outbound Bonfire link', () => {
    render(
      <MemoryRouter>
        <MerchPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /divine merch/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /open merch store/i })).toHaveAttribute('href', MERCH_STORE_URL);
  });
});
