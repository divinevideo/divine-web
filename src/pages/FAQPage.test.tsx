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

  it('scopes the private messaging answer to each surface', () => {
    render(
      <MemoryRouter>
        <FAQPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /can i block users\?/i }));

    expect(screen.getByText('Private messages')).toBeInTheDocument();
    expect(screen.getByText(/on Divine Web, the current private messaging channel is for contacting Divine Support/i))
      .toBeInTheDocument();
    expect(screen.getByText(/in the Divine mobile app you can also message people directly/i))
      .toBeInTheDocument();
    // Guard the privacy sentence on the SPA surface too, not just its first clause,
    // so it can't silently diverge from the prerendered mirror.
    expect(screen.getByText(/those messages are end-to-end encrypted and don't reach Divine Support/i))
      .toBeInTheDocument();
    expect(screen.queryByText(/direct messages between users/i))
      .not.toBeInTheDocument();
  });

  it('answers TestFlight -> App Store account resolution without a silent merge', () => {
    render(
      <MemoryRouter>
        <FAQPage />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /which account will i sign into/i }),
    );

    expect(document.getElementById('app-store-account')).toBeInTheDocument();
    // Same app/sign-in across TestFlight and App Store.
    expect(
      screen.getByText(/it's the same app with the same sign-in/i),
    ).toBeInTheDocument();
    // Core reassurance: no silent merge/overwrite/delete of an existing account.
    expect(
      screen.getByText(/never merges, replaces, or deletes any other account/i),
    ).toBeInTheDocument();
  });

  it('explains follower/following counts and does not claim blocking changes them', () => {
    render(
      <MemoryRouter>
        <FAQPage />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /how does divine count followers and following\?/i,
      }),
    );

    // Stable anchor the mobile Creator Analytics explanation deep-links to.
    expect(document.getElementById('follower-counts')).toBeInTheDocument();
    expect(
      screen.getByText(/number of accounts that currently follow you/i),
    ).toBeInTheDocument();
    // Accurate to shipped behavior: blocking does not change the public count.
    expect(
      screen.getByText(
        /blocking doesn't remove their follow or change public follower counts/i,
      ),
    ).toBeInTheDocument();
  });
});
