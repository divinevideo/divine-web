import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsPage from './AnalyticsPage';

const { mockUseCurrentUser } = vi.hoisted(() => ({
  mockUseCurrentUser: vi.fn(() => ({
    user: undefined,
    isSessionLoading: true,
  })),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock('@/hooks/useCreatorAnalytics', () => ({
  useCreatorAnalytics: () => ({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@unhead/react', () => ({
  useSeoMeta: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('AnalyticsPage', () => {
  beforeEach(() => {
    mockUseCurrentUser.mockReset();
    mockUseCurrentUser.mockReturnValue({
      user: undefined,
      isSessionLoading: true,
    });
  });

  it('waits for a saved session to restore instead of redirecting home', () => {
    render(
      <MemoryRouter initialEntries={['/analytics']}>
        <Routes>
          <Route path="/" element={<div data-testid="home-page" />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('analytics-auth-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
  });
});
