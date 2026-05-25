import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { FAQPage } from './FAQPage';

vi.mock('@/components/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="marketing-layout">{children}</div>,
}));

vi.mock('@/components/ZendeskWidget', () => ({
  ZendeskWidget: () => null,
}));

describe('FAQPage', () => {
  it('keeps the DMCA policy link pointing to /dmca', () => {
    render(
      <MemoryRouter>
        <FAQPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /how do i report inappropriate content\?/i }));

    expect(screen.getByRole('link', { name: 'DMCA policy' })).toHaveAttribute('href', '/dmca');
  });
});
