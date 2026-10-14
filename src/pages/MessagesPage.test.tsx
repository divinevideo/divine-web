import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { getSupportDmConversationPath } from '@/lib/dmAccessPolicy';
import MessagesPage from './MessagesPage';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('@/hooks/useSubdomainNavigate', () => ({
  useSubdomainNavigate: () => mockNavigate,
}));

describe('MessagesPage', () => {
  it('redirects the compatibility route to the canonical support conversation', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/messages']}>
        <MessagesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(getSupportDmConversationPath(), {
        replace: true,
      });
    });
    expect(container).toBeEmptyDOMElement();
  });
});
