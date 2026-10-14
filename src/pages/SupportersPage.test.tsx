import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSupporter } from '@/hooks/useSupporter';
import { initializeI18n } from '@/lib/i18n';
import SupportersPage from './SupportersPage';

vi.mock('@/hooks/useSupporter', () => ({
  useSupporter: vi.fn(),
}));
function state(overrides = {}) {
  vi.mocked(useSupporter).mockReturnValue({
    isActive: false,
    isSignedIn: true,
    canCheck: true,
    isFetching: false,
    isError: false,
    data: undefined,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useSupporter>);
}
beforeEach(async () => {
  await initializeI18n({ force: true, languages: ['en-US'] });
  state();
});
describe('SupportersPage', () => {
  it('thanks active supporters and offers opt-in public recognition', () => {
    state({ isActive: true, data: { status: 'active', recognition: { haloVisible: false } } });
    render(
      <MemoryRouter>
        <SupportersPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Thank you for supporting Divine.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Show my supporter badge on my profile' })).not.toBeChecked();
    expect(screen.queryByRole('link', { name: 'Get the app to become a supporter' })).not.toBeInTheDocument();
  });
  it('promotes native purchase and explains the verification prerequisite for inactive accounts', () => {
    state({ data: { status: 'expired', entitlement: { isActive: false } } });
    render(
      <MemoryRouter>
        <SupportersPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Become a supporter to apply for verification')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Get the app to become a supporter' }),
    ).toHaveAttribute('href', '/download');
  });
  it('reports service errors instead of telling a paying user to buy again', () => {
    state({ isError: true });
    render(
      <MemoryRouter>
        <SupportersPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t check your supporter status. Try again.');
    expect(screen.queryByRole('link', { name: 'Get the app to become a supporter' })).not.toBeInTheDocument();
  });
  it.each([
    { data: undefined },
    { data: { status: 'unknown', entitlement: { isActive: false } } },
    { canCheck: false },
  ])('keeps unresolved signed-in membership neutral: %j', (overrides) => {
    state(overrides);
    render(
      <MemoryRouter>
        <SupportersPage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: 'Get the app to become a supporter' })).not.toBeInTheDocument();
    expect(screen.queryByText('Become a supporter to apply for verification')).not.toBeInTheDocument();
  });

});
