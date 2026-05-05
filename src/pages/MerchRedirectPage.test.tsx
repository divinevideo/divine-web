import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MERCH_STORE_URL } from '@/lib/externalLinks';
import { MerchRedirectPage } from './MerchRedirectPage';

describe('MerchRedirectPage', () => {
  it('redirects to the Bonfire merch store and provides a fallback link', async () => {
    const redirect = vi.fn();

    render(<MerchRedirectPage redirect={redirect} />);

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledWith(MERCH_STORE_URL);
    });

    expect(screen.getByRole('link', { name: /open merch store/i })).toHaveAttribute('href', MERCH_STORE_URL);
  });
});
